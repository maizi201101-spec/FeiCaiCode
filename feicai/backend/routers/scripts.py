from fastapi import APIRouter, HTTPException, Depends
import aiosqlite

from database import get_db
from schemas.script import (
    ScriptUpload,
    ScriptResponse,
    ScriptSplitRequest,
    ScriptSplitResponse,
    ScriptType,
)
from services.script_service import (
    save_script,
    read_script,
    split_script_by_ai,
    get_episode_info,
)

router = APIRouter(tags=["scripts"])


@router.post("/episodes/{episode_id}/script", response_model=ScriptResponse)
async def upload_script(episode_id: int, payload: ScriptUpload, db=Depends(get_db)):
    """上传剧本到指定集数"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    try:
        file_path = await save_script(episode_id, payload.content, payload.script_type)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return ScriptResponse(
        episode_id=episode_id,
        episode_number=episode["number"],
        has_script=True,
        content=payload.content[:500],  # 只返回前 500 字预览
        script_type=payload.script_type,
        file_path=file_path,
    )


@router.get("/episodes/{episode_id}/script", response_model=ScriptResponse)
async def get_script(episode_id: int):
    """获取指定集数的剧本"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    script_data = await read_script(episode_id)
    if not script_data:
        return ScriptResponse(
            episode_id=episode_id,
            episode_number=episode["number"],
            has_script=False,
        )

    return ScriptResponse(
        episode_id=episode_id,
        episode_number=episode["number"],
        has_script=True,
        content=script_data["content"],
        script_type=script_data["script_type"],
        file_path=script_data["file_path"],
    )


@router.post("/episodes/{episode_id}/script/split", response_model=ScriptSplitResponse)
async def split_script(episode_id: int, payload: ScriptSplitRequest):
    """AI 分割全集剧本（传入内容）"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    try:
        result = await split_script_by_ai(payload.content, payload.episode_count)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return result


@router.delete("/episodes/{episode_id}/script")
async def delete_script(episode_id: int):
    """删除剧本"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise HTTPException(404, "集数不存在")

    script_data = await read_script(episode_id)
    if script_data and script_data["file_path"]:
        import os
        try:
            os.remove(script_data["file_path"])
        except OSError:
            pass

    return {"message": "剧本已删除"}