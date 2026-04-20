"""
预设库数据结构定义
Preset 和 PresetCategory 的 Pydantic 模型
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class PresetCategory(str, Enum):
    """预设分类"""
    STORYBOARD_STYLE = "storyboard_style"      # 分镜规划风格
    VIDEO_PROMPT_STYLE = "video_prompt_style"  # 视频提示词风格
    IMAGE_PROMPT_STYLE = "image_prompt_style"  # 图片提示词风格
    SPECIAL_EFFECT = "special_effect"          # 特殊效果预设
    ASSET_EXTRACTION = "asset_extraction"      # 资产提取规则
    VIDEO_MODEL_SPEC = "video_model_spec"      # 视频模型规格


class ModelSpec(BaseModel):
    """视频模型规格（仅 video_model_spec 类别有效）"""
    max_group_duration: int = 15     # 组时长上限（秒）
    max_ref_images: int = 4          # 参考图数量上限
    default_params: Dict[str, Any] = {}  # 默认生成参数


class Preset(BaseModel):
    """预设结构"""
    preset_id: str
    name: str
    category: PresetCategory
    description: str = ""
    content: str                     # 实际 prompt 内容
    model_spec: Optional[ModelSpec] = None  # 仅视频模型规格类有效
    is_active: bool = False          # 是否激活
    is_builtin: bool = False         # 是否内置预设
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PresetCreate(BaseModel):
    """创建预设请求"""
    name: str
    category: PresetCategory
    description: str = ""
    content: str
    model_spec: Optional[ModelSpec] = None


class PresetUpdate(BaseModel):
    """更新预设请求"""
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    model_spec: Optional[ModelSpec] = None
    is_active: Optional[bool] = None


class PresetList(BaseModel):
    """预设列表响应"""
    presets: List[Preset] = []


class ActivePresets(BaseModel):
    """项目激活的预设"""
    storyboard_style: Optional[str] = None   # 激活的分镜规划风格预设ID
    video_prompt_style: Optional[str] = None # 激活的视频提示词风格预设ID
    image_prompt_style: Optional[str] = None # 激活的图片提示词风格预设ID
    special_effects: List[str] = []          # 激活的特殊效果预设ID列表
    asset_extraction: Optional[str] = None   # 激活的资产提取规则预设ID
    video_model_spec: Optional[str] = None   # 激活的视频模型规格预设ID