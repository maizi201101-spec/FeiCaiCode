"""
任务 API - 查询任务状态和项目任务列表
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from services.task_service import get_task, list_project_tasks, cancel_task

router = APIRouter(tags=["tasks"])


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: int):
    """查询任务状态"""
    task = await get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    return task


@router.post("/tasks/{task_id}/cancel")
async def cancel_task_endpoint(task_id: int):
    """取消任务（仅限 pending / processing 状态）"""
    task = await get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    ok = await cancel_task(task_id)
    if not ok:
        raise HTTPException(400, f"任务已处于终态（{task['status']}），无法取消")

    return {"ok": True, "task_id": task_id, "status": "cancelled"}


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    project_id: int,
    status: Optional[str] = None,
    limit: int = 50,
):
    """查询项目任务列表

    status 支持: pending / processing / completed / failed / cancelled / active（pending+processing 合并）
    """
    valid_statuses = {"pending", "processing", "completed", "failed", "cancelled", "active"}
    if status and status not in valid_statuses:
        raise HTTPException(400, f"无效的状态值。支持：{', '.join(sorted(valid_statuses))}")

    if status == "active":
        # 返回 pending + processing 任务
        pending = await list_project_tasks(project_id, status="pending", limit=limit)
        processing = await list_project_tasks(project_id, status="processing", limit=limit)
        tasks = sorted(pending + processing, key=lambda t: t["created_at"], reverse=True)[:limit]
    else:
        tasks = await list_project_tasks(project_id, status=status, limit=limit)

    return {"tasks": tasks, "total": len(tasks)}
