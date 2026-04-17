"""
视频生成服务
视频版本管理、生成任务创建、执行生成、质检状态更新
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import aiosqlite

from schemas.video_schema import VideoVersion, VideoVersionCreate, VideoStatusUpdate
from services.jimeng_cli import generate_video, DreaminaCLIError
from services.script_service import get_episode_info, get_project_path
from services.prompt_service import read_prompts
from database import DB_PATH


async def get_video_versions(episode_id: int, shot_id: str) -> List[VideoVersion]:
    """获取镜头的视频版本列表"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM video_versions WHERE episode_id = ? AND shot_id = ? ORDER BY version_number",
            [episode_id, shot_id]
        )
        rows = await cursor.fetchall()

    columns = [desc[0] for desc in cursor.description]
    versions = []
    for row in rows:
        data = dict(zip(columns, row))
        data["reference_images"] = json.loads(data.get("reference_images") or "[]")
        versions.append(VideoVersion(**data))
    return versions


async def get_episode_videos(episode_id: int) -> List[VideoVersion]:
    """获取全集所有视频版本"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM video_versions WHERE episode_id = ? ORDER BY group_id, shot_id, version_number",
            [episode_id]
        )
        rows = await cursor.fetchall()

    columns = [desc[0] for desc in cursor.description]
    versions = []
    for row in rows:
        data = dict(zip(columns, row))
        data["reference_images"] = json.loads(data.get("reference_images") or "[]")
        versions.append(VideoVersion(**data))
    return versions


async def create_video_version(episode_id: int, create: VideoVersionCreate) -> int:
    """创建视频版本记录"""
    version_number = await get_next_version_number(episode_id, create.shot_id)
    now = datetime.now().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO video_versions (
                shot_id, episode_id, group_id, version_number, status,
                video_prompt, final_prompt, reference_images, anchor_declaration,
                model, duration, resolution, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                create.shot_id, episode_id, create.group_id, version_number, "pending",
                create.video_prompt, create.final_prompt,
                json.dumps(create.reference_images), create.anchor_declaration,
                create.model, create.duration, create.resolution, now, now
            ]
        )
        await db.commit()
        return cursor.lastrowid


async def update_video_status(version_id: int, status: str, video_path: Optional[str] = None, error: Optional[str] = None):
    """更新视频版本生成状态"""
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE video_versions SET status = ?, video_path = ?, error_message = ?, updated_at = ?
            WHERE id = ?
            """,
            [status, video_path, error, now, version_id]
        )
        await db.commit()


async def update_video_qc_status(version_id: int, qc_status: str, selected: bool = False):
    """更新质检状态"""
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE video_versions SET qc_status = ?, selected = ?, updated_at = ?
            WHERE id = ?
            """,
            [qc_status, selected, now, version_id]
        )
        await db.commit()


async def get_next_version_number(episode_id: int, shot_id: str) -> int:
    """获取下一个版本号"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT MAX(version_number) FROM video_versions WHERE episode_id = ? AND shot_id = ?",
            [episode_id, shot_id]
        )
        row = await cursor.fetchone()
        return (row[0] or 0) + 1


def build_video_path(project_name: str, episode_number: int, shot_id: str, version: int) -> str:
    """构造视频文件路径"""
    filename = f"{project_name}_EP{episode_number:02d}_{shot_id}_v{version}.mp4"
    return f"videos/{filename}"


async def get_videos_output_dir(episode_id: int) -> Path:
    """获取视频输出目录"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    videos_dir = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    return videos_dir


async def execute_video_generation(version_id: int, episode_id: int, project_name: str):
    """执行视频生成（BackgroundTasks 调用）"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT * FROM video_versions WHERE id = ?", [version_id])
        row = await cursor.fetchone()
        columns = [desc[0] for desc in cursor.description]
        version_data = dict(zip(columns, row))

    await update_video_status(version_id, "generating")

    try:
        episode = await get_episode_info(episode_id)
        output_dir = await get_videos_output_dir(episode_id)

        filename = f"{project_name}_EP{episode['number']:02d}_{version_data['shot_id']}_v{version_data['version_number']}.mp4"
        output_path = output_dir / filename

        reference_images = json.loads(version_data.get("reference_images") or "[]")

        video_path = await generate_video(
            prompt=version_data["final_prompt"] or version_data["video_prompt"],
            output_path=output_path,
            reference_images=reference_images,
            anchor_declaration=version_data.get("anchor_declaration") or "",
            model=version_data.get("model", "seedance2.0"),
            duration=version_data.get("duration", 4),
            resolution=version_data.get("resolution", "1080p"),
            timeout=300,
        )

        await update_video_status(version_id, "completed", video_path=video_path)

    except DreaminaCLIError as e:
        await update_video_status(version_id, "failed", error=str(e))
    except Exception as e:
        await update_video_status(version_id, "failed", error=str(e))


async def select_video_version(version_id: int):
    """选定版本"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT episode_id, shot_id FROM video_versions WHERE id = ?", [version_id])
        row = await cursor.fetchone()
        if not row:
            return
        episode_id, shot_id = row

        # 先取消其他版本的选定
        await db.execute(
            "UPDATE video_versions SET selected = FALSE WHERE episode_id = ? AND shot_id = ?",
            [episode_id, shot_id]
        )
        # 选定当前版本
        now = datetime.now().isoformat()
        await db.execute(
            "UPDATE video_versions SET selected = TRUE, qc_status = 'approved', updated_at = ? WHERE id = ?",
            [now, version_id]
        )
        await db.commit()