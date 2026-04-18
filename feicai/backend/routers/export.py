"""
剪映草稿导出 API
导出剪映兼容的 draft_content.json
"""

from fastapi import APIRouter, HTTPException

from services.capcut_service import export_capcut_draft, check_export_status
from services.script_service import get_episode_info

router = APIRouter(prefix="/api/episodes", tags=["export"])


@router.post("/{episode_id}/export/capcut")
async def export_capcut(episode_id: int):
    """导出剪映草稿"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    try:
        file_path = await export_capcut_draft(episode_id)
        return {
            "file_path": file_path,
            "status": "success",
            "message": f"导出成功，文件路径: {file_path}",
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{episode_id}/export/status")
async def get_export_status(episode_id: int):
    """检查导出条件"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    ready, missing_groups = await check_export_status(episode_id)
    return {
        "ready": ready,
        "missing_groups": missing_groups,
    }