"""全局系统设置 API
项目区路径等全局配置
"""

from fastapi import APIRouter, HTTPException
import aiosqlite
from pathlib import Path
from datetime import datetime

from database import DB_PATH

router = APIRouter(prefix="/api/system", tags=["system-settings"])


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