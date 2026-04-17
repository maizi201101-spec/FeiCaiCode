"""
提示词数据结构定义
Prompt 和 PromptsCollection 的 Pydantic 模型
"""

from pydantic import BaseModel
from typing import Optional, List


class Prompt(BaseModel):
    """单个镜头提示词"""
    shot_id: str           # 关联镜头ID
    group_id: str          # 关联镜头组ID
    image_prompt: str      # 图片提示词（自然短句格式）
    video_prompt: str      # 视频提示词（结构化字段格式）
    edited: bool = False   # 是否人工编辑过
    confirmed: bool = False # 是否人工确认


class PromptsCollection(BaseModel):
    """提示词集合（prompts.json 根对象）"""
    episode_id: int
    prompts: List[Prompt] = []
    generated_at: Optional[str] = None


class PromptUpdate(BaseModel):
    """提示词更新请求"""
    image_prompt: Optional[str] = None
    video_prompt: Optional[str] = None
    confirmed: Optional[bool] = None


class GlobalSettings(BaseModel):
    """项目全局设置"""
    global_prompt: str = ""     # 第1块全局提示词
    default_model: str = "seedance2.0"
    default_duration: int = 4
    default_resolution: str = "1080p"
    default_ratio: str = "9:16"


class SpecialPrompt(BaseModel):
    """特殊提示词配置（第2块）"""
    id: str                   # 配置ID
    content: str              # 提示词内容
    scope: str                # 作用范围：shot/group/episode/selected
    target_ids: List[str] = [] # 目标镜头/组ID列表（仅 selected 时使用）