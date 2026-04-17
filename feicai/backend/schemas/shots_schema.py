"""
分镜数据结构定义
镜头（Shot）和镜头组（ShotGroup）的 Pydantic 模型
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class ShotType(str, Enum):
    """镜头类型"""
    empty = "空境"
    dialogue = "对话"
    action_conflict = "行动冲突"
    fight = "打斗"
    dispatch = "调度"


class ShotSize(str, Enum):
    """景别"""
    extreme_long = "大远景"
    long = "远景"
    full = "全景"
    medium = "中景"
    medium_close = "中近景"
    close = "近景"
    extreme_close = "特写"


class CameraMove(str, Enum):
    """运镜方式"""
    static = "固定"
    slow_push = "缓慢推进"
    fast_push = "快速推进"
    slow_pull = "缓慢拉开"
    fast_pull = "快速拉开"
    slow_pan = "缓慢横移"
    slow_left_tilt = "缓慢左摇"
    slow_right_tilt = "缓慢右摇"
    follow = "跟随"
    handheld_follow = "手持跟随"
    slow_rise = "缓慢升起"
    slow_descend = "缓慢下降"
    slow_circle = "缓慢环绕"
    fast_circle = "快速环绕"
    fast_swing = "快速摇摄"


class SpeechLine(BaseModel):
    """台词行"""
    type: str  # "dialogue" / "os"（旁白）
    speaker: str
    text: str


class TimeRange(BaseModel):
    """时间范围"""
    start_sec: float
    end_sec: float


class Shot(BaseModel):
    """单个镜头"""
    shot_id: str  # "01", "02"
    group_id: str  # "G01", "G02"
    scene_id: str  # 场景资产追踪ID
    time_range: TimeRange
    duration: float  # end_sec - start_sec
    shot_type: ShotType
    shot_size: ShotSize
    camera_move: CameraMove
    assets: List[str] = []  # 资产ID列表
    frame_action: str  # 画面描述
    lighting: Optional[str] = None
    screen_text: Optional[str] = None
    speech: List[SpeechLine] = []
    time_of_day: Optional[str] = None


class ShotGroup(BaseModel):
    """镜头组"""
    group_id: str  # "G01"
    shots: List[str] = []  # 组内镜头ID列表
    total_duration: float = 0.0  # 组时长（秒）
    scene_context: str = ""  # 组主要场景说明


class ShotsCollection(BaseModel):
    """分镜集合（shots.json 根对象）"""
    episode_id: int
    shots: List[Shot] = []
    groups: List[ShotGroup] = []


class ShotUpdate(BaseModel):
    """镜头更新请求"""
    shot_type: Optional[ShotType] = None
    shot_size: Optional[ShotSize] = None
    camera_move: Optional[CameraMove] = None
    frame_action: Optional[str] = None
    lighting: Optional[str] = None
    screen_text: Optional[str] = None
    speech: Optional[List[SpeechLine]] = None
    assets: Optional[List[str]] = None
    time_of_day: Optional[str] = None


class GroupUpdate(BaseModel):
    """镜头归组更新请求"""
    group_id: str


def get_duration_color(duration: float) -> str:
    """
    根据组时长返回颜色标识
    ≤15s: green, 15-17s: yellow, >17s: red
    """
    if duration <= 15:
        return "green"
    elif duration <= 17:
        return "yellow"
    else:
        return "red"