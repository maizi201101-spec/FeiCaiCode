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


async def plan_shots_by_ai(episode_id: int) -> ShotsCollection:
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

    # 加载装扮注册表
    from services.costume_registry_service import CostumeRegistryService
    registry = CostumeRegistryService.load_registry(project_path)
    costume_context = CostumeRegistryService.to_llm_context(registry)

    # 读取激活的分镜风格预设（无则使用默认角色设定）
    project_id = episode["project_id"]
    storyboard_style = await get_active_preset_content(project_id, PresetCategory.STORYBOARD_STYLE)
    default_role = "你是一个专业的影视分镜规划师，负责将剧本内容拆解为结构化分镜数据。"
    system_prompt = storyboard_style if storyboard_style else default_role
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
    prompt = "## 剧本内容\n" + script_content[:6000]
    if costume_context:
        prompt += "\n\n" + costume_context

    result = await call_llm(prompt, system_prompt, temperature=0.3, max_tokens=8000)

    # 解析 JSON
    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        raise ValueError("LLM 未返回有效的 JSON 结果")

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析失败: {e}")

    # 构建 ShotsCollection
    shots = []
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

            shot = Shot(
                shot_id=s["shot_id"],
                group_id=s["group_id"],
                scene_id=s.get("scene_id", ""),
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
            )
            shots.append(shot)
        except Exception as e:
            print(f"镜头解析失败: {e}")
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
        CostumeRegistryService.upsert_from_asset_refs(project_path, episode_id_str, asset_refs_list)

    # 生成 storyboard.md
    await generate_storyboard_md(episode_id, collection)

    return collection


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

    # 应用更新
    current_shot = collection.shots[shot_index]
    update_data = updates.model_dump(exclude_none=True)

    updated_shot = Shot(
        shot_id=current_shot.shot_id,
        group_id=current_shot.group_id,
        scene_id=current_shot.scene_id,
        time_range=current_shot.time_range,
        duration=current_shot.duration,
        shot_type=update_data.get("shot_type", current_shot.shot_type),
        shot_size=update_data.get("shot_size", current_shot.shot_size),
        camera_move=update_data.get("camera_move", current_shot.camera_move),
        assets=update_data.get("assets", current_shot.assets),
        asset_refs=current_shot.asset_refs,
        frame_action=update_data.get("frame_action", current_shot.frame_action),
        lighting=update_data.get("lighting", current_shot.lighting),
        screen_text=update_data.get("screen_text", current_shot.screen_text),
        speech=update_data.get("speech", current_shot.speech),
        time_of_day=update_data.get("time_of_day", current_shot.time_of_day),
    )

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

    # 更新镜头的 group_id
    current_shot = collection.shots[shot_index]
    updated_shot = Shot(
        shot_id=current_shot.shot_id,
        group_id=new_group_id,
        scene_id=current_shot.scene_id,
        time_range=current_shot.time_range,
        duration=current_shot.duration,
        shot_type=current_shot.shot_type,
        shot_size=current_shot.shot_size,
        camera_move=current_shot.camera_move,
        assets=current_shot.assets,
        asset_refs=current_shot.asset_refs,
        frame_action=current_shot.frame_action,
        lighting=current_shot.lighting,
        screen_text=current_shot.screen_text,
        speech=current_shot.speech,
        time_of_day=current_shot.time_of_day,
    )
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