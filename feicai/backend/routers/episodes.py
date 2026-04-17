from fastapi import APIRouter, HTTPException
from database import get_db
from models.project import EpisodeCreate, EpisodeResponse
import aiosqlite

router = APIRouter(prefix="/api/projects/{project_id}/episodes", tags=["episodes"])


@router.post("", response_model=EpisodeResponse, status_code=201)
async def create_episode(project_id: int, episode: EpisodeCreate):
    async with await get_db() as db:
        db.row_factory = aiosqlite.Row
        # 检查项目是否存在
        async with db.execute("SELECT id FROM projects WHERE id = ?", (project_id,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Project not found")
        # 插入集数
        try:
            async with db.execute(
                "INSERT INTO episodes (project_id, number, title) VALUES (?, ?, ?)",
                (project_id, episode.number, episode.title),
            ) as cur:
                episode_id = cur.lastrowid
            await db.commit()
        except aiosqlite.IntegrityError:
            raise HTTPException(status_code=409, detail="Episode number already exists")

        async with db.execute(
            "SELECT * FROM episodes WHERE id = ?", (episode_id,)
        ) as cur:
            row = await cur.fetchone()
        return dict(row)


@router.get("", response_model=list[EpisodeResponse])
async def list_episodes(project_id: int):
    async with await get_db() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM episodes WHERE project_id = ? ORDER BY number ASC", (project_id,)
        ) as cur:
            rows = await cur.fetchall()
        return [dict(r) for r in rows]


@router.delete("/{episode_id}", status_code=204)
async def delete_episode(project_id: int, episode_id: int):
    async with await get_db() as db:
        async with db.execute(
            "SELECT id FROM episodes WHERE id = ? AND project_id = ?", (episode_id, project_id)
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Episode not found")
        await db.execute("DELETE FROM episodes WHERE id = ?", (episode_id,))
        await db.commit()
