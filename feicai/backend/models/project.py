from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EpisodeBase(BaseModel):
    title: str
    episode_number: int
    description: Optional[str] = None


class EpisodeCreate(EpisodeBase):
    project_id: int


class Episode(EpisodeBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    total_episodes: Optional[int] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    total_episodes: Optional[int] = None


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    episodes: list[Episode] = []

    class Config:
        from_attributes = True
