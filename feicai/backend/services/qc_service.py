"""
质检服务
组级别质检数据聚合、状态更新、返修镜头查询
"""

import json
from datetime import datetime
from typing import Optional, List
import aiosqlite

from schemas.qc_schema import GroupQCData, GroupStatus, GroupStatusUpdate, VideoVersionSummary
from services.shot_service import read_shots
from database import DB_PATH


async def get_episode_qc_data(episode_id: int) -> List[GroupQCData]:
    """获取集数所有组的质检数据（含视频版本聚合）"""
    # 获取分镜数据（计算组时长）
    shots_collection = await read_shots(episode_id)
    if not shots_collection:
        return []

    # 按组聚合镜头时长
    group_durations: dict[str, float] = {}
    for shot in shots_collection.shots:
        gid = shot.group_id
        group_durations[gid] = group_durations.get(gid, 0) + shot.duration

    # 获取组质检状态
    group_status_map: dict[str, GroupStatus] = {}
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM group_status WHERE episode_id = ?",
            [episode_id]
        )
        rows = await cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        for row in rows:
            data = dict(zip(columns, row))
            group_status_map[data["group_id"]] = GroupStatus(**data)

    # 获取全集视频版本
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id, shot_id, group_id, version_number, status, video_path, qc_status, selected, created_at FROM video_versions WHERE episode_id = ? ORDER BY group_id, shot_id, version_number",
            [episode_id]
        )
        rows = await cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

    # 按组聚合视频版本
    group_videos: dict[str, List[VideoVersionSummary]] = {}
    for row in rows:
        data = dict(zip(columns, row))
        gid = data["group_id"]
        if gid not in group_videos:
            group_videos[gid] = []
        group_videos[gid].append(VideoVersionSummary(**data))

    # 构建返回数据
    result: List[GroupQCData] = []
    for gid in sorted(group_durations.keys()):
        status = group_status_map.get(gid)
        result.append(GroupQCData(
            group_id=gid,
            total_duration=group_durations[gid],
            status=status.status if status else "pending",
            selected_version_id=status.selected_version_id if status else None,
            revision_note=status.revision_note if status else None,
            videos=group_videos.get(gid, [])
        ))

    return result


async def update_group_status(episode_id: int, group_id: str, update: GroupStatusUpdate) -> GroupStatus:
    """更新组质检状态"""
    now = datetime.now().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        # 检查是否存在
        cursor = await db.execute(
            "SELECT id FROM group_status WHERE episode_id = ? AND group_id = ?",
            [episode_id, group_id]
        )
        row = await cursor.fetchone()

        if row:
            # 更新
            update_fields = []
            update_values = []
            if update.status:
                update_fields.append("status = ?")
                update_values.append(update.status)
            if update.selected_version_id:
                update_fields.append("selected_version_id = ?")
                update_values.append(update.selected_version_id)
            if update.revision_note:
                update_fields.append("revision_note = ?")
                update_values.append(update.revision_note)

            update_fields.append("updated_at = ?")
            update_values.append(now)

            await db.execute(
                f"UPDATE group_status SET {', '.join(update_fields)} WHERE episode_id = ? AND group_id = ?",
                [*update_values, episode_id, group_id]
            )
        else:
            # 创建
            await db.execute(
                """
                INSERT INTO group_status (episode_id, group_id, status, selected_version_id, revision_note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [episode_id, group_id, update.status or "pending", update.selected_version_id, update.revision_note, now, now]
            )

        await db.commit()

        # 返回更新后的状态
        cursor = await db.execute(
            "SELECT * FROM group_status WHERE episode_id = ? AND group_id = ?",
            [episode_id, group_id]
        )
        row = await cursor.fetchone()
        columns = [desc[0] for desc in cursor.description]
        return GroupStatus(**dict(zip(columns, row)))


async def select_group_version(episode_id: int, group_id: str, version_id: int):
    """选定组的版本"""
    now = datetime.now().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        # 更新组状态
        await db.execute(
            """
            INSERT INTO group_status (episode_id, group_id, status, selected_version_id, created_at, updated_at)
            VALUES (?, ?, 'approved', ?, ?, ?)
            ON CONFLICT(episode_id, group_id) DO UPDATE SET
                status = 'approved',
                selected_version_id = ?,
                updated_at = ?
            """,
            [episode_id, group_id, version_id, now, now, version_id, now]
        )

        # 同时更新 video_versions 的 selected 字段
        # 先取消该组所有版本的 selected
        await db.execute(
            """
            UPDATE video_versions SET selected = FALSE
            WHERE episode_id = ? AND group_id = ?
            """,
            [episode_id, group_id]
        )
        # 选定指定版本
        await db.execute(
            "UPDATE video_versions SET selected = TRUE, qc_status = 'approved', updated_at = ? WHERE id = ?",
            [now, version_id]
        )

        await db.commit()


async def get_revision_shot_ids(episode_id: int) -> List[str]:
    """获取返修镜头 ID 列表"""
    async with aiosqlite.connect(DB_PATH) as db:
        # 查询返修组
        cursor = await db.execute(
            "SELECT group_id FROM group_status WHERE episode_id = ? AND status = 'revision'",
            [episode_id]
        )
        revision_groups = [row[0] for row in await cursor.fetchall()]

        if not revision_groups:
            return []

        # 查询返修组的所有镜头
        cursor = await db.execute(
            "SELECT shot_id FROM video_versions WHERE episode_id = ? AND group_id IN ({})".format(
                ",".join("?" * len(revision_groups))
            ),
            [episode_id, *revision_groups]
        )
        shot_ids = [row[0] for row in await cursor.fetchall()]

        return shot_ids


async def get_group_videos(episode_id: int, group_id: str) -> List[VideoVersionSummary]:
    """获取组的所有视频版本"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id, shot_id, group_id, version_number, status, video_path, qc_status, selected, created_at FROM video_versions WHERE episode_id = ? AND group_id = ? ORDER BY shot_id, version_number",
            [episode_id, group_id]
        )
        rows = await cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        return [VideoVersionSummary(**dict(zip(columns, row))) for row in rows]