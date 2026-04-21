import json
import aiosqlite
from pathlib import Path
from typing import Optional, List
import re

from schemas.assets_schema import (
    Character, Scene, Prop, AssetsCollection, Variant, ExtractProgress
)
from services.llm_client import call_llm
from services.preset_service import get_active_preset_content
from schemas.preset_schema import PresetCategory
from services.script_service import get_episode_info, get_project_path

DB_PATH = Path(__file__).parent.parent / "feicai.db"

VALID_ASSET_TYPES = {"character", "scene", "prop"}


async def get_assets_path(project_id: int) -> Optional[Path]:
    """获取项目 assets.json 文件路径"""
    project_path = await get_project_path(project_id)
    if not project_path:
        return None
    return Path(project_path) / "assets.json"


async def read_assets(project_id: int) -> AssetsCollection:
    """读取项目资产库"""
    assets_path = await get_assets_path(project_id)
    if not assets_path or not assets_path.exists():
        return AssetsCollection()

    content = assets_path.read_text(encoding="utf-8")
    data = json.loads(content)
    return AssetsCollection(
        characters=[Character(**c) for c in data.get("characters", [])],
        scenes=[Scene(**s) for s in data.get("scenes", [])],
        props=[Prop(**p) for p in data.get("props", [])],
    )


async def write_assets(project_id: int, assets: AssetsCollection) -> None:
    """写入项目资产库"""
    assets_path = await get_assets_path(project_id)
    if not assets_path:
        raise ValueError("项目路径不存在")

    assets_path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(assets.model_dump(), ensure_ascii=False, indent=2)
    assets_path.write_text(content, encoding="utf-8")


# ═══════════════════════════════════════════════════════════════
# 两阶段批处理架构
#
# Phase 1（逐集并行）: extract_raw_mentions_from_episode()
#   → 只做原文抄录，不判断关系，不分配ID
#   → 输出 raw_mentions.json 到每集目录
#
# 程序聚类: cluster_raw_mentions()
#   → 按名称相似度把所有集的原始提及聚成实体簇
#   → 程序负责分配 asset_id（彻底移出LLM职责）
#
# Phase 2（逐实体簇）: consolidate_entity_cluster()
#   → 输入：某实体在所有集的原始片段列表
#   → 提炼 base（只要永久特征）+ 识别 variant（换装/形态变化）
#   → 输出最终 Asset 对象
# ═══════════════════════════════════════════════════════════════


def _name_similar(a: str, b: str, asset_type: str = "") -> bool:
    """判断两个资产名称是否指向同一实体（用于程序聚类）。

    角色/道具：完全匹配 > 包含匹配 > 2字以内单字重叠 > 3字以上任意bigram重叠
    场景：完全匹配 > 包含匹配 > Jaccard相似度≥50%（防止"后山树林"/"后山土坟"误合并）
    """
    a, b = a.strip(), b.strip()
    if a == b:
        return True
    if a in b or b in a:
        return True

    if asset_type == "scene":
        # 场景用 Jaccard 阈值，要求共享 bigram 占并集的 50% 以上
        if len(a) < 2 or len(b) < 2:
            return bool(set(a) & set(b))
        bigrams_a = {a[i:i+2] for i in range(len(a)-1)}
        bigrams_b = {b[i:i+2] for i in range(len(b)-1)}
        intersection = bigrams_a & bigrams_b
        union = bigrams_a | bigrams_b
        return len(intersection) / len(union) >= 0.5

    # 角色/道具：原有宽松规则
    if len(a) <= 2 or len(b) <= 2:
        return bool(set(a) & set(b))
    bigrams_a = {a[i:i+2] for i in range(len(a)-1)}
    bigrams_b = {b[i:i+2] for i in range(len(b)-1)}
    return bool(bigrams_a & bigrams_b)


def _next_asset_id(prefix: str, existing_ids: set) -> str:
    """程序生成不冲突的 asset_id，彻底替代 LLM 分配"""
    i = 1
    while f"{prefix}{i}" in existing_ids:
        i += 1
    return f"{prefix}{i}"


async def extract_raw_mentions_from_episode(
    episode_id: int,
    project_id: int,
) -> dict:
    """Phase 1：从单集剧本提取原始实体提及。

    只做：识别出现了哪些实体 + 抄录剧本中的原始描述片段
    不做：判断与已有资产的关系、分配ID、区分base和variant、合并描述

    输出写入 episodes/EPxx/raw_mentions.json，同时返回结果供调用方汇总。
    """
    episode = await get_episode_info(episode_id)
    if not episode:
        return {"episode_id": episode_id, "episode_number": 0,
                "status": "failed", "error": "集数不存在"}

    project_path = await get_project_path(project_id)
    if not project_path:
        return {"episode_id": episode_id, "episode_number": episode["number"],
                "status": "failed", "error": "项目路径不存在"}

    script_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "script.txt"
    if not script_file.exists():
        return {"episode_id": episode_id, "episode_number": episode["number"],
                "status": "failed", "error": "剧本不存在"}

    script_content = script_file.read_text(encoding="utf-8")

    # 读取激活的资产提取预设（可覆盖默认角色设定）
    extraction_style = await get_active_preset_content(project_id, PresetCategory.ASSET_EXTRACTION)
    default_role = "你是短剧剧本分析助手，负责从剧本中提取角色、场景、道具的原始提及。"
    role_line = extraction_style if extraction_style else default_role

    system_prompt = role_line + """

任务规则（严格遵守）：
1. 列出本集实际出现的所有角色、场景、关键道具
2. 对每个实体，只记录以下内容：
   - name: 剧本中使用的名称（原文，不要改写）
   - type: character / scene / prop
   - raw_fragments: 剧本中直接描述该实体外观/特征的原文句子列表（原文抄录，不要提炼或概括）
   - context: 该实体在本集的行为或状态，50字以内
3. 【重要】不要判断是否与其他集的资产相同
4. 【重要】不要分配编号或ID
5. 【重要】raw_fragments 只抄录外观描述，不要抄录对话或动作

输出格式（只输出 JSON，不要解释）：
```json
{
  "episode_number": <集数>,
  "mentions": [
    {
      "name": "团团",
      "type": "character",
      "raw_fragments": ["清瘦苍白，掌心和膝盖都蹭破皮", "眼眶发红，从地上爬起来"],
      "context": "主角，后山寻找千年雪莲，摔倒受伤后找到雪莲，遭遇狼王"
    }
  ]
}
```"""

    prompt = f"""本集剧本（第 {episode['number']} 集）：
{script_content}"""

    try:
        result = await call_llm(prompt, system_prompt, temperature=0.1, max_tokens=4000, project_id=project_id)
    except ValueError as e:
        return {"episode_id": episode_id, "episode_number": episode["number"],
                "status": "failed", "error": str(e)}

    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        return {"episode_id": episode_id, "episode_number": episode["number"],
                "status": "failed", "error": "LLM 未返回有效 JSON"}

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return {"episode_id": episode_id, "episode_number": episode["number"],
                "status": "failed", "error": "JSON 解析失败"}

    mentions = data.get("mentions", [])
    # 给每条提及注入 episode_number，便于 Phase 2 溯源
    for m in mentions:
        m["episode_number"] = episode["number"]
        m["episode_id"] = episode_id

    output = {
        "episode_id": episode_id,
        "episode_number": episode["number"],
        "status": "completed",
        "mentions": mentions,
    }

    # 写中间产物到磁盘，供后续重跑或调试
    raw_file = script_file.parent / "raw_mentions.json"
    raw_file.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    return output


def cluster_raw_mentions(
    all_mentions: List[dict],
    existing_assets: Optional[AssetsCollection] = None,
) -> List[dict]:
    """程序聚类：把所有集的原始提及按实体名称相似度分组，程序分配 asset_id。

    输入：所有集 raw_mentions 列表中的 mention 条目（已展平）
    输出：实体簇列表，每簇格式：
    {
        "asset_id": "人物1",        # 程序分配，不依赖LLM
        "canonical_name": "团团",   # 出现频率最高的名称
        "type": "character",
        "all_names": ["团团"],      # 所有别名
        "episodes": [               # 跨集片段列表
            {"episode_number": 1, "raw_fragments": [...], "context": "..."}
        ],
        "existing_asset_id": None,  # 若与已有资产匹配，填入已有ID
    }
    """
    # 先按 type 分组
    by_type: dict[str, List[dict]] = {"character": [], "scene": [], "prop": []}
    for m in all_mentions:
        t = m.get("type", "")
        if t in by_type:
            by_type[t].append(m)

    # 已有资产名称索引（用于识别跨轮次已有资产）
    existing_by_name: dict[str, tuple] = {}  # name → (asset_id, type)
    if existing_assets:
        for c in existing_assets.characters:
            existing_by_name[c.name] = (c.asset_id, "character")
        for s in existing_assets.scenes:
            existing_by_name[s.name] = (s.asset_id, "scene")
        for p in existing_assets.props:
            existing_by_name[p.name] = (p.asset_id, "prop")

    type_prefix = {"character": "人物", "scene": "场景", "prop": "道具"}
    used_ids: set = set()
    if existing_assets:
        used_ids = (
            {c.asset_id for c in existing_assets.characters} |
            {s.asset_id for s in existing_assets.scenes} |
            {p.asset_id for p in existing_assets.props}
        )

    clusters: List[dict] = []

    for asset_type, mentions in by_type.items():
        # Union-Find 式聚类：逐条 mention，找相似簇或新建
        type_clusters: List[dict] = []

        for mention in mentions:
            name = mention.get("name", "").strip()
            if not name:
                continue

            # 找已有簇中是否有相似名称
            matched = None
            for cluster in type_clusters:
                if any(_name_similar(name, n, asset_type) for n in cluster["all_names"]):
                    matched = cluster
                    break

            if matched:
                if name not in matched["all_names"]:
                    matched["all_names"].append(name)
                matched["episodes"].append({
                    "episode_number": mention.get("episode_number"),
                    "episode_id": mention.get("episode_id"),
                    "raw_fragments": mention.get("raw_fragments", []),
                    "context": mention.get("context", ""),
                })
            else:
                # 新建簇
                # 检查是否匹配已有资产
                existing_id = None
                for existing_name, (eid, etype) in existing_by_name.items():
                    if etype == asset_type and _name_similar(name, existing_name, asset_type):
                        existing_id = eid
                        break

                # 分配 ID：优先复用已有资产ID，否则程序生成新ID
                if existing_id:
                    asset_id = existing_id
                else:
                    asset_id = _next_asset_id(type_prefix[asset_type], used_ids)
                    used_ids.add(asset_id)

                type_clusters.append({
                    "asset_id": asset_id,
                    "canonical_name": name,
                    "type": asset_type,
                    "all_names": [name],
                    "existing_asset_id": existing_id,
                    "episodes": [{
                        "episode_number": mention.get("episode_number"),
                        "episode_id": mention.get("episode_id"),
                        "raw_fragments": mention.get("raw_fragments", []),
                        "context": mention.get("context", ""),
                    }],
                })

        clusters.extend(type_clusters)

    return clusters


def _deduplicate_fragments(fragments: list[str]) -> list[str]:
    """
    对 raw_fragments 列表去重（保留顺序，相同或高度相似的只保留第一条）

    使用简单的字符串相似度判断：
    - 完全相同：去重
    - 长度差异 < 20% 且 bigram Jaccard >= 0.7：认定为重复
    """
    if not fragments:
        return []

    result = []
    for frag in fragments:
        frag = frag.strip()
        if not frag:
            continue

        # 检查是否与已有片段重复
        is_duplicate = False
        for existing in result:
            if frag == existing:
                is_duplicate = True
                break

            # 长度相近且内容高度相似
            len_ratio = min(len(frag), len(existing)) / max(len(frag), len(existing))
            if len_ratio >= 0.8:
                # 计算 bigram Jaccard 相似度
                if len(frag) < 2 or len(existing) < 2:
                    continue
                bigrams_a = {frag[i:i+2] for i in range(len(frag)-1)}
                bigrams_b = {existing[i:i+2] for i in range(len(existing)-1)}
                intersection = bigrams_a & bigrams_b
                union = bigrams_a | bigrams_b
                if union and len(intersection) / len(union) >= 0.7:
                    is_duplicate = True
                    break

        if not is_duplicate:
            result.append(frag)

    return result


async def consolidate_entity_cluster(
    cluster: dict,
    existing_asset: Optional[dict] = None,
    project_id: Optional[int] = None,
) -> Optional[dict]:
    """Phase 2：对单个实体簇做一次 LLM 调用，提炼 base + variants。

    输入：一个实体簇（含跨集所有原始片段）
    输出：最终 Asset 字典（含稳定 base + 正确 variants）
    """
    asset_type = cluster["type"]
    name = cluster["canonical_name"]
    asset_id = cluster["asset_id"]

    # 组织跨集片段上下文
    episode_lines = []
    for ep in sorted(cluster["episodes"], key=lambda e: e.get("episode_number", 0)):
        ep_num = ep.get("episode_number", "?")
        fragments = ep.get("raw_fragments", [])
        # 去重：相同或高度相似的描述只保留一条
        fragments = _deduplicate_fragments(fragments)
        context = ep.get("context", "")
        frags_text = "；".join(fragments) if fragments else "（无外观描述）"
        episode_lines.append(f"第{ep_num}集 外观：{frags_text}\n第{ep_num}集 状态：{context}")

    episodes_text = "\n\n".join(episode_lines)

    existing_note = ""
    if existing_asset:
        existing_desc = existing_asset.get("appearance") or existing_asset.get("description") or ""
        existing_note = f"\n已有资产描述（供参考，可更新）：\n{existing_desc[:200]}\n"

    type_label = {"character": "角色", "scene": "场景", "prop": "道具"}.get(asset_type, asset_type)

    if asset_type == "character":
        output_schema = """{
  "base_appearance": "角色的永久稳定外观：骨相/发型/体型/标志性服装（不含情绪状态、临时伤势）",
  "gender": "性别",
  "age": "年龄段",
  "outfit": "标志性服装描述",
  "variants": [
    {
      "variant_id": "v1",
      "variant_name": "变体名称（如：受伤态/战斗态/换装）",
      "trigger_condition": "触发此变体的剧情条件",
      "visual_diff": "与 base_appearance 的具体视觉差异"
    }
  ]
}"""
        rules = """【base_appearance 规则】只填永久稳定特征：
  ✓ 骨相、发色发型、体型、标志性配饰、基础服装
  ✗ 不填：哭泣/愤怒/惊恐等情绪、临时擦伤/流血、单集特有动作
【重要】若所有集的 raw_fragments 均为空或标注"（无外观描述）"：
  outfit 和 base_appearance 必须填"待补充"，禁止根据角色身份、名字或剧情推断服饰
【variant 触发标准】只有真正的视觉形态变化才建 variant（至少2种形态才建 variants）：
  ✓ 换装（正装↔便装）、重大伤势（包扎/血迹）、能力爆发（光芒/特效）、伪装/化妆
  ✗ 不建：普通情绪变化、微表情、日常动作
  ✗ 若只能识别出1种视觉变化，不建 variant，将该变化信息并入 outfit 描述即可"""
    elif asset_type == "scene":
        output_schema = """{
  "base_description": "场景的固定视觉特征：地点性质/建筑结构/永久陈设/光线氛围",
  "visual_elements": ["固定视觉元素1", "固定视觉元素2"],
  "time_of_day": "白天/夜晚/黄昏/不固定",
  "lighting": "光线特征"
}"""
        rules = """【base_description 规则】只填场景的固定不变特征，不填单集特有的临时陈设变化
【重要】若所有集的 raw_fragments 均为空，base_description 必须填"待补充"，禁止推断
【重要】场景不建 variants，不同光线/时段/状态的差异在 base_description 中用"/"分隔描述"""
    else:  # prop
        output_schema = """{
  "base_description": "道具的固定外观：材质/形状/颜色/尺寸/标志性特征"
}"""
        rules = """【base_description 规则】只填道具的固定物理特征"""

    system_prompt = f"""你是短剧资产档案整理师，负责整理{type_label}档案。
请根据跨集原始描述，提炼稳定的基础档案（base）和状态变体（variants）。

{rules}

输出格式（只输出 JSON，不要解释）：
```json
{output_schema}
```"""

    prompt = f"""{existing_note}各集原始记录（{type_label}「{name}」）：
{episodes_text}"""

    try:
        result = await call_llm(prompt, system_prompt, temperature=0.1, max_tokens=3000, project_id=project_id)
    except ValueError:
        return None

    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        return None

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return None

    # 组装最终 asset 字典
    asset: dict = {
        "asset_id": asset_id,
        "name": name,
        "tags": [],
        "variants": [],
        "images": [],
    }

    # 处理 variants：只有 character 才有 variants
    if asset_type == "character":
        raw_variants = data.get("variants", [])
        valid_variants = []
        for v in raw_variants:
            if isinstance(v, dict) and v.get("variant_id") and v.get("variant_name"):
                valid_variants.append({
                    "variant_id": v["variant_id"],
                    "variant_name": v["variant_name"],
                    "trigger_condition": v.get("trigger_condition", ""),
                    "visual_diff": v.get("visual_diff", ""),
                })
        # 单 variant 压平：只有1个变体时并入 outfit，不建层级
        if len(valid_variants) == 1:
            v = valid_variants[0]
            diff = v.get("visual_diff", "").strip()
            asset["variants"] = []
            asset["_merged_variant_note"] = diff  # 暂存，后面合并入 outfit
        else:
            asset["variants"] = valid_variants

    if asset_type == "character":
        base_outfit = data.get("outfit", "")
        # 如果有被压平的单 variant，将其 visual_diff 追加到 outfit
        merged_note = asset.pop("_merged_variant_note", "")
        if merged_note and base_outfit:
            base_outfit = f"{base_outfit}；{merged_note}"
        elif merged_note:
            base_outfit = merged_note
        asset["appearance"] = data.get("base_appearance", "")
        asset["gender"] = data.get("gender", "")
        asset["age"] = data.get("age", "")
        asset["outfit"] = base_outfit
    elif asset_type == "scene":
        asset["description"] = data.get("base_description", "")
        asset["visual_elements"] = data.get("visual_elements", [])
        asset["time_of_day"] = data.get("time_of_day", "")
        asset["lighting"] = data.get("lighting", "")
    else:  # prop
        asset["description"] = data.get("base_description", "")

    # 若与已有资产匹配，保留已有图片
    if existing_asset:
        asset["images"] = existing_asset.get("images", [])

    return asset


async def run_two_phase_extraction(
    episode_ids: List[int],
    project_id: int,
) -> dict:
    """完整的两阶段批处理提取流程。

    Phase 1：并行（或串行）对所有集提取原始提及
    聚类：程序按名称相似度分组，分配 asset_id
    Phase 2：逐实体簇调用 LLM 提炼 base + variants
    写入：更新 assets.json 和各集 episode_assets.json
    """
    project_path = await get_project_path(project_id)
    if not project_path:
        return {"status": "failed", "error": "项目路径不存在"}

    existing = await read_assets(project_id)

    # ── Phase 1：逐集提取原始提及（保持串行避免并发写文件冲突）──
    phase1_results = []
    phase1_errors = []
    for ep_id in episode_ids:
        r = await extract_raw_mentions_from_episode(ep_id, project_id)
        if r.get("status") == "completed":
            phase1_results.append(r)
        else:
            phase1_errors.append(r)

    # 展平所有 mentions
    all_mentions: List[dict] = []
    for r in phase1_results:
        all_mentions.extend(r.get("mentions", []))

    if not all_mentions:
        return {
            "status": "failed" if not phase1_results else "completed",
            "error": "未提取到任何实体",
            "phase1_errors": phase1_errors,
        }

    # ── 程序聚类 + ID 分配 ──────────────────────────────
    clusters = cluster_raw_mentions(all_mentions, existing)

    # ── Phase 2：逐实体簇提炼 base + variants ────────────
    final_chars: List[Character] = []
    final_scenes: List[Scene] = []
    final_props: List[Prop] = []

    # 保留已有资产中未出现在本次提取集数中的资产（不覆盖）
    extracted_ids = {c["asset_id"] for c in clusters}
    for c in existing.characters:
        if c.asset_id not in extracted_ids:
            final_chars.append(c)
    for s in existing.scenes:
        if s.asset_id not in extracted_ids:
            final_scenes.append(s)
    for p in existing.props:
        if p.asset_id not in extracted_ids:
            final_props.append(p)

    # 逐簇调用 Phase 2
    ep_asset_index: dict[int, dict] = {}  # episode_id → {chars, scenes, props}

    for cluster in clusters:
        # 查找已有资产（若有）供 Phase 2 参考
        existing_asset_dict = None
        eid = cluster.get("existing_asset_id")
        if eid:
            for c in existing.characters:
                if c.asset_id == eid:
                    existing_asset_dict = c.model_dump()
                    break
            if not existing_asset_dict:
                for s in existing.scenes:
                    if s.asset_id == eid:
                        existing_asset_dict = s.model_dump()
                        break
            if not existing_asset_dict:
                for p in existing.props:
                    if p.asset_id == eid:
                        existing_asset_dict = p.model_dump()
                        break

        asset_dict = await consolidate_entity_cluster(cluster, existing_asset_dict, project_id=project_id)
        if not asset_dict:
            continue

        asset_type = cluster["type"]
        asset_id = cluster["asset_id"]

        # 构建 Asset 对象
        try:
            valid_fields_char = Character.model_fields.keys()
            valid_fields_scene = Scene.model_fields.keys()
            valid_fields_prop = Prop.model_fields.keys()

            if asset_type == "character":
                clean = {k: v for k, v in asset_dict.items() if k in valid_fields_char}
                final_chars.append(Character(**clean))
            elif asset_type == "scene":
                clean = {k: v for k, v in asset_dict.items() if k in valid_fields_scene}
                final_scenes.append(Scene(**clean))
            elif asset_type == "prop":
                clean = {k: v for k, v in asset_dict.items() if k in valid_fields_prop}
                final_props.append(Prop(**clean))
        except Exception:
            continue

        # 记录各集的 episode_assets 索引
        for ep_entry in cluster.get("episodes", []):
            ep_id = ep_entry.get("episode_id")
            if ep_id is None:
                continue
            if ep_id not in ep_asset_index:
                ep_asset_index[ep_id] = {"characters": [], "scenes": [], "props": []}
            if asset_type == "character":
                ep_asset_index[ep_id]["characters"].append(asset_id)
            elif asset_type == "scene":
                ep_asset_index[ep_id]["scenes"].append(asset_id)
            elif asset_type == "prop":
                ep_asset_index[ep_id]["props"].append(asset_id)

    # ── 写入最终资产库 ────────────────────────────────────
    final_collection = AssetsCollection(
        characters=final_chars,
        scenes=final_scenes,
        props=final_props,
    )
    await write_assets(project_id, final_collection)

    # ── 写 cluster_log.json（聚类决策记录，供审核浮板使用）──
    from datetime import datetime, timezone
    cluster_log_entries = []
    for cluster in clusters:
        aliases = cluster.get("all_names", [])
        source_episodes = sorted(set(
            ep.get("episode_number") for ep in cluster.get("episodes", [])
            if ep.get("episode_number") is not None
        ))
        has_inconsistent_names = len(set(aliases)) > 1
        cluster_log_entries.append({
            "asset_id": cluster["asset_id"],
            "canonical_name": cluster["canonical_name"],
            "type": cluster["type"],
            "aliases": aliases,
            "source_episodes": [f"EP{n:02d}" for n in source_episodes],
            "has_inconsistent_names": has_inconsistent_names,
        })
    cluster_log = {
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "clusters": cluster_log_entries,
    }
    cluster_log_file = Path(project_path) / "cluster_log.json"
    cluster_log_file.write_text(
        json.dumps(cluster_log, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── 更新各集 episode_assets.json ─────────────────────
    for ep_id, index in ep_asset_index.items():
        ep_info = None
        for r in phase1_results:
            if r["episode_id"] == ep_id:
                ep_info = r
                break
        if not ep_info:
            continue
        ep_num = ep_info["episode_number"]
        ep_dir = Path(project_path) / "episodes" / f"EP{ep_num:02d}"
        ep_assets_file = ep_dir / "episode_assets.json"
        ep_assets_file.write_text(json.dumps({
            "episode_id": ep_id,
            "episode_number": ep_num,
            "characters": list(set(index["characters"])),
            "scenes": list(set(index["scenes"])),
            "props": list(set(index["props"])),
        }, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "status": "completed",
        "characters_count": len(final_chars),
        "scenes_count": len(final_scenes),
        "props_count": len(final_props),
        "clusters_count": len(clusters),
        "phase1_errors": phase1_errors,
    }


# ── 向后兼容：保留旧接口供路由层调用，内部转发到新架构 ──────
async def extract_assets_from_episode(
    episode_id: int,
    project_id: int,
    prev_summary: Optional[str] = None,
    existing: Optional[AssetsCollection] = None,
) -> ExtractProgress:
    """【已废弃，保留接口兼容性】单集提取入口，转发到 Phase 1。
    批量提取请改用 run_two_phase_extraction()。
    """
    r = await extract_raw_mentions_from_episode(episode_id, project_id)
    ep_num = r.get("episode_number", 0)
    if r.get("status") != "completed":
        return ExtractProgress(
            episode_id=episode_id, episode_number=ep_num,
            status="failed", error=r.get("error", "提取失败")
        )
    return ExtractProgress(
        episode_id=episode_id, episode_number=ep_num,
        status="completed",
        characters_count=sum(1 for m in r["mentions"] if m["type"] == "character"),
        scenes_count=sum(1 for m in r["mentions"] if m["type"] == "scene"),
        props_count=sum(1 for m in r["mentions"] if m["type"] == "prop"),
    )


def merge_assets(
    existing: AssetsCollection, new_chars: List[Character],
    new_scenes: List[Scene], new_props: List[Prop]
) -> AssetsCollection:
    """【已废弃，新架构不再使用 merge_assets】保留供历史调用兼容。"""
    return AssetsCollection(
        characters=list(existing.characters) + new_chars,
        scenes=list(existing.scenes) + new_scenes,
        props=list(existing.props) + new_props,
    )


async def add_asset(
    project_id: int, asset_type: str, asset_data: dict
) -> dict:
    """添加新资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        char = Character(**asset_data)
        assets.characters.append(char)
    elif asset_type == "scene":
        scene = Scene(**asset_data)
        assets.scenes.append(scene)
    elif asset_type == "prop":
        prop = Prop(**asset_data)
        assets.props.append(prop)

    await write_assets(project_id, assets)
    return asset_data


async def update_asset(
    project_id: int, asset_type: str, asset_id: str, updates: dict
) -> Optional[dict]:
    """更新资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        for i, char in enumerate(assets.characters):
            if char.asset_id == asset_id:
                updated = char.model_copy(update=updates)
                assets.characters[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()
    elif asset_type == "scene":
        for i, scene in enumerate(assets.scenes):
            if scene.asset_id == asset_id:
                updated = scene.model_copy(update=updates)
                assets.scenes[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()
    elif asset_type == "prop":
        for i, prop in enumerate(assets.props):
            if prop.asset_id == asset_id:
                updated = prop.model_copy(update=updates)
                assets.props[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()

    return None


async def delete_asset(
    project_id: int, asset_type: str, asset_id: str
) -> bool:
    """删除资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        assets.characters = [c for c in assets.characters if c.asset_id != asset_id]
    elif asset_type == "scene":
        assets.scenes = [s for s in assets.scenes if s.asset_id != asset_id]
    elif asset_type == "prop":
        assets.props = [p for p in assets.props if p.asset_id != asset_id]

    await write_assets(project_id, assets)
    return True


async def get_asset_images_dir(project_id: int, asset_type: str) -> Optional[Path]:
    """获取资产图片目录路径"""
    project_path = await get_project_path(project_id)
    if not project_path:
        return None
    return Path(project_path) / "assets" / asset_type


async def get_asset_images(
    project_id: int, asset_type: str, asset_id: str
) -> List[str]:
    """获取资产图片路径列表"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                return char.images
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                return scene.images
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                return prop.images

    return []


async def add_image_to_asset(
    project_id: int, asset_type: str, asset_id: str, image_path: str
) -> int:
    """添加图片到资产，返回图片索引（从 1 开始）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                char.images.append(image_path)
                await write_assets(project_id, assets)
                return len(char.images)
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                scene.images.append(image_path)
                await write_assets(project_id, assets)
                return len(scene.images)
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                prop.images.append(image_path)
                await write_assets(project_id, assets)
                return len(prop.images)

    raise ValueError(f"资产不存在: {asset_type}/{asset_id}")


async def remove_image_from_asset(
    project_id: int, asset_type: str, asset_id: str, image_index: int
) -> bool:
    """删除资产图片（索引从 1 开始）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    idx = image_index - 1  # 转换为 0 基索引

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                if 0 <= idx < len(char.images):
                    char.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                if 0 <= idx < len(scene.images):
                    scene.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                if 0 <= idx < len(prop.images):
                    prop.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False

    return False


async def set_primary_image(
    project_id: int, asset_type: str, asset_id: str, image_index: int
) -> bool:
    """设置主图（将指定索引的图片移到第一位）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    idx = image_index - 1  # 转换为 0 基索引

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                if 0 <= idx < len(char.images):
                    # 将指定图片移到第一位
                    primary = char.images.pop(idx)
                    char.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                if 0 <= idx < len(scene.images):
                    primary = scene.images.pop(idx)
                    scene.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                if 0 <= idx < len(prop.images):
                    primary = prop.images.pop(idx)
                    prop.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False

    return False


async def get_asset_detail(
    project_id: int, asset_type: str, asset_id: str
) -> Optional[dict]:
    """获取单个资产详情"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                return char.model_dump()
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                return scene.model_dump()
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                return prop.model_dump()

    return None