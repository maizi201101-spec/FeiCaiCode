"""
装扮注册表 API 路由
"""

from fastapi import APIRouter, HTTPException
from typing import Dict

from schemas.costume_registry_schema import CostumeRegistry, CostumeRegistryUpdate
from services.costume_registry_service import CostumeRegistryService
from services.script_service import get_project_path

router = APIRouter()


@router.get("/projects/{project_id}/costume-registry", response_model=CostumeRegistry)
async def get_costume_registry(project_id: int):
    """获取装扮注册表"""
    try:
        project_path = get_project_path(project_id)
        if not project_path:
            raise HTTPException(status_code=404, detail="项目不存在")

        registry = CostumeRegistryService.load_registry(project_path)
        return registry

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}/costume-registry/aliases")
async def update_costume_aliases(project_id: int, update: CostumeRegistryUpdate):
    """更新装扮的 aliases（用户编辑合并别名）"""
    try:
        project_path = get_project_path(project_id)
        if not project_path:
            raise HTTPException(status_code=404, detail="项目不存在")

        CostumeRegistryService.update_aliases(
            project_path,
            update.character_name,
            update.costume_label,
            update.aliases
        )

        return {"message": "aliases 更新成功"}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
