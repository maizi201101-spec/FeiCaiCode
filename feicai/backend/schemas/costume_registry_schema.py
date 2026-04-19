"""
装扮注册表数据结构定义
用于跨集装扮命名一致性
"""

from pydantic import BaseModel
from typing import List, Dict, Optional


class CostumeEntry(BaseModel):
    """单个装扮条目"""
    label: str  # 装扮标签（如「书生装」「囚服」）
    aliases: List[str] = []  # 别名列表（用户可编辑合并）
    episodes: List[str] = []  # 出现的集数列表（如 ["EP01", "EP02"]）
    variant_id: Optional[str] = None  # 资产绑定完成后回填


class CharacterCostumes(BaseModel):
    """角色的装扮列表"""
    costumes: List[CostumeEntry] = []


class CostumeRegistry(BaseModel):
    """装扮注册表根对象"""
    version: int = 1
    updated_at: str  # ISO 8601 时间戳
    characters: Dict[str, CharacterCostumes] = {}  # 角色名 -> 装扮列表


class CostumeRegistryUpdate(BaseModel):
    """装扮注册表更新请求（用户编辑 aliases）"""
    character_name: str
    costume_label: str
    aliases: List[str]
