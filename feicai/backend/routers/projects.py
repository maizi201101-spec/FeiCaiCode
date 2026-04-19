from fastapi import APIRouter, HTTPException, Depends
from typing import List
import aiosqlite
from datetime import datetime

from database import get_db
from schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    EpisodeCreate, EpisodeUpdate, EpisodeResponse,
)
from services.project_service import init_project_dirs

router = APIRouter(prefix="/projects", tags=["projects"])


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ── Projects ──────────────────────────────────────────────────────────────────

@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db=Depends(get_db)):
    async with db as conn:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        # 先创建项目目录结构
        try:
            init_project_dirs(project.path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"无法创建项目目录: {str(e)}")

        try:
            cursor = await conn.execute(
                "INSERT INTO projects (name, path, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (project.name, project.path, now, now),
            )
            await conn.commit()
            row = await (await conn.execute(
                "SELECT id, name, path, created_at, updated_at FROM projects WHERE id = ?",
                (cursor.lastrowid,),
            )).fetchone()
        except aiosqlite.IntegrityError:
            raise HTTPException(status_code=400, detail="路径已被其他项目使用")
        return ProjectResponse(
            id=row[0], name=row[1], path=row[2],
            created_at=row[3], updated_at=row[4], episode_count=0,
        )


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db=Depends(get_db)):
    async with db as conn:
        rows = await (await conn.execute(
            """
            SELECT p.id, p.name, p.path, p.created_at, p.updated_at,
                   COUNT(e.id) AS episode_count
            FROM projects p
            LEFT JOIN episodes e ON e.project_id = p.id
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            """
        )).fetchall()
    return [
        ProjectResponse(id=r[0], name=r[1], path=r[2],
                        created_at=r[3], updated_at=r[4], episode_count=r[5])
        for r in rows
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db=Depends(get_db)):
    async with db as conn:
        row = await (await conn.execute(
            """
            SELECT p.id, p.name, p.path, p.created_at, p.updated_at,
                   COUNT(e.id) AS episode_count
            FROM projects p
            LEFT JOIN episodes e ON e.project_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
            """,
            (project_id,),
        )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(id=row[0], name=row[1], path=row[2],
                           created_at=row[3], updated_at=row[4], episode_count=row[5])


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: int, project: ProjectUpdate, db=Depends(get_db)):
    async with db as conn:
        row = await (await conn.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        )).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        updates = project.dict(exclude_unset=True)
        updates["updated_at"] = now
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        await conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            (*updates.values(), project_id),
        )
        await conn.commit()
        row = await (await conn.execute(
            """
            SELECT p.id, p.name, p.path, p.created_at, p.updated_at,
                   COUNT(e.id) AS episode_count
            FROM projects p
            LEFT JOIN episodes e ON e.project_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
            """,
            (project_id,),
        )).fetchone()
    return ProjectResponse(id=row[0], name=row[1], path=row[2],
                           created_at=row[3], updated_at=row[4], episode_count=row[5])


@router.delete("/{project_id}")
async def delete_project(project_id: int, db=Depends(get_db)):
    async with db as conn:
        row = await (await conn.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        )).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        await conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await conn.commit()
    return {"message": "Project deleted"}


# ── Episodes ──────────────────────────────────────────────────────────────────

@router.post("/{project_id}/episodes", response_model=EpisodeResponse)
async def create_episode(project_id: int, episode: EpisodeCreate, db=Depends(get_db)):
    async with db as conn:
        proj = await (await conn.execute(
            "SELECT id FROM projects WHERE id = ?", (project_id,)
        )).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        try:
            cursor = await conn.execute(
                "INSERT INTO episodes (project_id, number, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (project_id, episode.number, episode.title, now, now),
            )
            await conn.commit()
            row = await (await conn.execute(
                "SELECT id, project_id, number, title, created_at, updated_at FROM episodes WHERE id = ?",
                (cursor.lastrowid,),
            )).fetchone()
        except aiosqlite.IntegrityError:
            raise HTTPException(status_code=400, detail="该集数已存在")
    return EpisodeResponse(id=row[0], project_id=row[1], number=row[2],
                           title=row[3], created_at=row[4], updated_at=row[5])


@router.get("/{project_id}/episodes", response_model=List[EpisodeResponse])
async def list_episodes(project_id: int, db=Depends(get_db)):
    async with db as conn:
        rows = await (await conn.execute(
            "SELECT id, project_id, number, title, created_at, updated_at FROM episodes WHERE project_id = ? ORDER BY number",
            (project_id,),
        )).fetchall()
    return [
        EpisodeResponse(id=r[0], project_id=r[1], number=r[2],
                        title=r[3], created_at=r[4], updated_at=r[5])
        for r in rows
    ]


@router.put("/{project_id}/episodes/{episode_id}", response_model=EpisodeResponse)
async def update_episode(project_id: int, episode_id: int, episode: EpisodeUpdate, db=Depends(get_db)):
    async with db as conn:
        row = await (await conn.execute(
            "SELECT id FROM episodes WHERE id = ? AND project_id = ?",
            (episode_id, project_id),
        )).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Episode not found")
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        updates = episode.dict(exclude_unset=True)
        updates["updated_at"] = now
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        await conn.execute(
            f"UPDATE episodes SET {set_clause} WHERE id = ?",
            (*updates.values(), episode_id),
        )
        await conn.commit()
        row = await (await conn.execute(
            "SELECT id, project_id, number, title, created_at, updated_at FROM episodes WHERE id = ?",
            (episode_id,),
        )).fetchone()
    return EpisodeResponse(id=row[0], project_id=row[1], number=row[2],
                           title=row[3], created_at=row[4], updated_at=row[5])


@router.delete("/{project_id}/episodes/{episode_id}")
async def delete_episode(project_id: int, episode_id: int, db=Depends(get_db)):
    async with db as conn:
        row = await (await conn.execute(
            "SELECT id FROM episodes WHERE id = ? AND project_id = ?",
            (episode_id, project_id),
        )).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Episode not found")
        await conn.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))
        await conn.commit()
    return {"message": "Episode deleted"}
