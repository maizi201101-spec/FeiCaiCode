"""
装扮注册表服务
负责 costume_registry.json 的读写、upsert、转文本格式注入 LLM
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from schemas.costume_registry_schema import (
    CostumeRegistry,
    CharacterCostumes,
    CostumeEntry
)


class CostumeRegistryService:
    """装扮注册表服务"""

    @staticmethod
    def get_registry_path(project_path: str) -> str:
        """获取注册表文件路径"""
        return os.path.join(project_path, "costume_registry.json")

    @staticmethod
    def load_registry(project_path: str) -> CostumeRegistry:
        """加载装扮注册表，不存在则返回空注册表"""
        registry_path = CostumeRegistryService.get_registry_path(project_path)

        if not os.path.exists(registry_path):
            return CostumeRegistry(
                version=1,
                updated_at=datetime.utcnow().isoformat() + "Z",
                characters={}
            )

        try:
            with open(registry_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return CostumeRegistry(**data)
        except Exception as e:
            print(f"加载 costume_registry.json 失败: {e}")
            return CostumeRegistry(
                version=1,
                updated_at=datetime.utcnow().isoformat() + "Z",
                characters={}
            )

    @staticmethod
    def save_registry(project_path: str, registry: CostumeRegistry) -> None:
        """保存装扮注册表"""
        registry_path = CostumeRegistryService.get_registry_path(project_path)
        registry.updated_at = datetime.utcnow().isoformat() + "Z"

        # 确保项目目录存在
        os.makedirs(os.path.dirname(registry_path), exist_ok=True)

        with open(registry_path, 'w', encoding='utf-8') as f:
            json.dump(registry.model_dump(), f, ensure_ascii=False, indent=2)

    @staticmethod
    def upsert_from_asset_refs(
        project_path: str,
        episode_id: str,
        asset_refs_list: List[Dict]
    ) -> None:
        """
        从分镜 asset_refs 列表中提取装扮信息，upsert 到注册表

        Args:
            project_path: 项目路径
            episode_id: 集数 ID（如 "EP01"）
            asset_refs_list: 所有镜头的 asset_refs 列表
        """
        registry = CostumeRegistryService.load_registry(project_path)

        # 收集本集出现的 (角色名, 装扮) 组合
        character_costumes: Dict[str, set] = {}

        for asset_refs in asset_refs_list:
            if not asset_refs:
                continue

            characters = asset_refs.get("characters", [])
            for char in characters:
                name = char.get("name", "").strip()
                costume = char.get("costume", "").strip()

                if not name or not costume:
                    continue

                if name not in character_costumes:
                    character_costumes[name] = set()
                character_costumes[name].add(costume)

        # Upsert 到注册表
        for char_name, costumes in character_costumes.items():
            if char_name not in registry.characters:
                registry.characters[char_name] = CharacterCostumes(costumes=[])

            char_costumes = registry.characters[char_name]

            for costume_label in costumes:
                # 查找是否已存在该装扮
                existing = None
                for entry in char_costumes.costumes:
                    if entry.label == costume_label:
                        existing = entry
                        break

                if existing:
                    # 更新 episodes 列表（去重）
                    if episode_id not in existing.episodes:
                        existing.episodes.append(episode_id)
                        existing.episodes.sort()
                else:
                    # 新增装扮条目
                    char_costumes.costumes.append(CostumeEntry(
                        label=costume_label,
                        aliases=[],
                        episodes=[episode_id],
                        variant_id=None
                    ))

        CostumeRegistryService.save_registry(project_path, registry)

    @staticmethod
    def to_llm_context(registry: CostumeRegistry) -> str:
        """
        将注册表转为简短文本格式，用于注入 LLM context

        Returns:
            格式化的文本，如：
            【装扮注册表】
            张三：书生装（EP01-03）、囚服（EP04）
            李四：黑色长袍村民装（EP01-02）

            请严格使用上述装扮词，不要创造新称呼。
        """
        if not registry.characters:
            return ""

        lines = ["【装扮注册表】"]

        for char_name, char_costumes in registry.characters.items():
            if not char_costumes.costumes:
                continue

            costume_strs = []
            for entry in char_costumes.costumes:
                # 格式：装扮名（集数范围）
                if len(entry.episodes) == 1:
                    ep_range = entry.episodes[0]
                elif len(entry.episodes) > 1:
                    # 尝试压缩连续集数
                    first = entry.episodes[0]
                    last = entry.episodes[-1]
                    if len(entry.episodes) > 2:
                        ep_range = f"{first}-{last}"
                    else:
                        ep_range = "、".join(entry.episodes)
                else:
                    ep_range = ""

                costume_strs.append(f"{entry.label}（{ep_range}）")

            lines.append(f"{char_name}：{'、'.join(costume_strs)}")

        lines.append("")
        lines.append("请严格使用上述装扮词，不要创造新称呼。")

        return "\n".join(lines)

    @staticmethod
    def update_aliases(
        project_path: str,
        character_name: str,
        costume_label: str,
        aliases: List[str]
    ) -> None:
        """更新某个装扮的 aliases（用户编辑）"""
        registry = CostumeRegistryService.load_registry(project_path)

        if character_name not in registry.characters:
            raise ValueError(f"角色 {character_name} 不存在")

        char_costumes = registry.characters[character_name]

        for entry in char_costumes.costumes:
            if entry.label == costume_label:
                entry.aliases = aliases
                CostumeRegistryService.save_registry(project_path, registry)
                return

        raise ValueError(f"装扮 {costume_label} 不存在")
