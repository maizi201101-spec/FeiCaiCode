"""
视频生成 API
提交生成任务、获取版本列表、更新质检状态
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List

from schemas.video_schema import (
    VideoVersion, VideoGenerationRequest, BatchGenerationRequest, VideoVersionSummary
)
from services.video_service import (
    get_video_versions, get_episode_videos, create_video_version,
    execute_video_generation, update_video_qc_status, select_video_version
)
from services.script_service import get_episode_info, get_project_path

router = APIRouter(prefix="/api/episodes", tags=["videos"])


@router.post("/{episode_id}/videos/generate", response_model=dict)
async def generate_single_video(episode_id: int, request: VideoGenerationRequest, background_tasks: BackgroundTasks):
    """提交单镜头视频生成任务"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise HTTPException(404, "项目路径不存在")

    # 从项目路径提取项目名
    project_name = Path(project_path).name

    # 获取 group_id
    from services.shot_service import read_shots
    shots = await read_shots(episode_id)
    shot = next((s for s in shots.shots if s.shot_id == request.shot_id), None)
    if not shot:
        raise HTTPException(404, f"镜头 {request.shot_id} 不存在")

    # 创建视频版本记录
    from schemas.video_schema import VideoVersionCreate
    create = VideoVersionCreate(
        shot_id=request.shot_id,
        group_id=shot.group_id,
        video_prompt=request.video_prompt,
        reference_images=request.reference_images,
        anchor_declaration=request.anchor_declaration,
        model=request.model,
        duration=request.duration,
        resolution=request.resolution,
    )

    version_id = await create_video_version(episode_id, create)

    # 添加后台任务执行生成
    background_tasks.add_task(execute_video_generation, version_id, episode_id, project_name)

    return {"version_id": version_id, "status": "pending"}


@router.post("/{episode_id}/videos/generate-batch", response_model=dict)
async def generate_batch_videos(episode_id: int, request: BatchGenerationRequest, background_tasks: BackgroundTasks):
    """批量生成视频（组或全集）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise HTTPException(404, "项目路径不存在")

    project_name = Path(project_path).name

    from services.shot_service import read_shots
    from services.prompt_service import read_prompts
    shots = await read_shots(episode_id)
    prompts = await read_prompts(episode_id)

    # 确定要生成的镜头列表
    if request.group_id:
        target_shots = [s for s in shots.shots if s.group_id == request.group_id]
    elif request.all_groups:
        target_shots = shots.shots
    else:
        raise HTTPException(400, "请指定 group_id 或 all_groups")

    version_ids = []
    for shot in target_shots:
        prompt = next((p for p in prompts.prompts if p.shot_id == shot.shot_id), None)
        if not prompt:
            continue

        create = VideoVersionCreate(
            shot_id=shot.shot_id,
            group_id=shot.group_id,
            video_prompt=prompt.video_prompt,
        )

        version_id = await create_video_version(episode_id, create)
        version_ids.append(version_id)
        background_tasks.add_task(execute_video_generation, version_id, episode_id, project_name)

    return {"version_ids": version_ids, "count": len(version_ids), "status": "pending"}


@router.get("/{episode_id}/videos", response_model=List[VideoVersionSummary])
async def list_episode_videos(episode_id: int):
    """获取全集视频版本列表"""
    versions = await get_episode_videos(episode_id)
    return [
        VideoVersionSummary(
            id=v.id, shot_id=v.shot_id, group_id=v.group_id,
            version_number=v.version_number, status=v.status,
            video_path=v.video_path, qc_status=v.qc_status,
            selected=v.selected, created_at=v.created_at
        )
        for v in versions
    ]


@router.get("/{episode_id}/videos/{shot_id}", response_model=List[VideoVersion])
async def list_shot_videos(episode_id: int, shot_id: str):
    """获取镜头视频版本列表"""
    versions = await get_video_versions(episode_id, shot_id)
    return versions


@router.put("/videos/{version_id}/status", response_model=dict)
async def update_video_status(version_id: int, qc_status: str):
    """更新质检状态"""
    await update_video_qc_status(version_id, qc_status)
    return {"version_id": version_id, "qc_status": qc_status}


@router.put("/videos/{version_id}/select", response_model=dict)
async def select_version(version_id: int):
    """选定版本"""
    await select_video_version(version_id)
    return {"version_id": version_id, "selected": True}