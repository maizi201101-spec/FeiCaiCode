"""剧本管理 API 路由
全集剧本导入、AI 分集检测、分集确认、梗概生成
"""

from fastapi import APIRouter, HTTPException, Depends
import aiosqlite
from pathlib import Path

from database import get_db, DB_PATH
from schemas.script_management_schema import (
    FullScriptUpload,
    SplitDetectionResponse,
    ConfirmSplitRequest,
    ConfirmSplitResponse,
    FullSeriesStatusResponse,
    EpisodeStatus,
    EpisodeDetailResponse,
    RegenerateSummaryResponse,
)
from services.script_split_service import detect_splits
from services.summary_service import (
    generate_all_summaries,
    regenerate_summary,
    get_project_path,
)

router = APIRouter(tags=["script-management"])


async def get_project_exists(project_id: int) -> bool:
    """检查项目是否存在"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        )
        row = await cursor.fetchone()
        return row is not None


async def save_full_script_temp(project_id: int, content: str) -> str:
    """保存全集剧本到临时文件"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise ValueError(f"项目 {project_id} 路径不存在")

    temp_dir = Path(project_path) / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    temp_file = temp_dir / "full_script.txt"
    temp_file.write_text(content, encoding="utf-8")

    return str(temp_file)


async def read_full_script_temp(project_id: int) -> str | None:
    """读取临时全集剧本"""
    project_path = await get_project_path(project_id)
    if not project_path:
        return None

    temp_file = Path(project_path) / "temp" / "full_script.txt"
    if not temp_file.exists():
        return None

    return temp_file.read_text(encoding="utf-8")


async def check_has_downstream_data(project_id: int) -> tuple[bool, str | None]:
    """检查是否有下游数据（资产/分镜）

    返回 (是否有数据, 原因说明)
    """
    project_path = await get_project_path(project_id)
    if not project_path:
        return False, None

    # 检查 assets.json（路径与 asset_service.py 保持一致）
    assets_file = Path(project_path) / "assets.json"
    if assets_file.exists():
        return True, "已有资产数据"

    # 检查任何 episode 的 shots.json
    episodes_dir = Path(project_path) / "episodes"
    if episodes_dir.exists():
        for ep_dir in episodes_dir.iterdir():
            if ep_dir.is_dir():
                shots_file = ep_dir / "shots.json"
                if shots_file.exists():
                    return True, f"已有分镜数据（{ep_dir.name}）"

    return False, None


@router.post("/projects/{project_id}/full-script")
async def upload_full_script(project_id: int, payload: FullScriptUpload):
    """上传全集剧本

    保存到 temp/full_script.txt
    """
    if not await get_project_exists(project_id):
        raise HTTPException(404, "项目不存在")

    try:
        file_path = await save_full_script_temp(project_id, payload.content)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        "success": True,
        "file_path": file_path,
        "total_chars": len(payload.content),
        "script_type": payload.script_type.value,
    }


@router.post("/projects/{project_id}/split-detection", response_model=SplitDetectionResponse)
async def detect_split_points(project_id: int, payload: FullScriptUpload):
    """AI 分集检测

    执行多层检测，返回分集结果
    """
    if not await get_project_exists(project_id):
        raise HTTPException(404, "项目不存在")

    # 统一换行符为 \n，避免 CRLF 文件落盘时 read_text 自动转换导致位置偏移
    normalized = payload.content.replace('\r\n', '\n').replace('\r', '\n')

    try:
        result = await detect_splits(normalized, payload.expected_episodes)
    except Exception as e:
        raise HTTPException(500, f"分集检测失败: {str(e)}")

    # 保存 normalize 后的内容，保证落盘时位置一致
    await save_full_script_temp(project_id, normalized)

    return result


@router.post("/projects/{project_id}/confirm-split", response_model=ConfirmSplitResponse)
async def confirm_split(project_id: int, payload: ConfirmSplitRequest):
    """确认分集

    执行分割，保存各集剧本，生成梗概
    """
    if not await get_project_exists(project_id):
        raise HTTPException(404, "项目不存在")

    # 读取全集剧本
    full_script = await read_full_script_temp(project_id)
    if not full_script:
        raise HTTPException(400, "请先上传全集剧本")

    # DEBUG: 打印接收到的 splits 数据
    print(f"[confirm-split] Received {len(payload.splits)} splits")
    for i, split in enumerate(payload.splits[:3]):
        print(f"  EP{split.episode_number}: start={split.start_position}, end={split.end_position}")
        # 检查边界内容
        if split.end_position < len(full_script):
            print(f"    content[end-10:end] = '{full_script[split.end_position-10:split.end_position][:30]}...'")
            print(f"    content[end:end+10] = '{full_script[split.end_position:split.end_position+10][:30]}...'")

    try:
        # 执行分割和梗概生成
        if payload.generate_summaries:
            results = await generate_all_summaries(project_id, full_script, payload.splits)
        else:
            # 仅保存剧本，不生成梗概
            results = []
            project_path = await get_project_path(project_id)
            if project_path:
                from services.summary_service import save_script, get_or_create_episode
                for split in payload.splits:
                    content = full_script[split.start_position:split.end_position]
                    await save_script(project_path, split.episode_number, content)
                    ep_id = await get_or_create_episode(project_id, split.episode_number)
                    results.append({"episode_id": ep_id, "episode_number": split.episode_number})

        return ConfirmSplitResponse(
            success=True,
            created_episodes=len(results),
            summaries_generated=len([r for r in results if r.get("summary")]),
            message=f"已创建 {len(results)} 集，生成 {len([r for r in results if r.get('summary')])} 个梗概"
        )
    except Exception as e:
        raise HTTPException(500, f"确认分集失败: {str(e)}")


@router.get("/projects/{project_id}/script-status", response_model=FullSeriesStatusResponse)
async def get_script_status(project_id: int):
    """获取全集状态

    返回各集状态和是否可重新分集
    """
    if not await get_project_exists(project_id):
        raise HTTPException(404, "项目不存在")

    # 检查是否可重新分集
    has_data, reason = await check_has_downstream_data(project_id)
    can_re_split = not has_data

    # 获取各集状态
    project_path = await get_project_path(project_id)
    episodes = []

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, number FROM episodes WHERE project_id = ? ORDER BY number",
            (project_id,)
        )
        rows = await cursor.fetchall()

        for row in rows:
            ep_id = row["id"]
            ep_num = row["number"]

            # 检查文件状态
            has_script = False
            has_summary = False
            status = "pending"

            if project_path:
                ep_dir = Path(project_path) / "episodes" / f"EP{ep_num:02d}"
                script_file = ep_dir / "script.txt"
                summary_file = ep_dir / "summary.txt"

                has_script = script_file.exists()
                has_summary = summary_file.exists()

                if has_script and has_summary:
                    status = "summary_generated"
                elif has_script:
                    status = "imported"

            episodes.append(EpisodeStatus(
                episode_id=ep_id,
                episode_number=ep_num,
                has_script=has_script,
                has_summary=has_summary,
                status=status
            ))

    return FullSeriesStatusResponse(
        episodes=episodes,
        can_re_split=can_re_split,
        reason=reason
    )


@router.get("/episodes/{episode_id}/script-detail", response_model=EpisodeDetailResponse)
async def get_episode_script_detail(episode_id: int):
    """获取单集剧本和梗概"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, project_id, number FROM episodes WHERE id = ?",
            (episode_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "集数不存在")

        ep_id = row["id"]
        project_id = row["project_id"]
        ep_num = row["number"]

    project_path = await get_project_path(project_id)
    script_content = None
    summary = None
    has_script = False
    has_summary = False

    if project_path:
        ep_dir = Path(project_path) / "episodes" / f"EP{ep_num:02d}"
        script_file = ep_dir / "script.txt"
        summary_file = ep_dir / "summary.txt"

        if script_file.exists():
            script_content = script_file.read_text(encoding="utf-8")
            has_script = True

        if summary_file.exists():
            summary = summary_file.read_text(encoding="utf-8")
            has_summary = True

    return EpisodeDetailResponse(
        episode_id=ep_id,
        episode_number=ep_num,
        script_content=script_content,
        summary=summary,
        has_script=has_script,
        has_summary=has_summary
    )


@router.post("/episodes/{episode_id}/regenerate-summary", response_model=RegenerateSummaryResponse)
async def regenerate_episode_summary(episode_id: int):
    """重新生成单集梗概"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, number FROM episodes WHERE id = ?",
            (episode_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "集数不存在")

        ep_num = row["number"]

    try:
        summary = await regenerate_summary(episode_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"生成梗概失败: {str(e)}")

    return RegenerateSummaryResponse(
        episode_id=episode_id,
        episode_number=ep_num,
        summary=summary,
        message="梗概已重新生成"
    )


@router.get("/projects/{project_id}/can-re-split")
async def check_can_re_split(project_id: int):
    """检查是否可重新分集"""
    if not await get_project_exists(project_id):
        raise HTTPException(404, "项目不存在")

    has_data, reason = await check_has_downstream_data(project_id)

    return {
        "can_re_split": not has_data,
        "reason": reason
    }