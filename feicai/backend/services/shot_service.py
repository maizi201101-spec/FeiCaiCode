"""
分镜规划服务
shots.json 和 storyboard.md 的读写、AI 分镜规划、CRUD 操作
"""

import json
import aiosqlite
from pathlib import Path
from typing import Optional
import re

from schemas.shots_schema import (
    Shot, ShotGroup, ShotsCollection, ShotUpdate, GroupUpdate,
    ShotType, ShotSize, CameraMove, SpeechLine, TimeRange,
    AssetRefs, CharacterRef,
    get_duration_color
)
from services.llm_client import call_llm
from services.script_service import get_episode_info, get_project_path
from services.asset_service import read_assets
from services.preset_service import get_active_preset_content, PresetCategory

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def get_shots_path(episode_id: int) -> Optional[Path]:
    """获取 episodes/EP{num}/shots.json 路径"""
    episode = await get_episode_info(episode_id)
    if not episode:
        return None

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        return None

    ep_dir = Path(project_path) / "episodes" / f"EP{episode['number']:02d}"
    ep_dir.mkdir(parents=True, exist_ok=True)
    return ep_dir / "shots.json"


async def read_shots(episode_id: int) -> ShotsCollection:
    """读取 shots.json"""
    shots_path = await get_shots_path(episode_id)
    if not shots_path or not shots_path.exists():
        return ShotsCollection(episode_id=episode_id)

    content = shots_path.read_text(encoding="utf-8")
    data = json.loads(content)

    shots = []
    for s in data.get("shots", []):
        # 解析 asset_refs
        asset_refs = None
        if "asset_refs" in s and s["asset_refs"]:
            asset_refs_data = s["asset_refs"]
            asset_refs = AssetRefs(
                characters=[CharacterRef(**c) for c in asset_refs_data.get("characters", [])],
                scenes=asset_refs_data.get("scenes", []),
                props=asset_refs_data.get("props", []),
                shot_annotations=asset_refs_data.get("shot_annotations", "")
            )

        shots.append(Shot(
            shot_id=s["shot_id"],
            group_id=s["group_id"],
            scene_id=s["scene_id"],
            time_range=TimeRange(**s["time_range"]),
            duration=s["duration"],
            shot_type=ShotType(s["shot_type"]),
            shot_size=ShotSize(s["shot_size"]),
            camera_move=CameraMove(s["camera_move"]),
            assets=s.get("assets", []),
            asset_refs=asset_refs,
            frame_action=s["frame_action"],
            lighting=s.get("lighting"),
            screen_text=s.get("screen_text"),
            speech=[SpeechLine(**sp) for sp in s.get("speech", [])],
            time_of_day=s.get("time_of_day"),
        ))

    groups = [
        ShotGroup(
            group_id=g["group_id"],
            shots=g.get("shots", []),
            total_duration=g.get("total_duration", 0.0),
            scene_context=g.get("scene_context", ""),
        )
        for g in data.get("groups", [])
    ]

    return ShotsCollection(episode_id=episode_id, shots=shots, groups=groups)


async def write_shots(episode_id: int, shots: ShotsCollection) -> None:
    """写入 shots.json"""
    shots_path = await get_shots_path(episode_id)
    if not shots_path:
        raise ValueError("无法获取分镜文件路径")

    shots_path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(shots.model_dump(), ensure_ascii=False, indent=2)
    shots_path.write_text(content, encoding="utf-8")


async def generate_storyboard_md(episode_id: int, shots: ShotsCollection) -> str:
    """生成 storyboard.md Markdown 分镜表"""
    episode = await get_episode_info(episode_id)
    if not episode:
        return ""

    lines = [
        f"# EP{episode['number']:02d} 分镜表",
        "",
        "| 编号 | 时段 | 组 | 类型 | 景别 | 运镜 | 画面内容 | 台词 |",
        "|------|------|----|----|------|------|----------|------|",
    ]

    for shot in shots.shots:
        time_str = f"{shot.time_range.start_sec:.1f}-{shot.time_range.end_sec:.1f}s"
        speech_str = "; ".join([f"{sp.speaker}: {sp.text}" for sp in shot.speech]) or "-"

        # 组时长颜色标记
        group = next((g for g in shots.groups if g.group_id == shot.group_id), None)
        if group:
            color = get_duration_color(group.total_duration)
            group_str = f"{shot.group_id} ({color})"
        else:
            group_str = shot.group_id

        # 截断长文本
        frame_short = shot.frame_action[:30] + "..." if len(shot.frame_action) > 30 else shot.frame_action
        speech_short = speech_str[:30] + "..." if len(speech_str) > 30 else speech_str

        lines.append(
            f"| {shot.shot_id} | {time_str} | {group_str} | {shot.shot_type.value} | "
            f"{shot.shot_size.value} | {shot.camera_move.value} | {frame_short} | {speech_short} |"
        )

    md_content = "\n".join(lines)

    # 写入文件
    shots_path = await get_shots_path(episode_id)
    if shots_path:
        md_path = shots_path.parent / "storyboard.md"
        md_path.write_text(md_content, encoding="utf-8")

    return md_content


async def plan_shots_by_ai(episode_id: int) -> tuple[ShotsCollection, list[str]]:
    """调用 LLM 分析剧本，生成分镜（含 asset_refs）并积累装扮注册表"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    # 读取剧本
    script_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "script.txt"
    if not script_file.exists():
        raise ValueError("剧本文件不存在")

    script_content = script_file.read_text(encoding="utf-8")

    # 读取上一集梗概（如果存在）作为前情提要
    previous_summary = ""
    if episode['number'] > 1:
        prev_ep_num = episode['number'] - 1
        prev_summary_file = Path(project_path) / "episodes" / f"EP{prev_ep_num:02d}" / "summary.txt"
        if prev_summary_file.exists():
            try:
                previous_summary = prev_summary_file.read_text(encoding="utf-8").strip()
            except Exception:
                pass  # 读取失败时忽略

    # 加载装扮注册表，按集过滤（只注入本集剧本中出现的角色）
    from services.costume_registry_service import CostumeRegistryService
    registry = CostumeRegistryService.load_registry(project_path)

    # 从剧本中提取角色名集合（匹配 2-4 字中文姓名，后跟对话标记冒号/「）
    character_names: set[str] = set()
    name_pattern = r'([一-龥]{2,4})(?:：|:|「)'
    for match in re.finditer(name_pattern, script_content):
        character_names.add(match.group(1))

    costume_context = CostumeRegistryService.to_llm_context_filtered(registry, character_names)

    # 读取激活的分镜风格预设（无则使用默认角色设定）
    project_id = episode["project_id"]
    storyboard_style = await get_active_preset_content(project_id, PresetCategory.STORYBOARD_STYLE)
    default_role = "你是一个专业的影视分镜规划师，负责将剧本内容拆解为结构化分镜数据。"
    system_prompt = storyboard_style if storyboard_style else default_role

    # 注入前情提要（如果存在）
    if previous_summary:
        system_prompt += f"\n\n## 前情提要\n{previous_summary}\n\n请在分镜规划时考虑上集剧情的延续性。"

    system_prompt += """

## 分镜规划规则
1. 以「镜头组」为顶层结构，每组为一个视频生成单元
2. 每组总时长 ≤15 秒（15-17秒可保留，超过17秒需拆分）
3. 组内镜头保持连续性（人物/空间/道具/状态连续）
4. 场景切换、动作链完成后应断组
5. 单镜头超过15秒不强制拆分，单独输出

## 资产引用规则
每个镜头必须输出 asset_refs 字段，包含：
- characters: [{name: "角色名", costume: "装扮词"}] — 使用装扮注册表中的装扮词，不创造新称呼
- scenes: ["场景名"] — 字符串数组，场景显著变化时使用不同场景名（如「书房」和「焚毁的书房」）
- props: ["道具名"] — 字符串数组
- shot_annotations: "" — 镜头级一次性外观变化（用 [] 括号格式，如「[张三脸上有血迹]」）

## 枚举值参考
镜头类型: 空境、对话、行动冲突、打斗、调度
景别: 大远景、远景、全景、中景、中近景、近景、特写
运镜: 固定、缓慢推进、快速推进、缓慢拉开、快速拉开、缓慢横移、缓慢左摇、缓慢右摇、跟随、手持跟随、缓慢升起、缓慢下降、缓慢环绕、快速环绕、快速摇摄

## 输出格式（严格 JSON，不要添加任何额外文字）
{
  "shots": [
    {
      "shot_id": "01",
      "group_id": "G01",
      "scene_id": "",
      "time_range": {"start_sec": 0, "end_sec": 5.2},
      "duration": 5.2,
      "shot_type": "对话",
      "shot_size": "中景",
      "camera_move": "固定",
      "asset_refs": {
        "characters": [{"name": "张三", "costume": "书生装"}],
        "scenes": ["书房"],
        "props": ["毛笔"],
        "shot_annotations": ""
      },
      "frame_action": "画面描述",
      "lighting": "光影描述",
      "speech": [{"type": "dialogue", "speaker": "角色名", "text": "台词"}]
    }
  ],
  "groups": [
    {
      "group_id": "G01",
      "shots": ["01", "02"],
      "total_duration": 10.5,
      "scene_context": "场景说明"
    }
  ]
}"""

    # LLM User Prompt（仅包含动态数据）
    script_truncated = script_content[:12000]
    prompt = "## 剧本内容\n" + script_truncated
    if len(script_content) > 12000:
        prompt += f"\n\n[注意：剧本已截断，仅处理前12000字符，原文共{len(script_content)}字符]"
    if costume_context:
        prompt += "\n\n" + costume_context

    result = await call_llm(prompt, system_prompt, temperature=0.3, max_tokens=32000, project_id=project_id)

    # 解析 JSON
    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        raise ValueError("LLM 未返回有效的 JSON 结果")

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析失败: {e}")

    # 枚举容错映射：LLM 输出非标准值时映射到最近有效值
    _SHOT_TYPE_MAP = {
        "空景": "空境", "空镜": "空境",
        "对白": "对话", "台词": "对话",
        "行动": "行动冲突", "冲突": "行动冲突",
        "战斗": "打斗", "格斗": "打斗",
        "移动": "调度", "走位": "调度",
    }
    _SHOT_SIZE_MAP = {
        "超远景": "大远景", "航拍": "大远景",
        "中远景": "远景",
        "全身": "全景",
        "半身": "中景", "腰景": "中景",
        "中近": "中近景",
        "胸景": "近景", "肩景": "近景",
        "脸部": "特写", "大特写": "特写", "极特写": "特写",
    }
    _CAMERA_MAP = {
        "静止": "固定", "静": "固定",
        "推": "缓慢推进", "推进": "缓慢推进",
        "拉": "缓慢拉开", "拉开": "缓慢拉开",
        "横移": "缓慢横移", "平移": "缓慢横移",
        "左摇": "缓慢左摇", "右摇": "缓慢右摇",
        "跟拍": "跟随",
        "手持": "手持跟随",
        "升": "缓慢升起", "降": "缓慢下降",
        "环绕": "缓慢环绕", "旋转": "缓慢环绕",
        "摇摄": "快速摇摄",
    }

    def _coerce_enum(value: str, enum_cls, fallback_map: dict, default: str):
        """容错：先尝试直接匹配，再查 fallback_map，最后用 default"""
        try:
            return enum_cls(value)
        except ValueError:
            mapped = fallback_map.get(value)
            if mapped:
                try:
                    return enum_cls(mapped)
                except ValueError:
                    pass
            return enum_cls(default)

    # 构建 ShotsCollection
    shots = []
    parse_warnings = []
    for s in data.get("shots", []):
        try:
            # 解析 asset_refs
            asset_refs = None
            if "asset_refs" in s:
                asset_refs_data = s["asset_refs"]
                asset_refs = AssetRefs(
                    characters=[CharacterRef(**c) for c in asset_refs_data.get("characters", [])],
                    scenes=asset_refs_data.get("scenes", []),
                    props=asset_refs_data.get("props", []),
                    shot_annotations=asset_refs_data.get("shot_annotations", "")
                )

            shot_type_raw = s.get("shot_type", "对话")
            shot_size_raw = s.get("shot_size", "中景")
            camera_raw = s.get("camera_move", "固定")

            shot = Shot(
                shot_id=s["shot_id"],
                group_id=s["group_id"],
                scene_id=s.get("scene_id", ""),
                time_range=TimeRange(**s["time_range"]),
                duration=s["duration"],
                shot_type=_coerce_enum(shot_type_raw, ShotType, _SHOT_TYPE_MAP, "对话"),
                shot_size=_coerce_enum(shot_size_raw, ShotSize, _SHOT_SIZE_MAP, "中景"),
                camera_move=_coerce_enum(camera_raw, CameraMove, _CAMERA_MAP, "固定"),
                assets=s.get("assets", []),
                asset_refs=asset_refs,
                frame_action=s["frame_action"],
                lighting=s.get("lighting"),
                screen_text=s.get("screen_text"),
                speech=[SpeechLine(**sp) for sp in s.get("speech", [])],
                time_of_day=s.get("time_of_day"),
            )
            shots.append(shot)
        except Exception as e:
            warn_msg = f"镜头 {s.get('shot_id', '?')} 解析失败: {e}"
            print(warn_msg)
            parse_warnings.append(warn_msg)
            continue

    groups = []
    for g in data.get("groups", []):
        try:
            group = ShotGroup(
                group_id=g["group_id"],
                shots=g.get("shots", []),
                total_duration=g.get("total_duration", 0.0),
                scene_context=g.get("scene_context", ""),
            )
            groups.append(group)
        except Exception as e:
            print(f"镜头组解析失败: {e}")
            continue

    collection = ShotsCollection(episode_id=episode_id, shots=shots, groups=groups)

    # 写入文件
    await write_shots(episode_id, collection)

    # 积累装扮注册表
    asset_refs_list = [shot.asset_refs.model_dump() if shot.asset_refs else None for shot in shots]
    asset_refs_list = [ref for ref in asset_refs_list if ref]  # 过滤 None
    if asset_refs_list:
        episode_number = episode['number']
        episode_id_str = f"EP{episode_number:02d}"
        await CostumeRegistryService.upsert_from_asset_refs(project_path, episode_id_str, asset_refs_list)

    # 生成 storyboard.md
    await generate_storyboard_md(episode_id, collection)

    return collection, parse_warnings


async def update_shot_field(episode_id: int, shot_id: str, updates: ShotUpdate) -> Optional[Shot]:
    """更新单个镜头字段"""
    collection = await read_shots(episode_id)

    shot_index = None
    for i, shot in enumerate(collection.shots):
        if shot.shot_id == shot_id:
            shot_index = i
            break

    if shot_index is None:
        return None

    # 应用更新（model_copy 保留所有未修改字段，包括 asset_refs / asset_bindings）
    # 用 __iter__ 迭代保留嵌套 Pydantic 模型实例，避免 model_dump 将其转为 dict 导致类型退化
    current_shot = collection.shots[shot_index]
    update_data = {k: v for k, v in updates if v is not None}
    updated_shot = current_shot.model_copy(update=update_data)

    collection.shots[shot_index] = updated_shot
    await write_shots(episode_id, collection)

    return updated_shot


async def update_shot_group_membership(episode_id: int, shot_id: str, new_group_id: str) -> Optional[Shot]:
    """调整镜头归组"""
    collection = await read_shots(episode_id)

    # 找到镜头
    shot_index = None
    old_group_id = None
    for i, shot in enumerate(collection.shots):
        if shot.shot_id == shot_id:
            shot_index = i
            old_group_id = shot.group_id
            break

    if shot_index is None:
        return None

    # 更新镜头的 group_id（model_copy 保留所有其他字段，包括 asset_refs / asset_bindings）
    current_shot = collection.shots[shot_index]
    updated_shot = current_shot.model_copy(update={"group_id": new_group_id})
    collection.shots[shot_index] = updated_shot

    # 更新旧组的 shots 列表
    if old_group_id:
        for group in collection.groups:
            if group.group_id == old_group_id:
                group.shots = [s for s in group.shots if s != shot_id]
                # 重算时长
                group.total_duration = sum(
                    collection.shots[i].duration
                    for i, s in enumerate(collection.shots)
                    if s.group_id == old_group_id
                )

    # 更新新组的 shots 列表
    new_group = None
    for group in collection.groups:
        if group.group_id == new_group_id:
            new_group = group
            break

    if new_group:
        if shot_id not in new_group.shots:
            new_group.shots.append(shot_id)
        # 重算时长
        new_group.total_duration = sum(
            shot.duration for shot in collection.shots if shot.group_id == new_group_id
        )
    else:
        # 创建新组
        new_group = ShotGroup(
            group_id=new_group_id,
            shots=[shot_id],
            total_duration=current_shot.duration,
            scene_context="",
        )
        collection.groups.append(new_group)

    await write_shots(episode_id, collection)

    return updated_shot


async def recalculate_group_duration(episode_id: int, group_id: str) -> float:
    """重新计算组时长"""
    collection = await read_shots(episode_id)

    total = sum(shot.duration for shot in collection.shots if shot.group_id == group_id)

    for group in collection.groups:
        if group.group_id == group_id:
            group.total_duration = total
            break

    await write_shots(episode_id, collection)

    return total

async def resolve_asset_bindings(episode_id: int) -> dict:
    """
    自动坍缩：将 shot.asset_refs.characters[].costume 解析到 variant_id，写入 asset_bindings

    返回统计信息：
    {
        "total_shots": int,
        "resolved_count": int,
        "exact_matches": int,
        "fuzzy_matches": int,
        "unresolved": [{"shot_id": str, "character": str, "costume": str}]
    }
    """
    from schemas.shots_schema import AssetBinding

    collection = await read_shots(episode_id)
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError("集数不存在")

    # 读取资产库
    assets_collection = await read_assets(episode["project_id"])

    stats = {
        "total_shots": len(collection.shots),
        "resolved_count": 0,
        "exact_matches": 0,
        "fuzzy_matches": 0,
        "unresolved": []
    }

    for shot in collection.shots:
        if not shot.asset_refs or not shot.asset_refs.characters:
            continue

        # 清空旧的 asset_bindings（重新生成）
        shot.asset_bindings = []

        for char_ref in shot.asset_refs.characters:
            # 查找对应的 Character 资产
            character = next(
                (c for c in assets_collection.characters if c.name == char_ref.name),
                None
            )

            if not character:
                stats["unresolved"].append({
                    "shot_id": shot.shot_id,
                    "character": char_ref.name,
                    "costume": char_ref.costume,
                    "reason": "角色不存在于资产库"
                })
                continue

            # 如果没有 costume 或没有 variants，绑定到 base
            if not char_ref.costume or not character.variants:
                shot.asset_bindings.append(AssetBinding(
                    asset_id=character.asset_id,
                    variant_id=None,
                    confidence=1.0,
                    needs_review=False
                ))
                stats["resolved_count"] += 1
                stats["exact_matches"] += 1
                continue

            # 尝试精确匹配
            variant = next(
                (v for v in character.variants if v.variant_name == char_ref.costume),
                None
            )

            if variant:
                shot.asset_bindings.append(AssetBinding(
                    asset_id=character.asset_id,
                    variant_id=variant.variant_id,
                    confidence=1.0,
                    needs_review=False
                ))
                stats["resolved_count"] += 1
                stats["exact_matches"] += 1
                continue

            # 尝试包含匹配（fuzzy）
            variant = next(
                (v for v in character.variants
                 if char_ref.costume in v.variant_name or v.variant_name in char_ref.costume),
                None
            )

            if variant:
                shot.asset_bindings.append(AssetBinding(
                    asset_id=character.asset_id,
                    variant_id=variant.variant_id,
                    confidence=0.8,
                    needs_review=True  # fuzzy match 需要人工审核
                ))
                stats["resolved_count"] += 1
                stats["fuzzy_matches"] += 1
            else:
                # 无法匹配，绑定到 base 并标记需要审核
                shot.asset_bindings.append(AssetBinding(
                    asset_id=character.asset_id,
                    variant_id=None,
                    confidence=0.5,
                    needs_review=True
                ))
                stats["unresolved"].append({
                    "shot_id": shot.shot_id,
                    "character": char_ref.name,
                    "costume": char_ref.costume,
                    "reason": f"未找到匹配的 variant（可选：{[v.variant_name for v in character.variants]}）"
                })

    await write_shots(episode_id, collection)

    return stats
