from pydantic import BaseModel
from typing import Optional, Literal
from enum import Enum


class ScriptType(str, Enum):
    traditional = "traditional"  # 传统影视剧本
    storyboard = "storyboard"    # 分镜脚本


class ScriptUpload(BaseModel):
    content: str
    script_type: ScriptType = ScriptType.traditional
    is_full_series: bool = False  # 是否全集导入


class ScriptResponse(BaseModel):
    episode_id: int
    episode_number: int
    has_script: bool
    content: Optional[str] = None
    script_type: Optional[ScriptType] = None
    file_path: Optional[str] = None


class ScriptSplitRequest(BaseModel):
    content: str  # 全集剧本内容
    episode_count: int  # 预期集数


class ScriptSplitResult(BaseModel):
    episode_number: int
    content: str
    start_marker: Optional[str] = None  # 分割点标记


class ScriptSplitResponse(BaseModel):
    splits: list[ScriptSplitResult]
    total_episodes: int