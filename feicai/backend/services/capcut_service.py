"""
剪映草稿导出服务
生成剪映 5.9 兼容的 draft_content.json
"""

import json
import aiosqlite
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

from schemas.shots_schema import ShotsCollection, Shot
from services.shot_service import read_shots
from services.script_service import get_episode_info, get_project_path
from database import DB_PATH


async def get_selected_video_paths(episode_id: int) -> Dict[str, str]:
    """获取每个镜头的选定视频路径"""
    async with aiosqlite.connect(DB_PATH) as db:
        # 查询选定版本的视频路径（优先使用 video_versions.selected）
        cursor = await db.execute(
            """
            SELECT shot_id, video_path FROM video_versions
            WHERE episode_id = ? AND selected = TRUE AND video_path IS NOT NULL
            """,
            [episode_id]
        )
        rows = await cursor.fetchall()

        # 如果没有直接 selected 的版本，从 group_status.selected_version_id 关联查询
        if len(rows) == 0:
            cursor = await db.execute(
                """
                SELECT v.shot_id, v.video_path
                FROM video_versions v
                JOIN group_status g ON v.group_id = g.group_id AND v.episode_id = g.episode_id
                WHERE v.episode_id = ? AND v.id = g.selected_version_id AND v.video_path IS NOT NULL
                """,
                [episode_id]
            )
            rows = await cursor.fetchall()

        return {row[0]: row[1] for row in rows}


async def check_export_status(episode_id: int) -> Tuple[bool, List[str]]:
    """检查导出条件：是否所有组都有选定版本"""
    shots = await read_shots(episode_id)
    if not shots or not shots.shots:
        return False, ["无分镜数据"]

    # 获取所有组 ID
    group_ids = set(s.group_id for s in shots.shots)

    # 查询已选定版本的组
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT group_id FROM group_status
            WHERE episode_id = ? AND selected_version_id IS NOT NULL
            """,
            [episode_id]
        )
        selected_groups = {row[0] for row in await cursor.fetchall()}

        # 如果 group_status 没有记录，检查 video_versions.selected
        if len(selected_groups) == 0:
            cursor = await db.execute(
                """
                SELECT DISTINCT group_id FROM video_versions
                WHERE episode_id = ? AND selected = TRUE
                """,
                [episode_id]
            )
            selected_groups = {row[0] for row in await cursor.fetchall()}

    missing_groups = list(group_ids - selected_groups)
    ready = len(missing_groups) == 0

    return ready, missing_groups


def build_capcut_draft(
    shots: ShotsCollection,
    video_paths: Dict[str, str],
    project_name: str,
    resolution: str = "1080p",
    ratio: str = "9:16"
) -> dict:
    """构建剪映草稿 JSON 结构"""

    # 分辨率配置
    resolution_map = {
        "720p": (720, 1280),
        "1080p": (1080, 1920),
        "4K": (2160, 3840),
    }

    # 比例配置（竖屏优先）
    ratio_map = {
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
    }

    # 获取画布尺寸
    canvas_width, canvas_height = ratio_map.get(ratio, (1080, 1920))

    # 构建 materials.videos 数组
    videos = []
    for shot in shots.shots:
        video_path = video_paths.get(shot.shot_id)
        if video_path:
            # 时间转微秒
            duration_us = int(shot.duration * 1000000)
            videos.append({
                "id": f"material_{shot.shot_id}",
                "path": video_path,
                "duration": duration_us,
            })

    # 构建 tracks[0].segments 数组（按时间排序）
    segments = []
    for shot in sorted(shots.shots, key=lambda s: s.time_range.start_sec):
        video_path = video_paths.get(shot.shot_id)
        if video_path:
            duration_us = int(shot.duration * 1000000)
            start_us = int(shot.time_range.start_sec * 1000000)
            segments.append({
                "material_id": f"material_{shot.shot_id}",
                "source_timerange": {
                    "start": 0,
                    "duration": duration_us,
                },
                "target_timerange": {
                    "start": start_us,
                    "duration": duration_us,
                },
            })

    # 构建完整草稿结构
    draft = {
        "version": "5.9.0",
        "tracks": [
            {
                "type": "video",
                "segments": segments,
            }
        ],
        "materials": {
            "videos": videos,
        },
        "canvas": {
            "width": canvas_width,
            "height": canvas_height,
            "ratio": ratio,
        },
        "metadata": {
            "project_name": project_name,
            "exported_at": datetime.now().isoformat(),
        },
    }

    return draft


async def get_export_output_path(episode_id: int) -> Path:
    """获取导出文件输出路径"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    exports_dir = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    return exports_dir / "draft_content.json"


async def export_capcut_draft(episode_id: int) -> str:
    """导出剪映草稿到文件"""
    # 1. 检查导出条件
    ready, missing = await check_export_status(episode_id)
    if not ready:
        raise ValueError(f"以下组未选定版本: {', '.join(missing)}")

    # 2. 获取分镜数据
    shots = await read_shots(episode_id)
    if not shots:
        raise ValueError("无分镜数据")

    # 3. 获取选定视频路径
    video_paths = await get_selected_video_paths(episode_id)

    # 4. 验证：所有镜头都有视频
    missing_videos = [s.shot_id for s in shots.shots if s.shot_id not in video_paths]
    if missing_videos:
        raise ValueError(f"以下镜头缺少视频: {', '.join(missing_videos)}")

    # 5. 获取项目名
    episode = await get_episode_info(episode_id)
    project_path = await get_project_path(episode["project_id"])
    project_name = Path(project_path).name

    # 6. 构建草稿 JSON
    draft = build_capcut_draft(shots, video_paths, project_name)

    # 7. 写入文件
    output_path = await get_export_output_path(episode_id)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    content = json.dumps(draft, ensure_ascii=False, indent=2)
    output_path.write_text(content, encoding="utf-8")

    return str(output_path)