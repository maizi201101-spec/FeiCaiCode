"""
提示词生成服务
prompts.json 读写、AI 提示词生成、CRUD、全局设置
"""

import json
import aiosqlite
from pathlib import Path
from typing import Optional
from datetime import datetime
import re

from schemas.prompts_schema import (
    Prompt, PromptsCollection, PromptUpdate, GlobalSettings, SpecialPrompt
)
from schemas.shots_schema import Shot, ShotsCollection
from schemas.assets_schema import Character, Scene, Prop, AssetsCollection
from services.llm_client import call_llm
from services.script_service import get_episode_info, get_project_path
from services.shot_service import read_shots
from services.asset_service import read_assets

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def get_prompts_path(episode_id: int) -> Path:
    """获取 episodes/EP{num}/prompts.json 路径"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError("项目路径不存在")

    ep_dir = Path(project_path) / "episodes" / f"EP{episode['number']:02d}"
    ep_dir.mkdir(parents=True, exist_ok=True)
    return ep_dir / "prompts.json"


async def read_prompts(episode_id: int) -> PromptsCollection:
    """读取 prompts.json"""
    prompts_path = await get_prompts_path(episode_id)
    if not prompts_path.exists():
        return PromptsCollection(episode_id=episode_id)

    content = prompts_path.read_text(encoding="utf-8")
    data = json.loads(content)

    prompts = [
        Prompt(
            shot_id=p["shot_id"],
            group_id=p["group_id"],
            image_prompt=p["image_prompt"],
            video_prompt=p["video_prompt"],
            edited=p.get("edited", False),
            confirmed=p.get("confirmed", False),
        )
        for p in data.get("prompts", [])
    ]

    return PromptsCollection(
        episode_id=episode_id,
        prompts=prompts,
        generated_at=data.get("generated_at"),
    )


async def write_prompts(episode_id: int, prompts: PromptsCollection) -> None:
    """写入 prompts.json"""
    prompts_path = await get_prompts_path(episode_id)
    prompts_path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(prompts.model_dump(), ensure_ascii=False, indent=2)
    prompts_path.write_text(content, encoding="utf-8")


async def generate_prompts_by_ai(episode_id: int) -> PromptsCollection:
    """调用 LLM 基于 assets.json + shots.json 生成提示词"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    # 读取分镜和资产
    shots = await read_shots(episode_id)
    assets = await read_assets(episode["project_id"])

    if not shots.shots:
        raise ValueError("无分镜数据，无法生成提示词")

    # 构建资产摘要
    assets_info = []
    for char in assets.characters:
        assets_info.append({
            "type": "人物",
            "asset_id": char.asset_id,
            "name": char.name,
            "appearance": char.appearance,
            "outfit": char.outfit,
        })
    for scene in assets.scenes:
        assets_info.append({
            "type": "场景",
            "asset_id": scene.asset_id,
            "name": scene.name,
            "description": scene.description,
            "visual_elements": scene.visual_elements,
            "lighting": scene.lighting,
        })
    for prop in assets.props:
        assets_info.append({
            "type": "道具",
            "asset_id": prop.asset_id,
            "name": prop.name,
            "description": prop.description,
        })

    # 构建分镜摘要
    shots_info = []
    for shot in shots.shots:
        speech_lines = []
        for sp in shot.speech:
            if sp.type == "dialogue":
                speech_lines.append(f"{sp.speaker}: \"{sp.text}\"")
            else:
                speech_lines.append(f"OS: \"{sp.text}\"")

        shots_info.append({
            "shot_id": shot.shot_id,
            "group_id": shot.group_id,
            "shot_type": shot.shot_type.value,
            "shot_size": shot.shot_size.value,
            "camera_move": shot.camera_move.value,
            "assets": shot.assets,
            "asset_refs": {
                "characters": [{"name": c.name, "costume": c.costume} for c in shot.asset_refs.characters],
                "scenes": shot.asset_refs.scenes,
                "props": shot.asset_refs.props,
                "shot_annotations": shot.asset_refs.shot_annotations,
            } if shot.asset_refs else None,
            "frame_action": shot.frame_action,
            "lighting": shot.lighting,
            "speech": speech_lines,
            "time_of_day": shot.time_of_day,
        })

    # LLM Prompt
    prompt = """你是一个专业的影视提示词生成专家。请根据以下分镜和资产信息，为每个镜头生成图片提示词和视频提示词。

## 资产清单
""" + json.dumps(assets_info, ensure_ascii=False, indent=2) + """

## 分镜结构
""" + json.dumps(shots_info, ensure_ascii=False, indent=2) + """

## 提示词格式要求

**图片提示词格式**（自然短句，分号分隔）：
```
@资产引用行（人物→场景→道具顺序，如 @人物1是张三，@场景1是办公室）；
景别与构图；
人物状态与动作瞬间；
光影氛围；
风格标签；
负面提示（可选）
```

**视频提示词格式**（结构化字段）：
```
【景别】...
【运镜】...
【画面描述】（空间锚点、前中后景、背景元素）
【角色分动】（人物动作链、反应链）
【画面细节】
【光影影调】
【台词】角色名: "原文台词。"（多角色分行）
```

## 重要约束
1. 台词必须逐字锁定原文，不可改写
2. 资产引用顺序固定：人物→场景→道具
3. 镜头无台词时，省略【台词】字段
4. 图片提示词用分号分隔，不加【】
5. 视频提示词必须用【】字段格式

## 输出格式
```json
{
  "prompts": [
    {
      "shot_id": "01",
      "group_id": "G01",
      "image_prompt": "@人物1是林小满，@场景1是咖啡馆；中近景，人物偏左构图...",
      "video_prompt": "【景别】中近景\n【运镜】缓慢推进\n..."
    }
  ]
}
```

请严格按照 JSON 格式输出，不要添加任何额外文字。"""

    result = await call_llm(prompt, temperature=0.3, max_tokens=8000)

    # 解析 JSON
    json_match = re.search(r"\{[\s\S]*\}", result)
    if not json_match:
        raise ValueError("LLM 未返回有效的 JSON 结果")

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析失败: {e}")

    # 构建 PromptsCollection
    prompts = []
    for p in data.get("prompts", []):
        # 从 shots 中获取 group_id（如果 LLM 未返回）
        group_id = p.get("group_id", "")
        if not group_id:
            shot = next((s for s in shots.shots if s.shot_id == p["shot_id"]), None)
            group_id = shot.group_id if shot else ""

        prompt_obj = Prompt(
            shot_id=p["shot_id"],
            group_id=group_id,
            image_prompt=p.get("image_prompt", ""),
            video_prompt=p.get("video_prompt", ""),
            edited=False,
            confirmed=False,
        )
        prompts.append(prompt_obj)

    collection = PromptsCollection(
        episode_id=episode_id,
        prompts=prompts,
        generated_at=datetime.now().isoformat(),
    )

    await write_prompts(episode_id, collection)
    return collection


async def update_prompt_field(episode_id: int, shot_id: str, updates: PromptUpdate) -> Optional[Prompt]:
    """更新单个镜头提示词"""
    collection = await read_prompts(episode_id)

    prompt_index = None
    for i, p in enumerate(collection.prompts):
        if p.shot_id == shot_id:
            prompt_index = i
            break

    if prompt_index is None:
        return None

    current = collection.prompts[prompt_index]
    update_data = updates.model_dump(exclude_none=True)

    updated = Prompt(
        shot_id=current.shot_id,
        group_id=current.group_id,
        image_prompt=update_data.get("image_prompt", current.image_prompt),
        video_prompt=update_data.get("video_prompt", current.video_prompt),
        edited=current.edited or bool(update_data.get("image_prompt") or update_data.get("video_prompt")),
        confirmed=update_data.get("confirmed", current.confirmed),
    )

    collection.prompts[prompt_index] = updated
    await write_prompts(episode_id, collection)

    return updated


async def confirm_prompt(episode_id: int, shot_id: str) -> Optional[Prompt]:
    """确认提示词"""
    return await update_prompt_field(episode_id, shot_id, PromptUpdate(confirmed=True))


def build_final_video_prompt(
    video_prompt: str,
    special_prompts: list[SpecialPrompt],
    global_prompt: str
) -> str:
    """拼接：[正文] + [特殊] + [全局]"""
    parts = [video_prompt]

    # 添加特殊提示词
    for sp in special_prompts:
        parts.append(f"\n[特殊效果] {sp.content}")

    # 添加全局提示词
    if global_prompt:
        parts.append(f"\n[全局设定] {global_prompt}")

    return "\n".join(parts)


async def get_global_settings(project_id: int) -> GlobalSettings:
    """从 settings 表读取全局设置

    优先读取项目级设置，LLM 配置如果项目级不存在则从全局读取
    """
    settings = GlobalSettings()

    # 1. 先读取项目级设置
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key LIKE ?",
            [f"project_{project_id}_%"]
        )
        rows = await cursor.fetchall()

    prefix = f"project_{project_id}_"
    for key, value in rows:
        if key.startswith(prefix):
            setting_name = key[len(prefix):]
            if setting_name == "global_prompt":
                settings.global_prompt = value
            elif setting_name == "default_model":
                settings.default_model = value
            elif setting_name == "default_duration":
                settings.default_duration = int(value)
            elif setting_name == "default_resolution":
                settings.default_resolution = value
            elif setting_name == "default_ratio":
                settings.default_ratio = value
            elif setting_name == "llm_api_key":
                settings.llm_api_key = value
            elif setting_name == "llm_base_url":
                settings.llm_base_url = value
            elif setting_name == "llm_model":
                settings.llm_model = value
            elif setting_name == "jimeng_cli_path":
                settings.jimeng_cli_path = value
            elif setting_name == "default_image_model":
                settings.default_image_model = value
            elif setting_name == "default_image_size":
                settings.default_image_size = value

    # 2. 如果项目级 LLM 配置不存在，从全局读取
    if not settings.llm_api_key or not settings.llm_base_url or not settings.llm_model:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute(
                "SELECT key, value FROM settings WHERE key IN ('llm_api_key', 'llm_base_url', 'llm_model')"
            )
            global_rows = await cursor.fetchall()

        for key, value in global_rows:
            if key == "llm_api_key" and not settings.llm_api_key:
                settings.llm_api_key = value
            elif key == "llm_base_url" and not settings.llm_base_url:
                settings.llm_base_url = value
            elif key == "llm_model" and not settings.llm_model:
                settings.llm_model = value

    return settings


async def update_global_settings(project_id: int, settings: GlobalSettings) -> None:
    """更新全局设置

    项目级设置：使用 project_{id}_ 前缀
    全局级设置（LLM 配置）：不带前缀，所有项目共享
    """
    now = datetime.now().isoformat()

    # LLM 配置使用全局 key（不带项目前缀）
    # 因为 LLM API Key 应该是全局的，一次配置所有项目都能用
    global_settings = [
        ("llm_api_key", settings.llm_api_key),
        ("llm_base_url", settings.llm_base_url),
        ("llm_model", settings.llm_model),
    ]

    # 项目级设置（使用项目前缀）
    project_settings = [
        ("global_prompt", settings.global_prompt),
        ("default_model", settings.default_model),
        ("default_duration", str(settings.default_duration)),
        ("default_resolution", settings.default_resolution),
        ("default_ratio", settings.default_ratio),
        ("jimeng_cli_path", settings.jimeng_cli_path),
        ("default_image_model", settings.default_image_model),
        ("default_image_size", settings.default_image_size),
    ]

    async with aiosqlite.connect(DB_PATH) as db:
        # 先保存全局 LLM 配置（不带项目前缀）
        for setting_name, value in global_settings:
            key = setting_name  # 直接使用 setting_name 作为 key
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
                """,
                [key, value, now, value, now]
            )

        # 再保存项目级设置（带项目前缀）
        for setting_name, value in project_settings:
            key = f"project_{project_id}_{setting_name}"
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
                """,
                [key, value, now, value, now]
            )

        # 同时也保存 LLM 配置的项目级副本（用于前端显示）
        for setting_name, value in global_settings:
            key = f"project_{project_id}_{setting_name}"
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
                """,
                [key, value, now, value, now]
            )

        await db.commit()

async def get_llm_only_settings() -> GlobalSettings:
    """读取全局 LLM 配置（不依赖项目ID）"""
    settings = GlobalSettings()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN ('llm_api_key', 'llm_base_url', 'llm_model')"
        )
        rows = await cursor.fetchall()
    for key, value in rows:
        if key == "llm_api_key":
            settings.llm_api_key = value
        elif key == "llm_base_url":
            settings.llm_base_url = value
        elif key == "llm_model":
            settings.llm_model = value
    return settings


async def update_llm_only_settings(settings: GlobalSettings) -> None:
    """更新全局 LLM 配置（不依赖项目ID）"""
    from datetime import datetime
    now = datetime.now().isoformat()
    pairs = [
        ("llm_api_key", settings.llm_api_key),
        ("llm_base_url", settings.llm_base_url),
        ("llm_model", settings.llm_model),
    ]
    async with aiosqlite.connect(DB_PATH) as db:
        for key, value in pairs:
            await db.execute(
                """
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
                """,
                [key, value, now, value, now]
            )
        await db.commit()
