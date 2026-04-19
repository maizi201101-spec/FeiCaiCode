from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pathlib import Path
import json

from schemas.assets_schema import (
    AssetsCollection, AssetCreate, AssetUpdate, AssetResponse,
    AssetType, ExtractRequest, ExtractProgress
)
from services.asset_service import (
    read_assets, write_assets, add_asset, update_asset, delete_asset,
    extract_assets_from_episode, merge_assets,
)
from services.script_service import get_project_path, get_episode_info

router = APIRouter(tags=["assets"])


def asset_to_response(asset_type: AssetType, asset: dict) -> AssetResponse:
    """转换资产为响应格式"""
    return AssetResponse(
        asset_type=asset_type,
        asset_id=asset.get("asset_id"),
        name=asset.get("name"),
        gender=asset.get("gender"),
        age=asset.get("age"),
        appearance=asset.get("appearance"),
        outfit=asset.get("outfit"),
        description=asset.get("description"),
        visual_elements=asset.get("visual_elements", []),
        time_of_day=asset.get("time_of_day"),
        lighting=asset.get("lighting"),
        tags=asset.get("tags", []),
        variants=asset.get("variants", []),
        base_asset=asset.get("base_asset"),
        images=asset.get("images", []),
    )


@router.get("/projects/{project_id}/assets")
async def list_assets(project_id: int, asset_type: Optional[AssetType] = None):
    """获取项目资产列表"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    assets = await read_assets(project_id)

    result = []

    if asset_type is None or asset_type == AssetType.character:
        for char in assets.characters:
            result.append(asset_to_response(AssetType.character, char.model_dump()))

    if asset_type is None or asset_type == AssetType.scene:
        for scene in assets.scenes:
            result.append(asset_to_response(AssetType.scene, scene.model_dump()))

    if asset_type is None or asset_type == AssetType.prop:
        for prop in assets.props:
            result.append(asset_to_response(AssetType.prop, prop.model_dump()))

    return result


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}")
async def get_asset_detail(project_id: int, asset_type: AssetType, asset_id: str):
    """获取单个资产详情"""
    assets = await read_assets(project_id)

    if asset_type == AssetType.character:
        for char in assets.characters:
            if char.asset_id == asset_id:
                return asset_to_response(AssetType.character, char.model_dump())
    elif asset_type == AssetType.scene:
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                return asset_to_response(AssetType.scene, scene.model_dump())
    elif asset_type == AssetType.prop:
        for prop in assets.props:
            if prop.asset_id == asset_id:
                return asset_to_response(AssetType.prop, prop.model_dump())

    raise HTTPException(404, "资产不存在")


@router.post("/projects/{project_id}/assets")
async def create_asset(project_id: int, payload: AssetCreate):
    """创建新资产"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    asset_data = payload.model_dump()
    asset_data["images"] = []

    result = await add_asset(project_id, payload.asset_type.value, asset_data)
    return asset_to_response(payload.asset_type, result)


@router.put("/projects/{project_id}/assets/{asset_type}/{asset_id}")
async def update_asset_api(
    project_id: int, asset_type: AssetType, asset_id: str, payload: AssetUpdate
):
    """更新资产"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    updates = payload.model_dump(exclude_unset=True)
    result = await update_asset(project_id, asset_type.value, asset_id, updates)

    if result is None:
        raise HTTPException(404, "资产不存在")

    return asset_to_response(asset_type, result)


@router.delete("/projects/{project_id}/assets/{asset_type}/{asset_id}")
async def delete_asset_api(project_id: int, asset_type: AssetType, asset_id: str):
    """删除资产"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    await delete_asset(project_id, asset_type.value, asset_id)
    return {"message": "资产已删除"}


@router.post("/projects/{project_id}/assets/extract")
async def extract_assets(project_id: int, payload: ExtractRequest):
    """AI 提取资产"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    results: List[ExtractProgress] = []

    # 逐集提取
    for episode_id in payload.episode_ids:
        progress = await extract_assets_from_episode(episode_id, project_id)
        results.append(progress)

    # 合并到现有资产库
    if payload.merge_mode:
        existing = await read_assets(project_id)

        all_chars = []
        all_scenes = []
        all_props = []

        for r in results:
            if r.status == "completed":
                # 从 ExtractProgress 的额外字段获取资产
                all_chars.extend(r.characters if hasattr(r, 'characters') else [])
                all_scenes.extend(r.scenes if hasattr(r, 'scenes') else [])
                all_props.extend(r.props if hasattr(r, 'props') else [])

        if all_chars or all_scenes or all_props:
            merged = merge_assets(existing, all_chars, all_scenes, all_props)
            await write_assets(project_id, merged)

    return {"results": [r.model_dump(exclude={'characters', 'scenes', 'props'}) for r in results]}


@router.get("/projects/{project_id}/episodes/{episode_id}/assets")
async def list_episode_assets(project_id: int, episode_id: int, asset_type: Optional[AssetType] = None):
    """获取单集资产列表（基于 episode_assets.json 索引过滤全局资产库）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    ep_assets_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "episode_assets.json"
    if not ep_assets_file.exists():
        return []  # 尚未提取

    index = json.loads(ep_assets_file.read_text(encoding="utf-8"))
    char_ids = set(index.get("characters", []))
    scene_ids = set(index.get("scenes", []))
    prop_ids = set(index.get("props", []))

    all_assets = await read_assets(project_id)
    result = []

    if asset_type is None or asset_type == AssetType.character:
        for c in all_assets.characters:
            if c.asset_id in char_ids:
                result.append(asset_to_response(AssetType.character, c.model_dump()))

    if asset_type is None or asset_type == AssetType.scene:
        for s in all_assets.scenes:
            if s.asset_id in scene_ids:
                result.append(asset_to_response(AssetType.scene, s.model_dump()))

    if asset_type is None or asset_type == AssetType.prop:
        for p in all_assets.props:
            if p.asset_id in prop_ids:
                result.append(asset_to_response(AssetType.prop, p.model_dump()))

    return result