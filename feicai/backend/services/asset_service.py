import json
import aiosqlite
from pathlib import Path
from typing import Optional, List
import re

from schemas.assets_schema import (
    Character, Scene, Prop, AssetsCollection, Variant, ExtractProgress
)
from services.llm_client import call_llm
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


def _filter_assets_by_script(script: str, existing: AssetsCollection) -> AssetsCollection:
    """Step 1（程序预过滤）：从全量资产库筛出本集剧本中可能出现的资产子集。
    判断依据：名称直接出现在剧本中，或与剧本中出现的词语相似度 > 0.6。
    解决后几十集资产库膨胀后 token 过大的问题。
    """
    def appears_in_script(name: str) -> bool:
        if name in script:
            return True
        # 对2字以上的名称做简单片段匹配
        if len(name) >= 2:
            for i in range(len(name) - 1):
                if name[i:i+2] in script:
                    return True
        return False

    return AssetsCollection(
        characters=[c for c in existing.characters if appears_in_script(c.name)],
        scenes=[s for s in existing.scenes if appears_in_script(s.name)],
        props=[p for p in existing.props if appears_in_script(p.name)],
    )


def _build_candidates_context(filtered: AssetsCollection) -> str:
    """将预过滤后的候选资产格式化为 LLM 输入，带 asset_id + name + 简短描述"""
    lines = []
    for c in filtered.characters:
        desc = c.appearance or ""
        desc = desc[:40] if desc else ""
        lines.append(f"角色 {c.asset_id}: {c.name}" + (f"（{desc}）" if desc else ""))
    for s in filtered.scenes:
        desc = s.description or ""
        desc = desc[:40] if desc else ""
        lines.append(f"场景 {s.asset_id}: {s.name}" + (f"（{desc}）" if desc else ""))
    for p in filtered.props:
        desc = p.description or ""
        desc = desc[:40] if desc else ""
        lines.append(f"道具 {p.asset_id}: {p.name}" + (f"（{desc}）" if desc else ""))
    return "\n".join(lines) if lines else ""


def _next_asset_id(prefix: str, existing_ids: set[str]) -> str:
    """生成不与已有 ID 冲突的新 asset_id"""
    i = 1
    while f"{prefix}{i}" in existing_ids:
        i += 1
    return f"{prefix}{i}"


def _sanitize_variants(item: dict) -> dict:
    """过滤 LLM 返回的 variants 中非 dict 项"""
    if "variants" in item:
        item["variants"] = [v for v in item["variants"] if isinstance(v, dict)]
    return item


async def extract_assets_from_episode(
    episode_id: int,
    project_id: int,
    prev_summary: Optional[str] = None,
    existing: Optional[AssetsCollection] = None,
) -> ExtractProgress:
    """从单集剧本提取资产。

    四步流程：
    Step 1（程序）: 用剧本文本预过滤全量资产库，只保留本集可能出现的候选资产
    Step 2（LLM）: 一次调用同时完成：提取实体、判断 relation + confidence、生成 variant、写梗概
    Step 3（程序）: 整合结果：asset_id 去重/碰撞检测、variant 挂父节点、needs_review 标记
    Step 4（程序）: 写 episode_assets.json，返回提取结果供调用方合并到全局库
    """
    episode = await get_episode_info(episode_id)
    if not episode:
        return ExtractProgress(episode_id=episode_id, episode_number=0, status="failed", error="集数不存在")

    project_path = await get_project_path(project_id)
    if not project_path:
        return ExtractProgress(
            episode_id=episode_id, episode_number=episode["number"],
            status="failed", error="项目路径不存在"
        )

    script_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "script.txt"
    if not script_file.exists():
        return ExtractProgress(
            episode_id=episode_id, episode_number=episode["number"],
            status="failed", error="剧本不存在"
        )

    script_content = script_file.read_text(encoding="utf-8")
    if existing is None:
        existing = AssetsCollection()

    # ── Step 1：程序预过滤 ────────────────────────────────
    filtered = _filter_assets_by_script(script_content, existing)
    candidates_ctx = _build_candidates_context(filtered)
    candidates_section = f"\n已有相关资产（asset_id + name，如本集出现请复用 asset_id）：\n{candidates_ctx}\n" if candidates_ctx else "\n（暂无已有资产）\n"
    prev_section = f"上集梗概：\n{prev_summary}\n\n" if prev_summary else ""

    # ── Step 2：一次 LLM 调用，提取 + 判断 + 生成梗概 ────
    prompt = f"""你是短剧资产管理助手，请分析本集剧本，提取角色、场景、道具，并判断是否与已有资产库中的资产相同。

{prev_section}{candidates_section}
本集剧本：
{script_content[:2000]}

任务要求：
1. 提取本集实际出现的所有角色、场景、关键道具
2. 对每个提取的资产，与"已有相关资产"对比：
   - match_existing：确认是同一个，直接用已有 asset_id
   - supplement：同一个但本集有新的视觉描述，用已有 asset_id，填写新的描述字段
   - new_variant：同一角色/场景，但本集出现明显不同的视觉状态（如受伤、换装、伪装），用已有 asset_id，填写 variant 字段
   - new_asset：全新资产，分配新的 asset_id（格式：人物N / 场景N / 道具N，N 从当前最大值+1 开始）
3. confidence：你对关系判断的置信度 0.0-1.0（低于 0.7 的会被标为"待审核"）
4. 生成该集梗概 100-200 字

输出 JSON（只输出 JSON，不要解释）：
```json
{{
  "summary": "该集梗概",
  "characters": [
    {{
      "asset_id": "人物1",
      "name": "角色名",
      "relation": "match_existing|supplement|new_variant|new_asset",
      "confidence": 0.95,
      "gender": "性别",
      "age": "年龄",
      "appearance": "外貌描述（视觉化，用于生图）",
      "outfit": "服装描述",
      "tags": [],
      "variants": [
        {{
          "variant_id": "v1",
          "variant_name": "变体名称",
          "trigger_condition": "触发条件",
          "visual_diff": "与基础形态的视觉差异"
        }}
      ]
    }}
  ],
  "scenes": [
    {{
      "asset_id": "场景1",
      "name": "场景名",
      "relation": "match_existing|supplement|new_variant|new_asset",
      "confidence": 0.9,
      "description": "场景描述",
      "visual_elements": ["关键视觉元素"],
      "time_of_day": "白天/夜晚/黄昏",
      "lighting": "光线描述",
      "variants": []
    }}
  ],
  "props": [
    {{
      "asset_id": "道具1",
      "name": "道具名",
      "relation": "match_existing|supplement|new_variant|new_asset",
      "confidence": 0.85,
      "description": "外观描述",
      "variants": []
    }}
  ]
}}
```"""

    try:
        result = await call_llm(prompt, temperature=0.2, max_tokens=3000)
    except ValueError as e:
        return ExtractProgress(
            episode_id=episode_id, episode_number=episode["number"],
            status="failed", error=str(e)
        )

    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        return ExtractProgress(
            episode_id=episode_id, episode_number=episode["number"],
            status="failed", error="LLM 未返回有效 JSON"
        )

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return ExtractProgress(
            episode_id=episode_id, episode_number=episode["number"],
            status="failed", error="JSON 解析失败"
        )

    if data.get("summary"):
        (script_file.parent / "summary.txt").write_text(data["summary"], encoding="utf-8")

    # ── Step 3：程序整合 ──────────────────────────────────
    existing_char_ids = {c.asset_id for c in existing.characters}
    existing_scene_ids = {s.asset_id for s in existing.scenes}
    existing_prop_ids = {p.asset_id for p in existing.props}

    characters: List[Character] = []
    scenes: List[Scene] = []
    props: List[Prop] = []
    ep_char_ids: List[str] = []
    ep_scene_ids: List[str] = []
    ep_prop_ids: List[str] = []

    # 收集本集识别出的 new_variant，格式：{parent_asset_id: [Variant, ...]}
    pending_variants: dict[str, List[Variant]] = {}

    used_ids: set[str] = set(existing_char_ids | existing_scene_ids | existing_prop_ids)

    for raw_list, asset_cls, id_prefix, target_list, ep_ids, existing_ids in [
        (data.get("characters", []), Character, "人物", characters, ep_char_ids, existing_char_ids),
        (data.get("scenes", []), Scene, "场景", scenes, ep_scene_ids, existing_scene_ids),
        (data.get("props", []), Prop, "道具", props, ep_prop_ids, existing_prop_ids),
    ]:
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            item = _sanitize_variants(dict(item))

            relation = item.pop("relation", "new_asset")
            confidence = float(item.pop("confidence", 1.0))
            needs_review = confidence < 0.7

            asset_id = item.get("asset_id", "")

            if relation in ("match_existing", "supplement", "new_variant"):
                # 验证 LLM 给的 asset_id 确实存在于已有库，否则降级为 new_asset
                if asset_id not in existing_ids:
                    relation = "new_asset"
                    needs_review = True

            if relation == "new_variant":
                # 从 item 中提取 variant 信息，挂到父资产；不新建独立资产
                ep_ids.append(asset_id)
                for v in item.get("variants", []):
                    if not isinstance(v, dict):
                        continue
                    try:
                        variant = Variant(**{k: v[k] for k in Variant.model_fields if k in v})
                        pending_variants.setdefault(asset_id, []).append(variant)
                    except Exception:
                        pass
                continue

            if relation == "new_asset":
                if asset_id in used_ids or not asset_id:
                    asset_id = _next_asset_id(id_prefix, used_ids)
                item["asset_id"] = asset_id

            used_ids.add(asset_id)

            if needs_review:
                item["needs_review"] = True

            try:
                valid_fields = asset_cls.model_fields.keys()
                clean = {k: v for k, v in item.items() if k in valid_fields}
                asset = asset_cls(**clean)
                target_list.append(asset)
                ep_ids.append(asset.asset_id)
            except Exception:
                pass

    # pending_variants 写入 characters（父资产在 existing 中）
    # 调用方 merge_assets 时，existing 中的父资产会被更新；
    # 这里把 pending_variants 附在 ExtractProgress 上，由路由层在 merge 前注入
    # ── Step 4：写 episode_assets.json ───────────────────
    ep_assets_file = script_file.parent / "episode_assets.json"
    ep_assets_file.write_text(json.dumps({
        "episode_id": episode_id,
        "episode_number": episode["number"],
        "characters": ep_char_ids,
        "scenes": ep_scene_ids,
        "props": ep_prop_ids,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    return ExtractProgress(
        episode_id=episode_id,
        episode_number=episode["number"],
        status="completed",
        characters_count=len(characters),
        scenes_count=len(scenes),
        props_count=len(props),
        summary=data.get("summary"),
        characters=characters,
        scenes=scenes,
        props=props,
        pending_variants=pending_variants,
    )


def merge_assets(
    existing: AssetsCollection, new_chars: List[Character],
    new_scenes: List[Scene], new_props: List[Prop]
) -> AssetsCollection:
    """合并资产，按 name 模糊匹配去重"""

    def find_similar(name: str, existing_list: List) -> Optional[int]:
        """在现有列表中查找相似名称的索引"""
        name_lower = name.lower().strip()
        for i, item in enumerate(existing_list):
            existing_name = item.name.lower().strip()
            # 完全匹配或包含匹配
            if name_lower == existing_name or name_lower in existing_name or existing_name in name_lower:
                return i
        return None

    def merge_descriptions(existing_desc: Optional[str], new_desc: Optional[str]) -> Optional[str]:
        """合并描述，取更完整的版本"""
        if not existing_desc:
            return new_desc
        if not new_desc:
            return existing_desc
        # 取更长的描述
        return existing_desc if len(existing_desc) >= len(new_desc) else new_desc

    # 合并角色
    merged_chars = list(existing.characters)
    for new_char in new_chars:
        idx = find_similar(new_char.name, merged_chars)
        if idx is not None:
            # 合并字段
            existing_char = merged_chars[idx]
            merged_chars[idx] = Character(
                asset_id=existing_char.asset_id,
                name=existing_char.name,
                gender=new_char.gender or existing_char.gender,
                age=new_char.age or existing_char.age,
                appearance=merge_descriptions(existing_char.appearance, new_char.appearance),
                outfit=merge_descriptions(existing_char.outfit, new_char.outfit),
                base_asset=existing_char.base_asset,
                tags=list(set(existing_char.tags + new_char.tags)),
                needs_review=existing_char.needs_review or new_char.needs_review,
                variants=existing_char.variants + new_char.variants,
                images=existing_char.images,
            )
        else:
            merged_chars.append(new_char)

    # 合并场景
    merged_scenes = list(existing.scenes)
    for new_scene in new_scenes:
        idx = find_similar(new_scene.name, merged_scenes)
        if idx is not None:
            existing_scene = merged_scenes[idx]
            merged_scenes[idx] = Scene(
                asset_id=existing_scene.asset_id,
                name=existing_scene.name,
                description=merge_descriptions(existing_scene.description, new_scene.description),
                visual_elements=list(set(existing_scene.visual_elements + new_scene.visual_elements)),
                time_of_day=new_scene.time_of_day or existing_scene.time_of_day,
                lighting=new_scene.lighting or existing_scene.lighting,
                tags=list(set(existing_scene.tags + new_scene.tags)),
                needs_review=existing_scene.needs_review or new_scene.needs_review,
                variants=existing_scene.variants + new_scene.variants,
                images=existing_scene.images,
            )
        else:
            merged_scenes.append(new_scene)

    # 合并道具
    merged_props = list(existing.props)
    for new_prop in new_props:
        idx = find_similar(new_prop.name, merged_props)
        if idx is not None:
            existing_prop = merged_props[idx]
            merged_props[idx] = Prop(
                asset_id=existing_prop.asset_id,
                name=existing_prop.name,
                description=merge_descriptions(existing_prop.description, new_prop.description),
                tags=list(set(existing_prop.tags + new_prop.tags)),
                needs_review=existing_prop.needs_review or new_prop.needs_review,
                variants=existing_prop.variants + new_prop.variants,
                images=existing_prop.images,
            )
        else:
            merged_props.append(new_prop)

    return AssetsCollection(
        characters=merged_chars,
        scenes=merged_scenes,
        props=merged_props,
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