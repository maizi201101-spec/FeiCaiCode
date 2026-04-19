"""剧本管理模块数据模型
全集剧本导入、AI 分集检测、分集梗概生成
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

from schemas.script import ScriptType


class DetectionLayer(str, Enum):
    """检测层级"""
    explicit_marker = "explicit_marker"    # 显式标记（95%）
    scene_title = "scene_title"            # 场景标题（80%）
    blank_line = "blank_line"              # 空白行模式（60%）
    content_structure = "content_structure" # 内容结构（50%)


class EpisodeSplitResult(BaseModel):
    """单集分割结果"""
    episode_number: int
    start_position: int      # 起始字符位置
    end_position: int        # 结束字符位置
    char_count: int          # 字数
    confidence: float        # 置信度 0-100
    detection_layer: DetectionLayer  # 检测层级
    is_abnormal: bool = False        # 是否异常
    abnormal_reason: Optional[str] = None   # 异常原因
    content_preview: str             # 内容预览（前100字）


class FullScriptUpload(BaseModel):
    """全集剧本上传请求"""
    content: str
    script_type: ScriptType = ScriptType.traditional
    expected_episodes: Optional[int] = None  # 预期集数（可选）


class SplitDetectionResponse(BaseModel):
    """分集检测结果响应"""
    results: List[EpisodeSplitResult]
    total_episodes: int
    total_chars: int
    avg_confidence: float
    avg_char_count: float
    has_gaps: bool = False          # 是否有中断
    gap_positions: List[int] = []   # 中断位置


class ConfirmSplitRequest(BaseModel):
    """确认分集请求"""
    splits: List[EpisodeSplitResult]  # 用户确认后的分割点
    generate_summaries: bool = True   # 是否自动生成梗概


class ConfirmSplitResponse(BaseModel):
    """确认分集响应"""
    success: bool
    created_episodes: int
    summaries_generated: int
    message: str


class EpisodeStatus(BaseModel):
    """单集状态"""
    episode_id: Optional[int] = None
    episode_number: int
    has_script: bool
    has_summary: bool
    status: str  # imported / summary_generated / pending


class FullSeriesStatusResponse(BaseModel):
    """全集状态响应"""
    episodes: List[EpisodeStatus]
    can_re_split: bool  # 是否可重新分集
    reason: Optional[str] = None  # 不可重新分集的原因


class EpisodeDetailResponse(BaseModel):
    """单集详情响应"""
    episode_id: int
    episode_number: int
    script_content: Optional[str] = None
    summary: Optional[str] = None
    has_script: bool
    has_summary: bool


class RegenerateSummaryResponse(BaseModel):
    """重新生成梗概响应"""
    episode_id: int
    episode_number: int
    summary: str
    message: str