"""
任务服务 - 异步任务管理
使用 tasks 表记录任务状态
"""

import json
import aiosqlite
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def create_task(
    project_id: int,
    task_type: str,
    payload: Dict[str, Any],
    episode_id: Optional[int] = None,
) -> int:
    """
    创建异步任务记录

    Args:
        project_id: 项目 ID
        task_type: 任务类型（如 generate_image, generate_video）
        payload: 任务负载（JSON 格式的输入数据）
        episode_id: 集数 ID（可选）

    Returns:
        任务 ID
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO tasks (project_id, episode_id, type, status, payload, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
            """,
            [
                project_id,
                episode_id,
                task_type,
                json.dumps(payload, ensure_ascii=False),
                datetime.now().isoformat(),
                datetime.now().isoformat(),
            ],
        )
        await db.commit()
        return cursor.lastrowid


async def get_task(task_id: int) -> Optional[Dict[str, Any]]:
    """
    查询任务状态

    Args:
        task_id: 任务 ID

    Returns:
        任务详情字典，不存在则返回 None
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT id, project_id, episode_id, type, status, payload, result, error, created_at, updated_at
            FROM tasks WHERE id = ?
            """,
            [task_id],
        )
        row = await cursor.fetchone()

    if row is None:
        return None

    return {
        "id": row[0],
        "project_id": row[1],
        "episode_id": row[2],
        "type": row[3],
        "status": row[4],
        "payload": json.loads(row[5]) if row[5] else {},
        "result": row[6],
        "error": row[7],
        "created_at": row[8],
        "updated_at": row[9],
    }


async def update_task_status(
    task_id: int,
    status: str,
    result: Optional[str] = None,
    error: Optional[str] = None,
) -> bool:
    """
    更新任务状态

    Args:
        task_id: 任务 ID
        status: 新状态（pending / processing / completed / failed）
        result: 任务结果（成功时）
        error: 错误信息（失败时）

    Returns:
        是否更新成功
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            UPDATE tasks
            SET status = ?, result = ?, error = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                status,
                result,
                error,
                datetime.now().isoformat(),
                task_id,
            ],
        )
        await db.commit()
        return cursor.rowcount > 0


async def list_project_tasks(
    project_id: int,
    status: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    查询项目任务列表

    Args:
        project_id: 项目 ID
        status: 状态筛选（可选）
        limit: 返回数量限制

    Returns:
        任务列表
    """
    async with aiosqlite.connect(DB_PATH) as db:
        if status:
            cursor = await db.execute(
                """
                SELECT id, project_id, episode_id, type, status, payload, result, error, created_at, updated_at
                FROM tasks
                WHERE project_id = ? AND status = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [project_id, status, limit],
            )
        else:
            cursor = await db.execute(
                """
                SELECT id, project_id, episode_id, type, status, payload, result, error, created_at, updated_at
                FROM tasks
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [project_id, limit],
            )

        rows = await cursor.fetchall()

    return [
        {
            "id": row[0],
            "project_id": row[1],
            "episode_id": row[2],
            "type": row[3],
            "status": row[4],
            "payload": json.loads(row[5]) if row[5] else {},
            "result": row[6],
            "error": row[7],
            "created_at": row[8],
            "updated_at": row[9],
        }
        for row in rows
    ]


async def get_pending_tasks(limit: int = 10) -> List[Dict[str, Any]]:
    """
    查询待处理任务（用于任务消费者）

    Args:
        limit: 返回数量限制

    Returns:
        待处理任务列表
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            SELECT id, project_id, episode_id, type, status, payload, result, error, created_at, updated_at
            FROM tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ?
            """,
            [limit],
        )
        rows = await cursor.fetchall()

    return [
        {
            "id": row[0],
            "project_id": row[1],
            "episode_id": row[2],
            "type": row[3],
            "status": row[4],
            "payload": json.loads(row[5]) if row[5] else {},
            "result": row[6],
            "error": row[7],
            "created_at": row[8],
            "updated_at": row[9],
        }
        for row in rows
    ]


async def cancel_task(task_id: int) -> bool:
    """
    取消任务（仅限 pending / processing 状态）

    Returns:
        True 表示已标记为 cancelled，False 表示任务不存在或已终态
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            UPDATE tasks
            SET status = 'cancelled', updated_at = ?
            WHERE id = ? AND status IN ('pending', 'processing')
            """,
            [datetime.now().isoformat(), task_id],
        )
        await db.commit()
        return cursor.rowcount > 0


async def delete_old_tasks(days: int = 7) -> int:
    """
    删除过期任务记录

    Args:
        days: 保留天数

    Returns:
        删除数量
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            DELETE FROM tasks
            WHERE status IN ('completed', 'failed')
            AND updated_at < datetime('now', ?)
            """,
            [f"-{days} days"],
        )
        await db.commit()
        return cursor.rowcount