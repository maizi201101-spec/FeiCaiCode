"""全局系统设置 API
项目区路径等全局配置
"""

import json
from fastapi import APIRouter, HTTPException
import aiosqlite
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from database import DB_PATH

router = APIRouter(prefix="/api/system", tags=["system-settings"])


async def _get_setting(db, key: str) -> Optional[str]:
    cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row[0] if row else None


async def _set_setting(db, key: str, value: str):
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, now)
    )


@router.get("/settings")
async def get_system_settings():
    """获取全局系统设置"""
    settings = {}
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT key, value FROM settings")
        rows = await cursor.fetchall()
        for row in rows:
            settings[row["key"]] = row["value"]

    return {
        "projects_root_path": settings.get("projects_root_path", ""),
        "llm_api_key": settings.get("llm_api_key", ""),
        "llm_base_url": settings.get("llm_base_url", ""),
        "llm_model": settings.get("llm_model", ""),
    }


@router.put("/settings")
async def update_system_settings(settings: dict):
    """更新全局系统设置"""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    async with aiosqlite.connect(DB_PATH) as db:
        for key, value in settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, now)
            )
        await db.commit()

    return {"success": True, "message": "设置已保存"}


@router.get("/projects-root")
async def get_projects_root():
    """获取项目区路径"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'projects_root_path'"
        )
        row = await cursor.fetchone()
        return {"projects_root_path": row[0] if row else ""}


# ── 多项目区管理 ──────────────────────────────────────────────

class ZoneAddRequest(BaseModel):
    path: str
    name: Optional[str] = None


class ZoneRemoveRequest(BaseModel):
    path: str


class ActiveZoneRequest(BaseModel):
    path: str


@router.get("/zones")
async def get_project_zones():
    """获取所有项目区列表及当前激活区"""
    async with aiosqlite.connect(DB_PATH) as db:
        zones_json = await _get_setting(db, "project_zones")
        active_zone = await _get_setting(db, "active_zone")
        # fallback: 如果没有 zones，但有旧的 projects_root_path，迁移过来
        if not zones_json:
            root_path = await _get_setting(db, "projects_root_path")
            if root_path:
                zones = [{"path": root_path, "name": Path(root_path).name}]
                active_zone = active_zone or root_path
            else:
                zones = []
        else:
            zones = json.loads(zones_json)

    return {"zones": zones, "active_zone": active_zone or ""}


@router.post("/zones")
async def add_project_zone(req: ZoneAddRequest):
    """添加项目区"""
    path = req.path.strip()
    if not path:
        raise HTTPException(status_code=400, detail="路径不能为空")
    if not Path(path).is_dir():
        raise HTTPException(status_code=400, detail=f"路径不存在或不是目录：{path}")

    async with aiosqlite.connect(DB_PATH) as db:
        zones_json = await _get_setting(db, "project_zones")
        zones = json.loads(zones_json) if zones_json else []

        if any(z["path"] == path for z in zones):
            raise HTTPException(status_code=409, detail="该项目区已存在")

        name = req.name or Path(path).name
        zones.append({"path": path, "name": name})
        await _set_setting(db, "project_zones", json.dumps(zones, ensure_ascii=False))

        # 如果还没有激活区，自动激活这个
        active_zone = await _get_setting(db, "active_zone")
        if not active_zone:
            await _set_setting(db, "active_zone", path)
            await _set_setting(db, "projects_root_path", path)

        await db.commit()

    return {"success": True, "zones": zones}


@router.delete("/zones")
async def remove_project_zone(req: ZoneRemoveRequest):
    """移除项目区（不删除文件）"""
    path = req.path.strip()

    async with aiosqlite.connect(DB_PATH) as db:
        zones_json = await _get_setting(db, "project_zones")
        zones = json.loads(zones_json) if zones_json else []
        zones = [z for z in zones if z["path"] != path]
        await _set_setting(db, "project_zones", json.dumps(zones, ensure_ascii=False))

        # 如果删的是激活区，清空激活区
        active_zone = await _get_setting(db, "active_zone")
        if active_zone == path:
            new_active = zones[0]["path"] if zones else ""
            await _set_setting(db, "active_zone", new_active)
            await _set_setting(db, "projects_root_path", new_active)

        await db.commit()

    return {"success": True, "zones": zones}


@router.put("/active-zone")
async def set_active_zone(req: ActiveZoneRequest):
    """设置当前激活项目区"""
    path = req.path.strip()

    async with aiosqlite.connect(DB_PATH) as db:
        zones_json = await _get_setting(db, "project_zones")
        zones = json.loads(zones_json) if zones_json else []

        if path and not any(z["path"] == path for z in zones):
            raise HTTPException(status_code=404, detail="项目区不存在，请先添加")

        await _set_setting(db, "active_zone", path)
        await _set_setting(db, "projects_root_path", path)
        await db.commit()

    return {"success": True, "active_zone": path}
