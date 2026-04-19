"""
资产图 API - 图片上传、AI 生成、删除、设为主图
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional
from pathlib import Path
import shutil
import json
import imghdr

from schemas.assets_schema import AssetType
from services.asset_service import (
    get_asset_images_dir,
    get_asset_images,
    add_image_to_asset,
    remove_image_from_asset,
    set_primary_image,
    get_asset_detail,
    read_assets,
    write_assets,
)
from services.task_service import create_task, get_task, update_task_status
from services.jimeng_cli import generate_image, build_prompt_from_asset, DreaminaCLIError
from services.script_service import get_project_path

router = APIRouter(tags=["asset_images"])

# 文件上传限制
ALLOWED_IMAGE_TYPES = {"jpeg", "jpg", "png", "webp"}
MAX_IMAGE_SIZE = 25 * 1024 * 1024  # 25MB


@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/images/upload")
async def upload_asset_image(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
    file: UploadFile = File(...),
):
    """上传资产图片"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    # 检查资产是否存在
    asset_detail = await get_asset_detail(project_id, asset_type.value, asset_id)
    if not asset_detail:
        raise HTTPException(404, "资产不存在")

    # 获取当前图片数量，计算新图片序号
    current_images = await get_asset_images(project_id, asset_type.value, asset_id)
    new_index = len(current_images) + 1

    # 构造文件路径（强制使用 .jpg 扩展名）
    images_dir = await get_asset_images_dir(project_id, asset_type.value)
    if not images_dir:
        raise HTTPException(500, "无法获取图片目录")

    images_dir.mkdir(parents=True, exist_ok=True)
    file_path = images_dir / f"{asset_id}_{new_index}.jpg"

    # 读取文件内容并验证
    content = await file.read()

    # 验证文件大小
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(400, f"文件大小超过限制（最大 {MAX_IMAGE_SIZE // (1024*1024)}MB）")

    # 验证文件类型（使用 imghdr 检测实际类型）
    image_type = imghdr.what(None, h=content)
    if image_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f"不支持的图片类型：{image_type or '未知'}。支持：jpeg, png, webp")

    # 保存文件
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # 添加到资产记录（统一使用 .jpg 路径）
    relative_path = f"assets/{asset_type.value}/{asset_id}_{new_index}.jpg"
    image_index = await add_image_to_asset(project_id, asset_type.value, asset_id, relative_path)

    return {
        "message": "图片上传成功",
        "image_index": image_index,
        "image_path": relative_path,
    }


@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/images/generate")
async def generate_asset_image(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
    background_tasks: BackgroundTasks,
):
    """AI 生成资产图片（创建异步任务）"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    # 检查资产是否存在
    asset_detail = await get_asset_detail(project_id, asset_type.value, asset_id)
    if not asset_detail:
        raise HTTPException(404, "资产不存在")

    # 构造图片提示词
    prompt = build_prompt_from_asset(asset_type.value, asset_detail)

    # 获取当前图片数量，计算新图片序号
    current_images = await get_asset_images(project_id, asset_type.value, asset_id)
    new_index = len(current_images) + 1

    # 构造输出目录（不是文件路径）
    images_dir = await get_asset_images_dir(project_id, asset_type.value)
    if not images_dir:
        raise HTTPException(500, "无法获取图片目录")

    images_dir.mkdir(parents=True, exist_ok=True)

    # 创建任务记录
    task_id = await create_task(
        project_id=project_id,
        task_type="generate_image",
        payload={
            "asset_type": asset_type.value,
            "asset_id": asset_id,
            "prompt": prompt,
            "images_dir": str(images_dir),
            "new_index": new_index,
        },
    )

    # 在后台执行生成任务
    background_tasks.add_task(
        execute_image_generation,
        task_id,
        project_id,
        asset_type.value,
        asset_id,
        prompt,
        images_dir,
        new_index,
    )

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "AI 生图任务已创建",
    }


async def execute_image_generation(
    task_id: int,
    project_id: int,
    asset_type: str,
    asset_id: str,
    prompt: str,
    images_dir: Path,
    new_index: int,
):
    """执行图片生成任务（后台任务）"""
    try:
        # 更新任务状态为 processing
        await update_task_status(task_id, "processing")

        # 调用 Dreamina CLI 生成图片（传入目录，不是文件路径）
        downloaded_path = await generate_image(prompt, images_dir)

        # 重命名图片到正确的文件名
        downloaded_file = Path(downloaded_path)
        target_filename = f"{asset_id}_{new_index}.jpg"
        target_path = images_dir / target_filename

        if downloaded_file.exists() and downloaded_file != target_path:
            downloaded_file.rename(target_path)

        # 添加到资产记录
        relative_path = f"assets/{asset_type}/{asset_id}_{new_index}.jpg"
        await add_image_to_asset(project_id, asset_type, asset_id, relative_path)

        # 更新任务状态为 completed
        await update_task_status(
            task_id,
            "completed",
            result=json.dumps({"image_path": relative_path, "image_index": new_index}),
        )

    except DreaminaCLIError as e:
        await update_task_status(task_id, "failed", error=str(e))
    except Exception as e:
        await update_task_status(task_id, "failed", error=f"生成失败: {str(e)}")


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/images")
async def list_asset_images(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
):
    """获取资产图片列表"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    images = await get_asset_images(project_id, asset_type.value, asset_id)

    # 构造完整路径
    result = []
    for i, img_path in enumerate(images, start=1):
        full_path = Path(project_path) / img_path
        result.append({
            "index": i,
            "path": img_path,
            "exists": full_path.exists(),
            "is_primary": i == 1,
        })

    return {"images": result, "total": len(images)}


@router.delete("/projects/{project_id}/assets/{asset_type}/{asset_id}/images/{image_index}")
async def delete_asset_image(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
    image_index: int,
):
    """删除资产图片"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    # 获取图片路径
    images = await get_asset_images(project_id, asset_type.value, asset_id)
    if image_index < 1 or image_index > len(images):
        raise HTTPException(404, "图片索引不存在")

    # 删除文件
    img_path = images[image_index - 1]
    full_path = Path(project_path) / img_path
    if full_path.exists():
        full_path.unlink()

    # 从资产记录中删除
    success = await remove_image_from_asset(project_id, asset_type.value, asset_id, image_index)
    if not success:
        raise HTTPException(500, "删除图片记录失败")

    return {"message": "图片已删除", "image_index": image_index}


@router.put("/projects/{project_id}/assets/{asset_type}/{asset_id}/images/{image_index}/primary")
async def set_asset_primary_image(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
    image_index: int,
):
    """设置主图"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    images = await get_asset_images(project_id, asset_type.value, asset_id)
    if image_index < 1 or image_index > len(images):
        raise HTTPException(404, "图片索引不存在")

    success = await set_primary_image(project_id, asset_type.value, asset_id, image_index)
    if not success:
        raise HTTPException(500, "设置主图失败")

    return {"message": "已设为主图", "primary_index": 1}


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/images/{image_index}/file")
async def get_asset_image_file(
    project_id: int,
    asset_type: AssetType,
    asset_id: str,
    image_index: int,
):
    """获取图片文件"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    images = await get_asset_images(project_id, asset_type.value, asset_id)
    if image_index < 1 or image_index > len(images):
        raise HTTPException(404, "图片索引不存在")

    img_path = images[image_index - 1]
    full_path = Path(project_path) / img_path

    if not full_path.exists():
        raise HTTPException(404, "图片文件不存在")

    return FileResponse(full_path, media_type="image/jpeg")