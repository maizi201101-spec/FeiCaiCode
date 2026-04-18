"""
分镜提示词导出 API
CSV 和 Markdown 格式导出
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from services.prompt_export_service import (
    export_prompts_csv,
    export_prompts_markdown,
    export_all_episodes_prompts_csv,
)
from services.script_service import get_episode_info, get_project_path

router = APIRouter(prefix="/api/episodes/{episode_id}/export-prompts", tags=["export-prompts"])


class ExportRequest:
    """导出请求"""
    format: str = "csv"  # csv 或 markdown
    scope: str = "episode"  # episode/group/shot
    selected_ids: Optional[List[str]] = None


@router.post("/csv")
async def export_csv(
    episode_id: int,
    scope: str = "episode",
    selected_ids: Optional[List[str]] = None
):
    """
    导出提示词为 CSV 格式

    Args:
        episode_id: 集数ID
        scope: 导出范围 - episode(整集)/group(选定组)/shot(选定镜头)
        selected_ids: 选定的组ID或镜头ID列表（JSON 数组字符串）
    """
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    try:
        csv_path = await export_prompts_csv(episode_id, scope, selected_ids)
        return {
            "message": "导出成功",
            "file_path": csv_path,
            "format": "csv"
        }
    except Exception as e:
        raise HTTPException(500, f"导出失败: {str(e)}")


@router.post("/markdown")
async def export_markdown(
    episode_id: int,
    scope: str = "episode",
    selected_ids: Optional[List[str]] = None
):
    """
    导出提示词为 Markdown 格式

    Args:
        episode_id: 集数ID
        scope: 导出范围 - episode(整集)/group(选定组)/shot(选定镜头)
        selected_ids: 选定的组ID或镜头ID列表（JSON 数组字符串）
    """
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    try:
        md_path = await export_prompts_markdown(episode_id, scope, selected_ids)
        return {
            "message": "导出成功",
            "file_path": md_path,
            "format": "markdown"
        }
    except Exception as e:
        raise HTTPException(500, f"导出失败: {str(e)}")


@router.post("/all-episodes/csv")
async def export_all_csv(project_id: int):
    """
    导出全集提示词为 CSV 格式

    注意：此接口使用 project_id，episode_id 参数无效
    """
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    try:
        csv_path = await export_all_episodes_prompts_csv(project_id)
        return {
            "message": "导出成功",
            "file_path": csv_path,
            "format": "csv"
        }
    except Exception as e:
        raise HTTPException(500, f"导出失败: {str(e)}")