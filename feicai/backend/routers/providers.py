"""
提供商配置管理 API
提供商 CRUD + 项目默认提供商设置
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from schemas.provider_schema import (
    Provider, ProviderCreate, ProviderUpdate,
    ProviderType, ProviderList, ProjectProviders
)
from services.provider_service import (
    get_providers_by_type,
    create_provider,
    update_provider,
    delete_provider,
    set_project_default_provider,
    get_project_providers,
)

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("", response_model=ProviderList)
async def list_providers(provider_type: Optional[ProviderType] = None):
    """获取提供商列表"""
    providers = await get_providers_by_type(provider_type)
    return ProviderList(providers=providers)


@router.post("", response_model=Provider)
async def create_new_provider(create: ProviderCreate):
    """创建新提供商"""
    provider = await create_provider(create)
    return provider


@router.get("/{provider_id}", response_model=Provider)
async def get_provider(provider_id: str):
    """获取单个提供商"""
    providers = await get_providers_by_type()
    for p in providers:
        if p.provider_id == provider_id:
            return p
    raise HTTPException(404, "提供商不存在")


@router.put("/{provider_id}", response_model=Provider)
async def update_existing_provider(provider_id: str, update: ProviderUpdate):
    """更新提供商"""
    provider = await update_provider(provider_id, update)
    if not provider:
        raise HTTPException(404, "提供商不存在")
    return provider


@router.delete("/{provider_id}")
async def delete_existing_provider(provider_id: str):
    """删除提供商"""
    success = await delete_provider(provider_id)
    if not success:
        raise HTTPException(404, "提供商不存在或为内置提供商")
    return {"message": "删除成功"}


@router.post("/project/{project_id}/default")
async def set_default_provider(
    project_id: int,
    provider_type: ProviderType,
    provider_id: str
):
    """设置项目默认提供商"""
    success = await set_project_default_provider(project_id, provider_type, provider_id)
    if not success:
        raise HTTPException(400, "提供商类型不匹配或不存在")
    return {"message": "设置成功"}


@router.get("/project/{project_id}/defaults", response_model=ProjectProviders)
async def get_project_defaults(project_id: int):
    """获取项目默认提供商"""
    return await get_project_providers(project_id)