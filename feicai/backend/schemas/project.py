from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Episode Schemas ──────────────────────────────────────────────────────────

class EpisodeCreate(BaseModel):
    number: int
    title: Optional[str] = None


class EpisodeUpdate(BaseModel):
    number: Optional[int] = None
    title: Optional[str] = None


class EpisodeResponse(BaseModel):
    id: int
    project_id: int
    number: int
    title: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ── Project Schemas ───────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    path: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    path: str
    created_at: str
    updated_at: str
    episode_count: Optional[int] = 0

    class Config:
        from_attributes = True
