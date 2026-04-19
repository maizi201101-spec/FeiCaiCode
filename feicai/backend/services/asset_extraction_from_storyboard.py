"""
资产提取服务 v1.7 - 从分镜 asset_refs 坍缩提取资产
不再从原始剧本提取，而是从 shots.json 的 asset_refs 字段坍缩得到资产列表
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple

from schemas.assets_schema import Character, Scene, Prop, AssetsCollection, Variant
from services.script_service import get_episode_info, get_project_path


async def collapse_asset_refs_from_shots(
    episode_id: int,
    project_id: int,
) -> Dict[str, List[Dict]]:
    """从分镜 asset_refs 坍缩提取资产

    输入：shots.json 中所有镜头的 asset_refs
    输出：按 (角色名, 装扮label) 分组的资产列表

    Returns:
        {
            "characters": [
                {
                    "name": "张三",
                    "costumes": ["书生装", "囚服"],
                    "episodes": ["EP01"]
                }
            ],
            "scenes": [
                {
                    "name": "书房",
                    "episodes": ["EP01"]
                }
            ],
            "props": [
                {
                    "name": "毛笔",
                    "episodes": ["EP01"]
                }
            ]
        }
    """
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(project_id)
    if not project_path:
        raise ValueError("项目路径不存在")

    # 读取 shots.json
    shots_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "shots.json"
    if not shots_file.exists():
        raise ValueError("分镜文件不存在，请先完成分镜规划")

    shots_data = json.loads(shots_file.read_text(encoding="utf-8"))
    shots = shots_data.get("shots", [])

    episode_id_str = f"EP{episode['number']:02d}"

    # 坍缩角色+装扮组合
    character_costumes: Dict[str, Set[str]] = {}  # name -> {costume1, costume2}
    scenes: Set[str] = set()
    props: Set[str] = set()

    for shot in shots:
        asset_refs = shot.get("asset_refs")
        if not asset_refs:
            continue

        # 角色+装扮
        for char_ref in asset_refs.get("characters", []):
            name = char_ref.get("name", "").strip()
            costume = char_ref.get("costume", "").strip()
            if name and costume:
                if name not in character_costumes:
                    character_costumes[name] = set()
                character_costumes[name].add(costume)

        # 场景（字符串数组）
        for scene_name in asset_refs.get("scenes", []):
            if scene_name.strip():
                scenes.add(scene_name.strip())

        # 道具
        for prop_name in asset_refs.get("props", []):
            if prop_name.strip():
                props.add(prop_name.strip())

    # 组装输出
    result = {
        "characters": [
            {
                "name": name,
                "costumes": sorted(list(costumes)),
                "episodes": [episode_id_str]
            }
            for name, costumes in sorted(character_costumes.items())
        ],
        "scenes": [
            {
                "name": scene_name,
                "episodes": [episode_id_str]
            }
            for scene_name in sorted(scenes)
        ],
        "props": [
            {
                "name": prop_name,
                "episodes": [episode_id_str]
            }
            for prop_name in sorted(props)
        ]
    }

    return result


def _next_asset_id(prefix: str, existing_ids: Set[str]) -> str:
    """生成不冲突的 asset_id"""
    i = 1
    while f"{prefix}{i}" in existing_ids:
        i += 1
    return f"{prefix}{i}"


async def generate_assets_from_collapsed_refs(
    collapsed_refs: Dict[str, List[Dict]],
    project_id: int,
) -> AssetsCollection:
    """从坍缩的 asset_refs 生成 assets.json

    角色：每个 (name, costume) 组合创建一个 variant
    场景：每个场景名创建一个 scene asset（无 variant）
    道具：每个道具名创建一个 prop asset（无 variant）
    """
    from services.asset_service import read_assets

    existing = await read_assets(project_id)

    # 已有 asset_id 集合
    existing_ids: Set[str] = set()
    existing_ids.update(c.asset_id for c in existing.characters)
    existing_ids.update(s.asset_id for s in existing.scenes)
    existing_ids.update(p.asset_id for p in existing.props)

    # 已有资产名称索引
    existing_chars_by_name: Dict[str, Character] = {c.name: c for c in existing.characters}
    existing_scenes_by_name: Dict[str, Scene] = {s.name: s for s in existing.scenes}
    existing_props_by_name: Dict[str, Prop] = {p.name: p for p in existing.props}

    final_chars: List[Character] = []
    final_scenes: List[Scene] = []
    final_props: List[Prop] = []

    # 处理角色
    for char_data in collapsed_refs.get("characters", []):
        name = char_data["name"]
        costumes = char_data["costumes"]

        if name in existing_chars_by_name:
            # 已有角色，添加新 variant
            char = existing_chars_by_name[name]
            existing_variant_names = {v.variant_name for v in char.variants}

            for costume in costumes:
                if costume not in existing_variant_names:
                    # 生成 variant_id
                    existing_variant_ids = {v.variant_id for v in char.variants}
                    variant_num = len(char.variants) + 1
                    while f"v{variant_num}" in existing_variant_ids:
                        variant_num += 1

                    char.variants.append(Variant(
                        variant_id=f"v{variant_num}",
                        variant_name=costume,
                        trigger_condition=f"角色穿着{costume}",
                        visual_diff=f"装扮：{costume}"
                    ))

            final_chars.append(char)
        else:
            # 新角色
            asset_id = _next_asset_id("人物", existing_ids)
            existing_ids.add(asset_id)

            variants = [
                Variant(
                    variant_id=f"v{i+1}",
                    variant_name=costume,
                    trigger_condition=f"角色穿着{costume}",
                    visual_diff=f"装扮：{costume}"
                )
                for i, costume in enumerate(costumes)
            ]

            final_chars.append(Character(
                asset_id=asset_id,
                name=name,
                appearance=f"{name}的外观描述（待补充）",
                gender="",
                age="",
                outfit="",
                variants=variants,
                tags=[],
                images=[],
                needs_review=True
            ))

    # 处理场景（无 variant）
    for scene_data in collapsed_refs.get("scenes", []):
        name = scene_data["name"]

        if name in existing_scenes_by_name:
            # 已有场景，直接保留
            final_scenes.append(existing_scenes_by_name[name])
        else:
            # 新场景
            asset_id = _next_asset_id("场景", existing_ids)
            existing_ids.add(asset_id)

            final_scenes.append(Scene(
                asset_id=asset_id,
                name=name,
                description=f"{name}的场景描述（待补充）",
                visual_elements=[],
                time_of_day="",
                lighting="",
                variants=[],  # 场景无 variant
                tags=[],
                images=[],
                needs_review=True
            ))

    # 处理道具（无 variant）
    for prop_data in collapsed_refs.get("props", []):
        name = prop_data["name"]

        if name in existing_props_by_name:
            # 已有道具，直接保留
            final_props.append(existing_props_by_name[name])
        else:
            # 新道具
            asset_id = _next_asset_id("道具", existing_ids)
            existing_ids.add(asset_id)

            final_props.append(Prop(
                asset_id=asset_id,
                name=name,
                description=f"{name}的道具描述（待补充）",
                variants=[],  # 道具无 variant
                tags=[],
                images=[],
                needs_review=True
            ))

    # 保留未出现在本次提取中的已有资产
    extracted_char_names = {c["name"] for c in collapsed_refs.get("characters", [])}
    extracted_scene_names = {s["name"] for s in collapsed_refs.get("scenes", [])}
    extracted_prop_names = {p["name"] for p in collapsed_refs.get("props", [])}

    for char in existing.characters:
        if char.name not in extracted_char_names:
            final_chars.append(char)

    for scene in existing.scenes:
        if scene.name not in extracted_scene_names:
            final_scenes.append(scene)

    for prop in existing.props:
        if prop.name not in extracted_prop_names:
            final_props.append(prop)

    return AssetsCollection(
        characters=final_chars,
        scenes=final_scenes,
        props=final_props
    )


async def extract_assets_from_storyboard(
    episode_id: int,
    project_id: int,
) -> Dict:
    """完整的资产提取流程（v1.7 架构）

    1. 从 shots.json 坍缩 asset_refs
    2. 生成 assets.json
    3. 返回提取结果
    """
    from services.asset_service import write_assets

    # 坍缩 asset_refs
    collapsed = await collapse_asset_refs_from_shots(episode_id, project_id)

    # 生成资产
    assets = await generate_assets_from_collapsed_refs(collapsed, project_id)

    # 写入 assets.json
    await write_assets(project_id, assets)

    return {
        "status": "completed",
        "characters_count": len([c for c in collapsed.get("characters", [])]),
        "scenes_count": len(collapsed.get("scenes", [])),
        "props_count": len(collapsed.get("props", [])),
        "collapsed_refs": collapsed
    }
