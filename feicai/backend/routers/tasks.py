"""
任务 API - 查询任务状态和项目任务列表
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from services.task_service import get_task, list_project_tasks

router = APIRouter(tags=["tasks"])


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: int):
    """查询任务状态"""
    task = await get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    return task


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    project_id: int,
    status: Optional[str] = None,
    limit: int = 50,
):
    """查询项目任务列表"""
    # 支持 status 筛选：pending / processing / completed / failed
    valid_statuses = {"pending", "processing", "completed", "failed"}
    if status and status not in valid_statuses:
        raise HTTPException(400, f"无效的状态值。支持：{', '.join(valid_statuses)}")

    tasks = await list_project_tasks(project_id, status=status, limit=limit)
    return {"tasks": tasks, "total": len(tasks)}