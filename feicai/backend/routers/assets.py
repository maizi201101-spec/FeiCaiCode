from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Set
from pathlib import Path
import json
import aiosqlite

from database import DB_PATH
from schemas.assets_schema import (
    AssetsCollection, AssetCreate, AssetUpdate, AssetResponse,
    AssetType, ExtractRequest, Variant
)
from services.asset_service import (
    read_assets, write_assets, add_asset, update_asset, delete_asset,
    run_two_phase_extraction,
)
from services.asset_extraction_from_storyboard import extract_assets_from_storyboard, collapse_asset_refs_from_shots
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
        needs_review=asset.get("needs_review", False),
        variants=asset.get("variants", []),
        base_asset=asset.get("base_asset"),
        images=asset.get("images", []),
    )


@router.get("/projects/{project_id}/assets/cluster-log")
async def get_cluster_log(project_id: int):
    """获取最近一次资产提取的聚类决策记录（供审核浮板使用）"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    cluster_log_file = Path(project_path) / "cluster_log.json"
    if not cluster_log_file.exists():
        return {"extracted_at": None, "clusters": []}

    return json.loads(cluster_log_file.read_text(encoding="utf-8"))


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
    """AI 提取资产（两阶段批处理：Phase1 原始提及 → 程序聚类 → Phase2 逐实体提炼）"""
    from services.shot_service import resolve_asset_bindings

    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    result = await run_two_phase_extraction(payload.episode_ids, project_id)

    if result.get("status") == "failed":
        raise HTTPException(500, result.get("error", "提取失败"))

    # 提取完成后自动坍缩 costume → variant_id
    binding_stats = []
    for episode_id in payload.episode_ids:
        try:
            stats = await resolve_asset_bindings(episode_id)
            binding_stats.append({"episode_id": episode_id, "stats": stats})
        except Exception as e:
            binding_stats.append({"episode_id": episode_id, "error": str(e)})

    result["binding_stats"] = binding_stats

    return result


@router.get("/episodes/{episode_id}/assets/collapse-preview")
async def collapse_preview(episode_id: int):
    """从分镜 asset_refs 坍缩预览（不写入 assets.json）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    project_id = episode["project_id"]
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    try:
        collapsed = await collapse_asset_refs_from_shots(episode_id, project_id)
        return collapsed
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/episodes/{episode_id}/assets/extract-from-storyboard")
async def extract_from_storyboard(episode_id: int):
    """从分镜 asset_refs 坍缩提取资产（v1.7 架构）"""
    from services.shot_service import resolve_asset_bindings

    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    project_id = episode["project_id"]
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    try:
        result = await extract_assets_from_storyboard(episode_id, project_id)

        # 提取完成后自动坍缩 costume → variant_id
        binding_stats = await resolve_asset_bindings(episode_id)
        result["binding_stats"] = binding_stats

        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


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


@router.get("/projects/{project_id}/assets/batch-collapse-preview")
async def batch_collapse_preview(project_id: int):
    """全集批量装扮坍缩预览：合并所有集的 asset_refs，返回统一坍缩结果"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    # 获取项目所有集数
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, number FROM episodes WHERE project_id = ? ORDER BY number ASC",
            (project_id,)
        )
        rows = await cursor.fetchall()

    if not rows:
        raise HTTPException(400, "项目无集数")

    # 合并每集坍缩结果
    char_costumes: Dict[str, Set[str]] = {}  # name -> {costume}
    char_episodes: Dict[str, Set[str]] = {}  # name -> {EP01, EP02}
    scene_episodes: Dict[str, Set[str]] = {}  # scene_name -> {EP01}
    prop_episodes: Dict[str, Set[str]] = {}   # prop_name -> {EP01}

    for row in rows:
        ep_id = row["id"]
        ep_num = row["number"]
        ep_label = f"EP{ep_num:02d}"

        try:
            collapsed = await collapse_asset_refs_from_shots(ep_id, project_id)
        except (ValueError, Exception):
            continue  # 跳过无分镜的集数

        for char in collapsed.get("characters", []):
            name = char["name"]
            if name not in char_costumes:
                char_costumes[name] = set()
                char_episodes[name] = set()
            for costume in char["costumes"]:
                char_costumes[name].add(costume)
            char_episodes[name].add(ep_label)

        for scene in collapsed.get("scenes", []):
            sname = scene["name"]
            if sname not in scene_episodes:
                scene_episodes[sname] = set()
            scene_episodes[sname].add(ep_label)

        for prop in collapsed.get("props", []):
            pname = prop["name"]
            if pname not in prop_episodes:
                prop_episodes[pname] = set()
            prop_episodes[pname].add(ep_label)

    return {
        "characters": [
            {
                "name": name,
                "costumes": sorted(costumes),
                "episodes": sorted(char_episodes[name]),
            }
            for name, costumes in char_costumes.items()
        ],
        "scenes": [
            {"name": name, "episodes": sorted(eps)}
            for name, eps in scene_episodes.items()
        ],
        "props": [
            {"name": name, "episodes": sorted(eps)}
            for name, eps in prop_episodes.items()
        ],
        "episode_ids": [row["id"] for row in rows],
    }