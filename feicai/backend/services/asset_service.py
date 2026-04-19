import json
import aiosqlite
from pathlib import Path
from typing import Optional, List
import re

from schemas.assets_schema import (
    Character, Scene, Prop, AssetsCollection, Variant, ExtractProgress
)
from services.llm_client import call_llm
from services.script_service import get_episode_info, get_project_path

DB_PATH = Path(__file__).parent.parent / "feicai.db"

VALID_ASSET_TYPES = {"character", "scene", "prop"}


async def get_assets_path(project_id: int) -> Optional[Path]:
    """获取项目 assets.json 文件路径"""
    project_path = await get_project_path(project_id)
    if not project_path:
        return None
    return Path(project_path) / "assets.json"


async def read_assets(project_id: int) -> AssetsCollection:
    """读取项目资产库"""
    assets_path = await get_assets_path(project_id)
    if not assets_path or not assets_path.exists():
        return AssetsCollection()

    content = assets_path.read_text(encoding="utf-8")
    data = json.loads(content)
    return AssetsCollection(
        characters=[Character(**c) for c in data.get("characters", [])],
        scenes=[Scene(**s) for s in data.get("scenes", [])],
        props=[Prop(**p) for p in data.get("props", [])],
    )


async def write_assets(project_id: int, assets: AssetsCollection) -> None:
    """写入项目资产库"""
    assets_path = await get_assets_path(project_id)
    if not assets_path:
        raise ValueError("项目路径不存在")

    assets_path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(assets.model_dump(), ensure_ascii=False, indent=2)
    assets_path.write_text(content, encoding="utf-8")


async def extract_assets_from_episode(
    episode_id: int, project_id: int
) -> ExtractProgress:
    """从单集剧本提取资产"""
    episode = await get_episode_info(episode_id)
    if not episode:
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=0,
            status="failed",
            error="集数不存在"
        )

    # 读取剧本
    project_path = await get_project_path(project_id)
    if not project_path:
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=episode["number"],
            status="failed",
            error="项目路径不存在"
        )

    script_file = Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "script.txt"
    if not script_file.exists():
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=episode["number"],
            status="failed",
            error="剧本不存在"
        )

    script_content = script_file.read_text(encoding="utf-8")

    # 构造 LLM prompt
    prompt = f"""请分析以下剧本内容，提取角色、场景、道具资产，并生成该集梗概。

剧本内容：
{script_content[:2000]}

请按以下 JSON 格式输出：
```json
{{
  "summary": "该集梗概（100-200字）",
  "characters": [
    {{
      "asset_id": "人物1",
      "name": "角色名称",
      "gender": "性别",
      "age": "年龄描述",
      "appearance": "视觉化外貌描述",
      "outfit": "服装描述",
      "tags": [],
      "variants": []
    }}
  ],
  "scenes": [
    {{
      "asset_id": "场景1",
      "name": "场景名称",
      "description": "场景描述",
      "visual_elements": ["关键视觉元素"],
      "time_of_day": "时间",
      "lighting": "光线",
      "variants": []
    }}
  ],
  "props": [
    {{
      "asset_id": "道具1",
      "name": "道具名称",
      "description": "道具描述",
      "variants": []
    }}
  ]
}}
```

识别规则：
1. 角色：出场的人物，提取外貌特征、服装等视觉信息
2. 场景：故事发生的地点，提取环境特征、光线等
3. 道具：重要物品，提取外观描述
4. variants：如有持续多集的明显视觉变化（伪装、重伤等），需标注
5. summary：该集剧情梗概，100-200字
"""

    try:
        result = await call_llm(prompt, temperature=0.3, max_tokens=3000)
    except ValueError as e:
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=episode["number"],
            status="failed",
            error=str(e)
        )

    # 解析 JSON 结果
    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=episode["number"],
            status="failed",
            error="LLM 未返回有效 JSON"
        )

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError:
        return ExtractProgress(
            episode_id=episode_id,
            episode_number=episode["number"],
            status="failed",
            error="JSON 解析失败"
        )

    # 保存梗概到 summary.txt
    if data.get("summary"):
        summary_file = script_file.parent / "summary.txt"
        summary_file.write_text(data["summary"], encoding="utf-8")

    def _sanitize(item: dict) -> dict:
        # LLM 有时把 variants 返回成字符串列表，过滤掉非 dict 的项
        if "variants" in item:
            item["variants"] = [v for v in item["variants"] if isinstance(v, dict)]
        return item

    # 转换为模型
    characters = [Character(**_sanitize(c)) for c in data.get("characters", []) if isinstance(c, dict)]
    scenes = [Scene(**_sanitize(s)) for s in data.get("scenes", []) if isinstance(s, dict)]
    props = [Prop(**_sanitize(p)) for p in data.get("props", []) if isinstance(p, dict)]

    return ExtractProgress(
        episode_id=episode_id,
        episode_number=episode["number"],
        status="completed",
        characters_count=len(characters),
        scenes_count=len(scenes),
        props_count=len(props),
        summary=data.get("summary"),
        characters=characters,
        scenes=scenes,
        props=props,
    )


def merge_assets(
    existing: AssetsCollection, new_chars: List[Character],
    new_scenes: List[Scene], new_props: List[Prop]
) -> AssetsCollection:
    """合并资产，按 name 模糊匹配去重"""

    def find_similar(name: str, existing_list: List) -> Optional[int]:
        """在现有列表中查找相似名称的索引"""
        name_lower = name.lower().strip()
        for i, item in enumerate(existing_list):
            existing_name = item.name.lower().strip()
            # 完全匹配或包含匹配
            if name_lower == existing_name or name_lower in existing_name or existing_name in name_lower:
                return i
        return None

    def merge_descriptions(existing_desc: Optional[str], new_desc: Optional[str]) -> Optional[str]:
        """合并描述，取更完整的版本"""
        if not existing_desc:
            return new_desc
        if not new_desc:
            return existing_desc
        # 取更长的描述
        return existing_desc if len(existing_desc) >= len(new_desc) else new_desc

    # 合并角色
    merged_chars = list(existing.characters)
    for new_char in new_chars:
        idx = find_similar(new_char.name, merged_chars)
        if idx is not None:
            # 合并字段
            existing_char = merged_chars[idx]
            merged_chars[idx] = Character(
                asset_id=existing_char.asset_id,
                name=existing_char.name,
                gender=new_char.gender or existing_char.gender,
                age=new_char.age or existing_char.age,
                appearance=merge_descriptions(existing_char.appearance, new_char.appearance),
                outfit=merge_descriptions(existing_char.outfit, new_char.outfit),
                base_asset=existing_char.base_asset,
                tags=list(set(existing_char.tags + new_char.tags)),
                variants=existing_char.variants + new_char.variants,
                images=existing_char.images,
            )
        else:
            merged_chars.append(new_char)

    # 合并场景
    merged_scenes = list(existing.scenes)
    for new_scene in new_scenes:
        idx = find_similar(new_scene.name, merged_scenes)
        if idx is not None:
            existing_scene = merged_scenes[idx]
            merged_scenes[idx] = Scene(
                asset_id=existing_scene.asset_id,
                name=existing_scene.name,
                description=merge_descriptions(existing_scene.description, new_scene.description),
                visual_elements=list(set(existing_scene.visual_elements + new_scene.visual_elements)),
                time_of_day=new_scene.time_of_day or existing_scene.time_of_day,
                lighting=new_scene.lighting or existing_scene.lighting,
                variants=existing_scene.variants + new_scene.variants,
                images=existing_scene.images,
            )
        else:
            merged_scenes.append(new_scene)

    # 合并道具
    merged_props = list(existing.props)
    for new_prop in new_props:
        idx = find_similar(new_prop.name, merged_props)
        if idx is not None:
            existing_prop = merged_props[idx]
            merged_props[idx] = Prop(
                asset_id=existing_prop.asset_id,
                name=existing_prop.name,
                description=merge_descriptions(existing_prop.description, new_prop.description),
                variants=existing_prop.variants + new_prop.variants,
                images=existing_prop.images,
            )
        else:
            merged_props.append(new_prop)

    return AssetsCollection(
        characters=merged_chars,
        scenes=merged_scenes,
        props=merged_props,
    )


async def add_asset(
    project_id: int, asset_type: str, asset_data: dict
) -> dict:
    """添加新资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        char = Character(**asset_data)
        assets.characters.append(char)
    elif asset_type == "scene":
        scene = Scene(**asset_data)
        assets.scenes.append(scene)
    elif asset_type == "prop":
        prop = Prop(**asset_data)
        assets.props.append(prop)

    await write_assets(project_id, assets)
    return asset_data


async def update_asset(
    project_id: int, asset_type: str, asset_id: str, updates: dict
) -> Optional[dict]:
    """更新资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        for i, char in enumerate(assets.characters):
            if char.asset_id == asset_id:
                updated = char.model_copy(update=updates)
                assets.characters[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()
    elif asset_type == "scene":
        for i, scene in enumerate(assets.scenes):
            if scene.asset_id == asset_id:
                updated = scene.model_copy(update=updates)
                assets.scenes[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()
    elif asset_type == "prop":
        for i, prop in enumerate(assets.props):
            if prop.asset_id == asset_id:
                updated = prop.model_copy(update=updates)
                assets.props[i] = updated
                await write_assets(project_id, assets)
                return updated.model_dump()

    return None


async def delete_asset(
    project_id: int, asset_type: str, asset_id: str
) -> bool:
    """删除资产"""
    assets = await read_assets(project_id)

    if asset_type == "character":
        assets.characters = [c for c in assets.characters if c.asset_id != asset_id]
    elif asset_type == "scene":
        assets.scenes = [s for s in assets.scenes if s.asset_id != asset_id]
    elif asset_type == "prop":
        assets.props = [p for p in assets.props if p.asset_id != asset_id]

    await write_assets(project_id, assets)
    return True


async def get_asset_images_dir(project_id: int, asset_type: str) -> Optional[Path]:
    """获取资产图片目录路径"""
    project_path = await get_project_path(project_id)
    if not project_path:
        return None
    return Path(project_path) / "assets" / asset_type


async def get_asset_images(
    project_id: int, asset_type: str, asset_id: str
) -> List[str]:
    """获取资产图片路径列表"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                return char.images
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                return scene.images
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                return prop.images

    return []


async def add_image_to_asset(
    project_id: int, asset_type: str, asset_id: str, image_path: str
) -> int:
    """添加图片到资产，返回图片索引（从 1 开始）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                char.images.append(image_path)
                await write_assets(project_id, assets)
                return len(char.images)
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                scene.images.append(image_path)
                await write_assets(project_id, assets)
                return len(scene.images)
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                prop.images.append(image_path)
                await write_assets(project_id, assets)
                return len(prop.images)

    raise ValueError(f"资产不存在: {asset_type}/{asset_id}")


async def remove_image_from_asset(
    project_id: int, asset_type: str, asset_id: str, image_index: int
) -> bool:
    """删除资产图片（索引从 1 开始）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    idx = image_index - 1  # 转换为 0 基索引

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                if 0 <= idx < len(char.images):
                    char.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                if 0 <= idx < len(scene.images):
                    scene.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                if 0 <= idx < len(prop.images):
                    prop.images.pop(idx)
                    await write_assets(project_id, assets)
                    return True
                return False

    return False


async def set_primary_image(
    project_id: int, asset_type: str, asset_id: str, image_index: int
) -> bool:
    """设置主图（将指定索引的图片移到第一位）"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    idx = image_index - 1  # 转换为 0 基索引

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                if 0 <= idx < len(char.images):
                    # 将指定图片移到第一位
                    primary = char.images.pop(idx)
                    char.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                if 0 <= idx < len(scene.images):
                    primary = scene.images.pop(idx)
                    scene.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                if 0 <= idx < len(prop.images):
                    primary = prop.images.pop(idx)
                    prop.images.insert(0, primary)
                    await write_assets(project_id, assets)
                    return True
                return False

    return False


async def get_asset_detail(
    project_id: int, asset_type: str, asset_id: str
) -> Optional[dict]:
    """获取单个资产详情"""
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"无效的资产类型: {asset_type}")

    assets = await read_assets(project_id)

    if asset_type == "character":
        for char in assets.characters:
            if char.asset_id == asset_id:
                return char.model_dump()
    elif asset_type == "scene":
        for scene in assets.scenes:
            if scene.asset_id == asset_id:
                return scene.model_dump()
    elif asset_type == "prop":
        for prop in assets.props:
            if prop.asset_id == asset_id:
                return prop.model_dump()

    return None