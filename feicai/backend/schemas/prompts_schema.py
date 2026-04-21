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


class GroupPrompt(BaseModel):
    """组级视频提示词（仅在用户编辑后持久化）"""
    group_id: str
    combined_video_prompt: str  # 组合后的完整视频提示词
    reference_asset_ids: List[str] = []  # 该组引用的资产ID列表（去重）
    edited: bool = False        # 是否手动编辑过
    confirmed: bool = False     # 是否确认
    last_auto_generated: Optional[str] = None  # 最后一次自动生成的时间戳


class PromptsCollection(BaseModel):
    """提示词集合（prompts.json 根对象）"""
    episode_id: int
    prompts: List[Prompt] = []
    group_prompts: List[GroupPrompt] = []  # 组级提示词（可选，仅在编辑后存在）
    generated_at: Optional[str] = None


class PromptUpdate(BaseModel):
    """提示词更新请求"""
    image_prompt: Optional[str] = None
    video_prompt: Optional[str] = None
    confirmed: Optional[bool] = None


class GroupPromptUpdate(BaseModel):
    """组级提示词更新请求"""
    combined_video_prompt: str
    reference_asset_ids: Optional[List[str]] = None
    confirmed: Optional[bool] = None


class GlobalSettings(BaseModel):
    """项目全局设置"""
    # 第1块全局提示词
    global_prompt: str = ""

    # 视频生成默认参数
    default_model: str = "seedance2.0"
    default_duration: int = 4
    default_resolution: str = "1080p"
    default_ratio: str = "9:16"

    # LLM 配置
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4"

    # 即梦 CLI 配置
    jimeng_cli_path: str = ""

    # 图片生成默认参数
    default_image_model: str = "dall-e-3"
    default_image_size: str = "1024x1024"

    # 分镜规划并发数（1/2/3）
    plan_concurrency: int = 1


class SpecialPrompt(BaseModel):
    """特殊提示词配置（第2块）"""
    id: str                   # 配置ID
    content: str              # 提示词内容
    scope: str                # 作用范围：shot/group/episode/selected
    target_ids: List[str] = [] # 目标镜头/组ID列表（仅 selected 时使用）