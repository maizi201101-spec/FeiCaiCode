"""
质检数据结构定义
组级别质检状态、QC 数据聚合
"""

from typing import Optional, List
from pydantic import BaseModel


class GroupStatus(BaseModel):
    """组质检状态"""
    id: int
    episode_id: int
    group_id: str
    status: str  # pending/approved/revision
    selected_version_id: Optional[int] = None
    revision_note: Optional[str] = None
    created_at: str
    updated_at: str


class GroupStatusUpdate(BaseModel):
    """更新组质检状态"""
    status: Optional[str] = None
    selected_version_id: Optional[int] = None
    revision_note: Optional[str] = None


class VideoVersionSummary(BaseModel):
    """视频版本摘要"""
    id: int
    shot_id: str
    group_id: str
    version_number: int
    status: str
    video_path: Optional[str] = None
    qc_status: str
    selected: bool
    created_at: str


class GroupQCData(BaseModel):
    """组质检数据（含视频版本聚合）"""
    group_id: str
    total_duration: float
    status: str
    selected_version_id: Optional[int] = None
    revision_note: Optional[str] = None
    videos: List[VideoVersionSummary] = []