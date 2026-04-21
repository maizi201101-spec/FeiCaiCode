"""
分镜 API
分镜规划、获取、更新、归组调整
"""

import asyncio

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from typing import List

import aiosqlite
from pathlib import Path

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
project_shots_router = APIRouter(prefix="/api/projects/{project_id}/shots", tags=["shots"])

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def execute_shot_planning(task_id: int, episode_id: int):
    """执行分镜规划任务（后台任务）"""
    try:
        await update_task_status(task_id, "processing")
        collection, parse_warnings = await plan_shots_by_ai(episode_id)
        total = len(collection.shots)
        groups = len(collection.groups)
        result_msg = f"生成了 {total} 个镜头，{groups} 个组"
        if parse_warnings:
            result_msg += f"（{len(parse_warnings)} 个镜头解析警告，详见日志）"
        status = "completed" if total > 0 else "failed"
        if status == "failed":
            await update_task_status(task_id, "failed", error="所有镜头均解析失败，请检查LLM输出")
        else:
            await update_task_status(task_id, status, result=result_msg)
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


async def _execute_plan_all(task_id: int, project_id: int, episode_ids: list[int], concurrency: int, cleanup_downstream: bool):
    """批量规划所有集分镜（后台任务）

    cleanup_downstream: 是否清理下游数据（prompts.json / assets.json / episode_assets.json）
    """
    await update_task_status(task_id, "processing")

    sem = asyncio.Semaphore(concurrency)
    completed = 0
    failed = 0

    async def _plan_one(ep_id: int):
        nonlocal completed, failed
        async with sem:
            try:
                collection, _ = await plan_shots_by_ai(ep_id)
                if collection.shots:
                    completed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"批量规划 episode {ep_id} 失败: {e}")
                failed += 1

    await asyncio.gather(*[_plan_one(ep_id) for ep_id in episode_ids])

    # 清理下游数据（如果用户确认）
    if cleanup_downstream and completed > 0:
        from services.script_service import get_project_path, get_episode_info
        project_path = await get_project_path(project_id)
        if project_path:
            from pathlib import Path
            project_dir = Path(project_path)
            # 删除 assets.json / episode_assets.json
            (project_dir / "assets.json").unlink(missing_ok=True)
            # 删除所有集的 prompts.json 和 episode_assets.json
            for ep_id in episode_ids:
                episode = await get_episode_info(ep_id)
                if episode:
                    ep_dir = project_dir / "episodes" / f"EP{episode['number']:02d}"
                    (ep_dir / "prompts.json").unlink(missing_ok=True)
                    (ep_dir / "episode_assets.json").unlink(missing_ok=True)

    result_msg = f"共 {len(episode_ids)} 集：成功 {completed}，失败 {failed}"
    status = "completed" if completed > 0 else "failed"
    if status == "failed":
        await update_task_status(task_id, "failed", error=result_msg)
    else:
        await update_task_status(task_id, status, result=result_msg)


@project_shots_router.post("/plan-all")
async def plan_all_shots(project_id: int, background_tasks: BackgroundTasks, force: bool = False):
    """批量规划项目所有集分镜（并发数由项目设置决定）

    force: 强制执行并清理下游数据（prompts/assets）
    """
    # 查询所有集数
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await (await db.execute(
            "SELECT id, number FROM episodes WHERE project_id = ? ORDER BY number",
            (project_id,)
        )).fetchall()

    if not rows:
        raise HTTPException(404, "项目下无集数")

    episode_ids = [r[0] for r in rows]

    # 检测是否已有 prompts.json（任意一集）
    from services.script_service import get_project_path, get_episode_info
    from pathlib import Path
    project_path = await get_project_path(project_id)
    has_prompts = False
    if project_path:
        project_dir = Path(project_path)
        for ep_id, ep_num in rows:
            ep_dir = project_dir / "episodes" / f"EP{ep_num:02d}"
            if (ep_dir / "prompts.json").exists():
                has_prompts = True
                break

    # 如果已有 prompts 且未强制执行，返回需要确认
    if has_prompts and not force:
        return {
            "needs_confirmation": True,
            "message": "检测到已生成提示词，批量规划会删除所有下游数据（资产+提示词）",
            "episode_count": len(episode_ids)
        }

    # 读取并发数设置
    from services.prompt_service import get_global_settings
    settings = await get_global_settings(project_id)
    concurrency = max(1, min(3, settings.plan_concurrency))

    # 创建任务记录（project 级，无 episode_id）
    task_id = await create_task(
        project_id=project_id,
        task_type="plan_all_shots",
        payload={"episode_ids": episode_ids, "concurrency": concurrency, "cleanup": has_prompts}
    )

    background_tasks.add_task(_execute_plan_all, task_id, project_id, episode_ids, concurrency, has_prompts)

    return {
        "task_id": task_id,
        "status": "pending",
        "message": f"批量规划任务已创建（{len(episode_ids)} 集，并发数 {concurrency}）"
    }