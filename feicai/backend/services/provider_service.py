"""
提供商配置管理服务
处理提供商的 CRUD、项目默认提供商设置
"""

import json
from datetime import datetime
from typing import List, Optional
from pathlib import Path

import aiosqlite

from schemas.provider_schema import (
    Provider, ProviderCreate, ProviderUpdate, ProviderType,
    ProviderImplType, LLMUsageTag, ProjectProviders
)
from database import DB_PATH

# 提供商存储路径（全局级）
PROVIDERS_FILE = Path(__file__).parent.parent / "providers.json"

# 内置默认提供商
BUILTIN_PROVIDERS: List[Provider] = [
    Provider(
        provider_id="builtin_llm_openai",
        name="OpenAI 兼容接口",
        provider_type=ProviderType.LLM,
        impl_type=ProviderImplType.HTTP_API,
        api_key="",
        base_url="https://api.openai.com/v1",
        model_name="gpt-4",
        usage_tags=[LLMUsageTag.ASSET_EXTRACT, LLMUsageTag.STORYBOARD_PLAN, LLMUsageTag.PROMPT_GENERATE],
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
    Provider(
        provider_id="builtin_image_jimeng",
        name="即梦 CLI 图片生成",
        provider_type=ProviderType.IMAGE,
        impl_type=ProviderImplType.JIMENG_CLI,
        cli_path="",
        default_image_params={},  # 即梦 CLI 使用默认参数
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
    Provider(
        provider_id="builtin_video_jimeng",
        name="即梦 CLI 视频生成",
        provider_type=ProviderType.VIDEO,
        impl_type=ProviderImplType.JIMENG_CLI,
        cli_path="",
        video_spec_preset_id="builtin_spec_jimeng_15s",
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
]


async def load_providers() -> List[Provider]:
    """加载所有提供商（内置 + 用户自定义）"""
    providers = list(BUILTIN_PROVIDERS)

    if PROVIDERS_FILE.exists():
        with open(PROVIDERS_FILE, "r", encoding="utf-8") as f:
            user_providers = json.load(f)
            for p in user_providers:
                providers.append(Provider(**p))

    return providers


async def save_providers(providers: List[Provider]) -> None:
    """保存用户自定义提供商"""
    user_providers = [p for p in providers if not p.is_builtin]
    with open(PROVIDERS_FILE, "w", encoding="utf-8") as f:
        json.dump([p.model_dump() for p in user_providers], f, ensure_ascii=False, indent=2)


async def get_providers_by_type(provider_type: Optional[ProviderType] = None) -> List[Provider]:
    """按类型获取提供商"""
    providers = await load_providers()
    if provider_type:
        return [p for p in providers if p.provider_type == provider_type]
    return providers


async def create_provider(create: ProviderCreate) -> Provider:
    """创建新提供商"""
    providers = await load_providers()

    provider_id = f"provider_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    new_provider = Provider(
        provider_id=provider_id,
        name=create.name,
        provider_type=create.provider_type,
        impl_type=create.impl_type,
        api_key=create.api_key,
        base_url=create.base_url,
        model_name=create.model_name,
        cli_path=create.cli_path,
        usage_tags=create.usage_tags,
        default_image_params=create.default_image_params,
        video_spec_preset_id=create.video_spec_preset_id,
        is_builtin=False,
        is_active=False,
        created_at=datetime.now().isoformat()
    )

    providers.append(new_provider)
    await save_providers(providers)

    return new_provider


async def update_provider(provider_id: str, update: ProviderUpdate) -> Optional[Provider]:
    """更新提供商"""
    providers = await load_providers()

    for i, p in enumerate(providers):
        if p.provider_id == provider_id:
            if p.is_builtin:
                # 内置提供商只能修改 api_key/base_url/cli_path 和 is_active
                if update.api_key is not None:
                    p.api_key = update.api_key
                if update.base_url is not None:
                    p.base_url = update.base_url
                if update.cli_path is not None:
                    p.cli_path = update.cli_path
                if update.is_active is not None:
                    p.is_active = update.is_active
            else:
                # 用户提供商可修改所有字段
                if update.name is not None:
                    p.name = update.name
                if update.api_key is not None:
                    p.api_key = update.api_key
                if update.base_url is not None:
                    p.base_url = update.base_url
                if update.model_name is not None:
                    p.model_name = update.model_name
                if update.cli_path is not None:
                    p.cli_path = update.cli_path
                if update.usage_tags is not None:
                    p.usage_tags = update.usage_tags
                if update.default_image_params is not None:
                    p.default_image_params = update.default_image_params
                if update.video_spec_preset_id is not None:
                    p.video_spec_preset_id = update.video_spec_preset_id
                if update.is_active is not None:
                    p.is_active = update.is_active

            p.updated_at = datetime.now().isoformat()
            await save_providers(providers)
            return p

    return None


async def delete_provider(provider_id: str) -> bool:
    """删除提供商（仅限用户自定义）"""
    providers = await load_providers()

    for i, p in enumerate(providers):
        if p.provider_id == provider_id and not p.is_builtin:
            providers.pop(i)
            await save_providers(providers)
            return True

    return False


async def set_project_default_provider(
    project_id: int,
    provider_type: ProviderType,
    provider_id: str
) -> bool:
    """设置项目默认提供商"""
    providers = await load_providers()

    # 验证提供商存在且类型匹配
    target = None
    for p in providers:
        if p.provider_id == provider_id and p.provider_type == provider_type:
            target = p
            break

    if not target:
        return False

    # 更新数据库
    key = f"project_{project_id}_default_{provider_type.value}_provider"
    now = datetime.now().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
            """,
            [key, provider_id, now, provider_id, now]
        )
        await db.commit()

    return True


async def get_project_providers(project_id: int) -> ProjectProviders:
    """获取项目默认提供商"""
    result = ProjectProviders()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key LIKE ?",
            [f"project_{project_id}_default_%_provider"]
        )
        rows = await cursor.fetchall()

        for row in rows:
            key = row["key"]
            value = row["value"]
            if "_llm_provider" in key:
                result.llm_provider_id = value
            elif "_image_provider" in key:
                result.image_provider_id = value
            elif "_video_provider" in key:
                result.video_provider_id = value

    # 如果未设置，使用内置默认
    if not result.llm_provider_id:
        result.llm_provider_id = "builtin_llm_openai"
    if not result.image_provider_id:
        result.image_provider_id = "builtin_image_jimeng"
    if not result.video_provider_id:
        result.video_provider_id = "builtin_video_jimeng"

    return result


async def get_active_llm_provider(project_id: int) -> Optional[Provider]:
    """获取项目激活的 LLM 提供商"""
    project_providers = await get_project_providers(project_id)
    providers = await load_providers()

    for p in providers:
        if p.provider_id == project_providers.llm_provider_id:
            return p

    return None


async def get_active_video_provider(project_id: int) -> Optional[Provider]:
    """获取项目激活的视频提供商"""
    project_providers = await get_project_providers(project_id)
    providers = await load_providers()

    for p in providers:
        if p.provider_id == project_providers.video_provider_id:
            return p

    return None