"""
分镜 API
分镜规划、获取、更新、归组调整
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from typing import List

from schemas.shots_schema import (
    Shot, ShotGroup, ShotsCollection, ShotUpdate, GroupUpdate
)
from services.shot_service import (
    read_shots,
    write_shots,
    plan_shots_by_ai,
    update_shot_field,
    update_shot_group_membership,
    generate_storyboard_md,
)
from services.task_service import create_task, update_task_status
from services.script_service import get_episode_info

router = APIRouter(prefix="/api/episodes/{episode_id}/shots", tags=["shots"])


async def execute_shot_planning(task_id: int, episode_id: int):
    """执行分镜规划任务（后台任务）"""
    try:
        await update_task_status(task_id, "processing")
        collection = await plan_shots_by_ai(episode_id)
        await update_task_status(
            task_id,
            "completed",
            result=f"生成了 {len(collection.shots)} 个镜头，{len(collection.groups)} 个组"
        )
    except Exception as e:
        await update_task_status(task_id, "failed", error=str(e))


@router.post("/plan")
async def plan_shots(episode_id: int, background_tasks: BackgroundTasks):
    """AI 分镜规划（返回 task_id）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    # 创建任务记录
    task_id = await create_task(
        project_id=episode["project_id"],
        episode_id=episode_id,
        task_type="plan_shots",
        payload={"episode_id": episode_id}
    )

    # 在后台执行规划任务
    background_tasks.add_task(execute_shot_planning, task_id, episode_id)

    return {"task_id": task_id, "status": "pending", "message": "分镜规划任务已创建"}


@router.get("", response_model=ShotsCollection)
async def get_shots(episode_id: int):
    """获取分镜数据"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection = await read_shots(episode_id)
    return collection


@router.put("", response_model=ShotsCollection)
async def update_shots_collection(episode_id: int, collection: ShotsCollection):
    """更新完整分镜数据"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection.episode_id = episode_id
    await write_shots(episode_id, collection)

    # 重新生成 storyboard.md
    await generate_storyboard_md(episode_id, collection)

    return collection


@router.put("/{shot_id}", response_model=Shot)
async def update_single_shot(episode_id: int, shot_id: str, updates: ShotUpdate):
    """更新单个镜头字段"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    updated = await update_shot_field(episode_id, shot_id, updates)
    if not updated:
        raise HTTPException(404, "镜头不存在")

    # 重新生成 storyboard.md
    collection = await read_shots(episode_id)
    await generate_storyboard_md(episode_id, collection)

    return updated


@router.put("/{shot_id}/group", response_model=Shot)
async def update_shot_group_membership(episode_id: int, shot_id: str, group_update: GroupUpdate):
    """调整镜头归组"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    updated = await update_shot_group_membership(episode_id, shot_id, group_update.group_id)
    if not updated:
        raise HTTPException(404, "镜头不存在")

    # 重新生成 storyboard.md
    collection = await read_shots(episode_id)
    await generate_storyboard_md(episode_id, collection)

    return updated


@router.get("/storyboard.md", response_class=PlainTextResponse)
async def get_storyboard_markdown(episode_id: int):
    """获取 Markdown 分镜表"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection = await read_shots(episode_id)
    if not collection.shots:
        return "# 无分镜数据"

    md_content = await generate_storyboard_md(episode_id, collection)
    return md_content