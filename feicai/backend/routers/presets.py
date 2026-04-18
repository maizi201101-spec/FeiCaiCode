"""
预设库管理 API
预设 CRUD + 激活状态管理
"""

from fastapi import APIRouter, HTTPException
from typing import Optional, List

from schemas.preset_schema import (
    Preset, PresetCreate, PresetUpdate, PresetList,
    PresetCategory, ActivePresets
)
from services.preset_service import (
    get_presets_by_category, create_preset, update_preset,
    delete_preset, activate_preset, deactivate_preset,
    get_active_presets, get_active_preset_content, get_active_special_effects
)

router = APIRouter(prefix="/api/presets", tags=["presets"])


@router.get("", response_model=PresetList)
async def list_presets(category: Optional[PresetCategory] = None):
    """获取预设列表"""
    presets = await get_presets_by_category(category)
    return PresetList(presets=presets)


@router.post("", response_model=Preset)
async def create_new_preset(create: PresetCreate):
    """创建新预设"""
    preset = await create_preset(create)
    return preset


@router.get("/{preset_id}", response_model=Preset)
async def get_preset(preset_id: str):
    """获取单个预设"""
    presets = await get_presets_by_category()
    for p in presets:
        if p.preset_id == preset_id:
            return p
    raise HTTPException(404, "预设不存在")


@router.put("/{preset_id}", response_model=Preset)
async def update_existing_preset(preset_id: str, update: PresetUpdate):
    """更新预设"""
    preset = await update_preset(preset_id, update)
    if not preset:
        raise HTTPException(404, "预设不存在")
    return preset


@router.delete("/{preset_id}")
async def delete_existing_preset(preset_id: str):
    """删除预设"""
    success = await delete_preset(preset_id)
    if not success:
        raise HTTPException(404, "预设不存在或为内置预设")
    return {"message": "删除成功"}


@router.post("/{preset_id}/activate")
async def activate_preset_for_project(
    preset_id: str,
    project_id: int,
    category: PresetCategory
):
    """激活预设（项目级）"""
    success = await activate_preset(project_id, preset_id, category)
    if not success:
        raise HTTPException(404, "预设不存在")
    return {"message": "激活成功"}


@router.post("/{preset_id}/deactivate")
async def deactivate_preset_for_project(preset_id: str, project_id: int):
    """取消激活预设"""
    success = await deactivate_preset(project_id, preset_id)
    return {"message": "取消激活成功"}


@router.get("/active/{project_id}", response_model=ActivePresets)
async def get_project_active_presets(project_id: int):
    """获取项目激活的预设"""
    return await get_active_presets(project_id)


@router.get("/content/{project_id}/{category}")
async def get_active_content(project_id: int, category: PresetCategory):
    """获取项目激活的预设内容"""
    content = await get_active_preset_content(project_id, category)
    return {"content": content}


@router.get("/effects/{project_id}")
async def get_active_effects(project_id: int):
    """获取项目激活的特殊效果预设"""
    contents = await get_active_special_effects(project_id)
    return {"effects": contents}