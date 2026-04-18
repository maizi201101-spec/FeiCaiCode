"""
分镜提示词导出服务
CSV 和 Markdown 格式导出
"""

import csv
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from services.prompt_service import read_prompts, get_prompts_path
from services.shot_service import read_shots, get_shots_path
from services.script_service import get_episode_info, get_project_path
from schemas.prompts_schema import PromptsCollection
from schemas.shots_schema import ShotsCollection


async def export_prompts_csv(
    episode_id: int,
    scope: str = "episode",
    selected_ids: List[str] = None
) -> str:
    """
    导出提示词为 CSV 格式

    Args:
        episode_id: 集数ID
        scope: 导出范围 - episode(整集)/group(选定组)/shot(选定镜头)
        selected_ids: 选定的组ID或镜头ID列表

    Returns:
        CSV 文件路径
    """
    # 获取数据
    prompts = await read_prompts(episode_id)
    shots = await read_shots(episode_id)
    episode = await get_episode_info(episode_id)

    if not episode:
        raise ValueError("集数不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    # 根据范围筛选
    filtered_prompts = []
    if scope == "episode":
        filtered_prompts = prompts.prompts
    elif scope == "group":
        # 筛选选定组的镜头
        selected_groups = set(selected_ids or [])
        filtered_prompts = [
            p for p in prompts.prompts
            if p.group_id in selected_groups
        ]
    elif scope == "shot":
        # 筛选选定的镜头
        selected_shots = set(selected_ids or [])
        filtered_prompts = [
            p for p in prompts.prompts
            if p.shot_id in selected_shots
        ]

    # 构建镜头信息映射
    shot_map = {}
    for shot in shots.shots:
        shot_map[shot.shot_id] = {
            "shot_number": shot.shot_id,
            "shot_type": shot.shot_type or "",
            "shot_size": shot.shot_size or "",
            "camera_move": shot.camera_move or "",
            "screen_text": shot.screen_text or "",
            "speech": shot.speech or "",
            "duration": shot.duration or "",
        }

    # 构建组信息映射
    group_map = {}
    for group in shots.groups:
        group_map[group.group_id] = {
            "total_duration": group.total_duration or "",
            "scene_context": group.scene_context or "",
        }

    # 生成 CSV
    output_dir = Path(project_path) / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csv_path = output_dir / f"prompts_EP{episode['number']:02d}_{timestamp}.csv"

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)

        # 表头
        writer.writerow([
            "组号", "镜号", "类型", "景别", "运镜",
            "时长", "视频提示词", "图片提示词", "台词",
            "已确认", "已编辑"
        ])

        # 数据行
        for prompt in filtered_prompts:
            shot_info = shot_map.get(prompt.shot_id, {})
            group_info = group_map.get(prompt.group_id, {})

            writer.writerow([
                prompt.group_id,
                prompt.shot_id,
                shot_info.get("shot_type", ""),
                shot_info.get("shot_size", ""),
                shot_info.get("camera_move", ""),
                shot_info.get("duration", ""),
                prompt.video_prompt,
                prompt.image_prompt,
                shot_info.get("speech", ""),
                "是" if prompt.confirmed else "否",
                "是" if prompt.edited else "否",
            ])

    return str(csv_path)


async def export_prompts_markdown(
    episode_id: int,
    scope: str = "episode",
    selected_ids: List[str] = None
) -> str:
    """
    导出提示词为 Markdown 格式（按组组织）

    Args:
        episode_id: 集数ID
        scope: 导出范围 - episode(整集)/group(选定组)/shot(选定镜头)
        selected_ids: 选定的组ID或镜头ID列表

    Returns:
        Markdown 文件路径
    """
    # 获取数据
    prompts = await read_prompts(episode_id)
    shots = await read_shots(episode_id)
    episode = await get_episode_info(episode_id)

    if not episode:
        raise ValueError("集数不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    # 根据范围筛选
    filtered_prompts = []
    if scope == "episode":
        filtered_prompts = prompts.prompts
    elif scope == "group":
        selected_groups = set(selected_ids or [])
        filtered_prompts = [
            p for p in prompts.prompts
            if p.group_id in selected_groups
        ]
    elif scope == "shot":
        selected_shots = set(selected_ids or [])
        filtered_prompts = [
            p for p in prompts.prompts
            if p.shot_id in selected_shots
        ]

    # 按组分组
    groups_data = {}
    for prompt in filtered_prompts:
        if prompt.group_id not in groups_data:
            groups_data[prompt.group_id] = []
        groups_data[prompt.group_id].append(prompt)

    # 构建镜头信息映射
    shot_map = {}
    for shot in shots.shots:
        shot_map[shot.shot_id] = shot

    # 构建组信息映射
    group_map = {}
    for group in shots.groups:
        group_map[group.group_id] = group

    # 生成 Markdown
    output_dir = Path(project_path) / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    md_path = output_dir / f"prompts_EP{episode['number']:02d}_{timestamp}.md"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 第 {episode['number']} 集提示词导出\n\n")
        f.write(f"导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"共 {len(groups_data)} 个组，{len(filtered_prompts)} 个镜头\n\n")
        f.write("---\n\n")

        # 按组输出
        for group_id in sorted(groups_data.keys()):
            group = group_map.get(group_id)
            group_prompts = groups_data[group_id]

            f.write(f"## {group_id}\n\n")

            if group:
                f.write(f"- 组时长：{group.total_duration or '未知'}秒\n")
                if group.scene_context:
                    f.write(f"- 场景：{group.scene_context}\n")
                f.write("\n")

            for prompt in group_prompts:
                shot = shot_map.get(prompt.shot_id)

                f.write(f"### {prompt.shot_id}\n\n")

                if shot:
                    f.write(f"- 类型：{shot.shot_type or '未知'}\n")
                    f.write(f"- 景别：{shot.shot_size or '未知'}\n")
                    f.write(f"- 运镜：{shot.camera_move or '未知'}\n")
                    if shot.duration:
                        f.write(f"- 时长：{shot.duration}秒\n")
                    if shot.speech:
                        f.write(f"- 台词：{shot.speech}\n")
                    f.write("\n")

                f.write("**视频提示词：**\n\n")
                f.write(f"{prompt.video_prompt}\n\n")

                f.write("**图片提示词：**\n\n")
                f.write(f"{prompt.image_prompt}\n\n")

                status_tags = []
                if prompt.confirmed:
                    status_tags.append("✅ 已确认")
                if prompt.edited:
                    status_tags.append("📝 已编辑")
                if status_tags:
                    f.write(f"*{', '.join(status_tags)}*\n\n")

                f.write("---\n\n")

    return str(md_path)


async def export_all_episodes_prompts_csv(project_id: int) -> str:
    """
    导出全集提示词为 CSV 格式

    Args:
        project_id: 项目ID

    Returns:
        CSV 文件路径
    """
    import aiosqlite
    from database import DB_PATH

    # 获取所有集数
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, number FROM episodes WHERE project_id = ? ORDER BY number",
            (project_id,)
        )
        episodes = await cursor.fetchall()

    project_path = await get_project_path(project_id)
    if not project_path:
        raise ValueError("项目路径不存在")

    # 收集所有提示词
    all_prompts_data = []

    for episode in episodes:
        episode_id = episode["id"]
        episode_number = episode["number"]

        try:
            prompts = await read_prompts(episode_id)
            shots = await read_shots(episode_id)

            shot_map = {}
            for shot in shots.shots:
                shot_map[shot.shot_id] = shot

            for prompt in prompts.prompts:
                shot = shot_map.get(prompt.shot_id)
                all_prompts_data.append({
                    "episode": episode_number,
                    "group_id": prompt.group_id,
                    "shot_id": prompt.shot_id,
                    "shot_type": shot.shot_type if shot else "",
                    "shot_size": shot.shot_size if shot else "",
                    "camera_move": shot.camera_move if shot else "",
                    "duration": shot.duration if shot else "",
                    "video_prompt": prompt.video_prompt,
                    "image_prompt": prompt.image_prompt,
                    "speech": shot.speech if shot else "",
                    "confirmed": prompt.confirmed,
                    "edited": prompt.edited,
                })
        except Exception as e:
            print(f"跳过集 {episode_number}: {e}")
            continue

    # 生成 CSV
    output_dir = Path(project_path) / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csv_path = output_dir / f"prompts_all_episodes_{timestamp}.csv"

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)

        writer.writerow([
            "集号", "组号", "镜号", "类型", "景别", "运镜",
            "时长", "视频提示词", "图片提示词", "台词",
            "已确认", "已编辑"
        ])

        for data in all_prompts_data:
            writer.writerow([
                data["episode"],
                data["group_id"],
                data["shot_id"],
                data["shot_type"],
                data["shot_size"],
                data["camera_move"],
                data["duration"],
                data["video_prompt"],
                data["image_prompt"],
                data["speech"],
                "是" if data["confirmed"] else "否",
                "是" if data["edited"] else "否",
            ])

    return str(csv_path)