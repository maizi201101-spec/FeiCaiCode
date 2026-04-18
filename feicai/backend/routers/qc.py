"""
质检 API
组级别质检数据查询、状态更新、版本选定
"""

from fastapi import APIRouter, HTTPException
from typing import List

from schemas.qc_schema import GroupQCData, GroupStatus, GroupStatusUpdate, VideoVersionSummary
from services.qc_service import (
    get_episode_qc_data, update_group_status, select_group_version,
    get_revision_shot_ids, get_group_videos
)
from services.script_service import get_episode_info

router = APIRouter(prefix="/api/episodes", tags=["qc"])


@router.get("/{episode_id}/qc/groups", response_model=List[GroupQCData])
async def list_episode_qc_groups(episode_id: int):
    """获取全集组质检数据"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    return await get_episode_qc_data(episode_id)


@router.get("/{episode_id}/qc/groups/{group_id}", response_model=GroupQCData)
async def get_group_qc_detail(episode_id: int, group_id: str):
    """获取单个组质检详情"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    qc_data = await get_episode_qc_data(episode_id)
    group = next((g for g in qc_data if g.group_id == group_id), None)
    if not group:
        raise HTTPException(404, f"组 {group_id} 不存在")

    return group


@router.put("/{episode_id}/qc/groups/{group_id}/status", response_model=GroupStatus)
async def update_group_qc_status(episode_id: int, group_id: str, update: GroupStatusUpdate):
    """更新组质检状态（标记返修/合格）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    return await update_group_status(episode_id, group_id, update)


@router.put("/{episode_id}/qc/groups/{group_id}/select-version")
async def select_group_qc_version(episode_id: int, group_id: str, version_id: int):
    """选定组版本"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    await select_group_version(episode_id, group_id, version_id)
    return {"episode_id": episode_id, "group_id": group_id, "selected_version_id": version_id}


@router.get("/{episode_id}/qc/revision-shots", response_model=List[str])
async def list_revision_shot_ids(episode_id: int):
    """获取返修镜头 ID 列表"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    return await get_revision_shot_ids(episode_id)


@router.get("/{episode_id}/qc/groups/{group_id}/videos", response_model=List[VideoVersionSummary])
async def list_group_videos(episode_id: int, group_id: str):
    """获取组的视频版本列表"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    return await get_group_videos(episode_id, group_id)