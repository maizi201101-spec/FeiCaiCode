"""
全局设置 API
项目级全局提示词和默认生成参数
"""

from fastapi import APIRouter, HTTPException

from schemas.prompts_schema import GlobalSettings
from services.prompt_service import get_global_settings, update_global_settings
from services.script_service import get_project_path

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings"])


@router.get("", response_model=GlobalSettings)
async def get_settings(project_id: int):
    """获取全局设置"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    settings = await get_global_settings(project_id)
    return settings


@router.put("", response_model=GlobalSettings)
async def update_settings(project_id: int, settings: GlobalSettings):
    """更新全局设置"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    await update_global_settings(project_id, settings)
    return settings