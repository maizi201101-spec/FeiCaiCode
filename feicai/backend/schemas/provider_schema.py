"""
提供商配置数据结构定义
Provider 的 Pydantic 模型
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class ProviderType(str, Enum):
    """提供商类型"""
    LLM = "llm"               # LLM 提供商
    IMAGE = "image"           # 图片模型提供商
    VIDEO = "video"           # 视频模型提供商


class ProviderImplType(str, Enum):
    """提供商实现类型"""
    JIMENG_CLI = "jimeng_cli"  # 即梦 CLI
    HTTP_API = "http_api"      # HTTP API


class LLMUsageTag(str, Enum):
    """LLM 用途标签"""
    ASSET_EXTRACT = "asset_extract"     # 资产提取
    STORYBOARD_PLAN = "storyboard_plan" # 分镜规划
    PROMPT_GENERATE = "prompt_generate" # 提示词生成


class Provider(BaseModel):
    """提供商配置"""
    provider_id: str
    name: str
    provider_type: ProviderType
    impl_type: ProviderImplType = ProviderImplType.HTTP_API

    # HTTP API 配置
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None

    # CLI 配置
    cli_path: Optional[str] = None

    # LLM 特有：用途标签
    usage_tags: List[LLMUsageTag] = []

    # 图片模型特有：默认参数
    default_image_params: dict = {}

    # 视频模型特有：关联预设
    video_spec_preset_id: Optional[str] = None

    # 状态
    is_active: bool = False
    is_builtin: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProviderCreate(BaseModel):
    """创建提供商请求"""
    name: str
    provider_type: ProviderType
    impl_type: ProviderImplType = ProviderImplType.HTTP_API
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None
    cli_path: Optional[str] = None
    usage_tags: List[LLMUsageTag] = []
    default_image_params: dict = {}
    video_spec_preset_id: Optional[str] = None


class ProviderUpdate(BaseModel):
    """更新提供商请求"""
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None
    cli_path: Optional[str] = None
    usage_tags: Optional[List[LLMUsageTag]] = None
    default_image_params: Optional[dict] = None
    video_spec_preset_id: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectProviders(BaseModel):
    """项目默认提供商"""
    llm_provider_id: Optional[str] = None
    image_provider_id: Optional[str] = None
    video_provider_id: Optional[str] = None


class ProviderList(BaseModel):
    """提供商列表响应"""
    providers: List[Provider] = []