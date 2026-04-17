from pydantic import BaseModel
from typing import Optional, List


class VideoVersion(BaseModel):
    id: int
    shot_id: str
    episode_id: int
    group_id: str
    version_number: int
    status: str  # pending/generating/completed/failed
    video_prompt: str
    final_prompt: Optional[str] = None
    reference_images: List[str] = []
    anchor_declaration: Optional[str] = None
    model: str = "seedance2.0"
    duration: int = 4
    resolution: str = "1080p"
    video_path: Optional[str] = None
    submit_id: Optional[str] = None
    qc_status: str = "pending"  # pending/approved/rejected
    selected: bool = False
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class VideoVersionCreate(BaseModel):
    shot_id: str
    group_id: str
    video_prompt: str
    final_prompt: Optional[str] = None
    reference_images: List[str] = []
    anchor_declaration: str = ""
    model: str = "seedance2.0"
    duration: int = 4
    resolution: str = "1080p"


class VideoGenerationRequest(BaseModel):
    shot_id: str
    video_prompt: str
    reference_images: List[str] = []
    anchor_declaration: str = ""
    model: str = "seedance2.0"
    duration: int = 4
    resolution: str = "1080p"


class BatchGenerationRequest(BaseModel):
    group_id: Optional[str] = None
    all_groups: bool = False


class VideoStatusUpdate(BaseModel):
    qc_status: Optional[str] = None
    selected: Optional[bool] = None


class VideoVersionSummary(BaseModel):
    id: int
    shot_id: str
    group_id: str
    version_number: int
    status: str
    video_path: Optional[str]
    qc_status: str
    selected: bool
    created_at: str