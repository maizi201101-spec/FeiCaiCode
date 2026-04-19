from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class AssetType(str, Enum):
    character = "character"
    scene = "scene"
    prop = "prop"


class Variant(BaseModel):
    """稳定态变体"""
    variant_id: str
    variant_name: str
    trigger_condition: Optional[str] = None
    visual_diff: Optional[str] = None


class Character(BaseModel):
    """角色资产"""
    asset_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[str] = None
    appearance: Optional[str] = None
    outfit: Optional[str] = None
    base_asset: Optional[str] = None
    tags: List[str] = []
    variants: List[Variant] = []
    images: List[str] = []  # 设定图路径列表（Phase 5 扩展）


class Scene(BaseModel):
    """场景资产"""
    asset_id: str
    name: str
    description: Optional[str] = None
    visual_elements: List[str] = []
    time_of_day: Optional[str] = None
    lighting: Optional[str] = None
    variants: List[Variant] = []
    images: List[str] = []


class Prop(BaseModel):
    """道具资产"""
    asset_id: str
    name: str
    description: Optional[str] = None
    variants: List[Variant] = []
    images: List[str] = []


class AssetsCollection(BaseModel):
    """资产集合（assets.json 结构）"""
    characters: List[Character] = []
    scenes: List[Scene] = []
    props: List[Prop] = []


class AssetCreate(BaseModel):
    """创建资产请求"""
    asset_type: AssetType
    asset_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[str] = None
    appearance: Optional[str] = None
    outfit: Optional[str] = None
    description: Optional[str] = None
    visual_elements: List[str] = []
    time_of_day: Optional[str] = None
    lighting: Optional[str] = None
    tags: List[str] = []
    variants: List[Variant] = []
    base_asset: Optional[str] = None


class AssetUpdate(BaseModel):
    """更新资产请求"""
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    appearance: Optional[str] = None
    outfit: Optional[str] = None
    description: Optional[str] = None
    visual_elements: Optional[List[str]] = None
    time_of_day: Optional[str] = None
    lighting: Optional[str] = None
    tags: Optional[List[str]] = None
    variants: Optional[List[Variant]] = None
    base_asset: Optional[str] = None


class AssetResponse(BaseModel):
    """资产响应"""
    asset_type: AssetType
    asset_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[str] = None
    appearance: Optional[str] = None
    outfit: Optional[str] = None
    description: Optional[str] = None
    visual_elements: List[str] = []
    time_of_day: Optional[str] = None
    lighting: Optional[str] = None
    tags: List[str] = []
    variants: List[Variant] = []
    base_asset: Optional[str] = None
    images: List[str] = []


class ExtractRequest(BaseModel):
    """AI 提取资产请求"""
    episode_ids: List[int]  # 要提取的集数 ID 列表
    merge_mode: bool = True  # 是否合并到现有资产库


class ExtractProgress(BaseModel):
    """提取进度响应"""
    episode_id: int
    episode_number: int
    status: str  # pending / processing / completed / failed
    characters_count: int = 0
    scenes_count: int = 0
    props_count: int = 0
    summary: Optional[str] = None
    error: Optional[str] = None
    # 实际提取的资产数据（仅内部流转，API 响应中排除）
    characters: List[Character] = []
    scenes: List[Scene] = []
    props: List[Prop] = []