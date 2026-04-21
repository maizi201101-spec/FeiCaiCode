"""
提示词 API
提示词生成、获取、更新、确认
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks

from schemas.prompts_schema import PromptsCollection, Prompt, PromptUpdate, GroupPrompt, GroupPromptUpdate
from services.prompt_service import (
    read_prompts,
    write_prompts,
    generate_prompts_by_ai,
    update_prompt_field,
    confirm_prompt,
)
from services.task_service import create_task, update_task_status
from services.script_service import get_episode_info

router = APIRouter(prefix="/api/episodes/{episode_id}/prompts", tags=["prompts"])


async def execute_prompt_generation(task_id: int, episode_id: int):
    """执行提示词生成任务（后台任务）"""
    try:
        await update_task_status(task_id, "processing")
        collection = await generate_prompts_by_ai(episode_id)
        await update_task_status(
            task_id,
            "completed",
            result=f"生成了 {len(collection.prompts)} 个提示词"
        )
    except Exception as e:
        await update_task_status(task_id, "failed", error=str(e))


@router.post("/generate")
async def generate_prompts(episode_id: int, background_tasks: BackgroundTasks):
    """AI 生成提示词（返回 task_id）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    task_id = await create_task(
        project_id=episode["project_id"],
        episode_id=episode_id,
        task_type="generate_prompts",
        payload={"episode_id": episode_id}
    )

    background_tasks.add_task(execute_prompt_generation, task_id, episode_id)

    return {"task_id": task_id, "status": "pending", "message": "提示词生成任务已创建"}


@router.get("", response_model=PromptsCollection)
async def get_prompts(episode_id: int):
    """获取提示词数据"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection = await read_prompts(episode_id)
    return collection


@router.put("", response_model=PromptsCollection)
async def update_prompts_collection(episode_id: int, collection: PromptsCollection):
    """更新完整提示词数据"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection.episode_id = episode_id
    await write_prompts(episode_id, collection)
    return collection


@router.put("/{shot_id}", response_model=Prompt)
async def update_single_prompt(episode_id: int, shot_id: str, updates: PromptUpdate):
    """更新单镜头提示词"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    updated = await update_prompt_field(episode_id, shot_id, updates)
    if not updated:
        raise HTTPException(404, "提示词不存在")

    return updated


@router.post("/{shot_id}/confirm", response_model=Prompt)
async def confirm_single_prompt(episode_id: int, shot_id: str):
    """确认提示词"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    updated = await confirm_prompt(episode_id, shot_id)
    if not updated:
        raise HTTPException(404, "提示词不存在")

    return updated


@router.put("/groups/{group_id}", response_model=GroupPrompt)
async def update_group_prompt(episode_id: int, group_id: str, updates: GroupPromptUpdate):
    """更新组级提示词"""
    from datetime import datetime

    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection = await read_prompts(episode_id)

    # 查找或创建 group_prompt
    group_prompt = next((gp for gp in collection.group_prompts if gp.group_id == group_id), None)
    if not group_prompt:
        group_prompt = GroupPrompt(group_id=group_id, combined_video_prompt="")
        collection.group_prompts.append(group_prompt)

    # 更新
    group_prompt.combined_video_prompt = updates.combined_video_prompt
    if updates.reference_asset_ids is not None:
        group_prompt.reference_asset_ids = updates.reference_asset_ids
    if updates.confirmed is not None:
        group_prompt.confirmed = updates.confirmed
    group_prompt.edited = True
    group_prompt.last_auto_generated = datetime.now().isoformat()

    await write_prompts(episode_id, collection)
    return group_prompt


@router.delete("/groups/{group_id}")
async def reset_group_prompt(episode_id: int, group_id: str):
    """重置组级提示词（删除保存的版本，恢复自动拼接）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    collection = await read_prompts(episode_id)
    collection.group_prompts = [gp for gp in collection.group_prompts if gp.group_id != group_id]
    await write_prompts(episode_id, collection)
    return {"message": "已重置为自动拼接"}