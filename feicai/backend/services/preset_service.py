"""
预设库管理服务
处理预设的 CRUD、激活状态、内置默认预设
"""

import json
from datetime import datetime
from typing import List, Optional
from pathlib import Path

import aiosqlite

from schemas.preset_schema import (
    Preset, PresetCreate, PresetUpdate, PresetCategory, ModelSpec,
    ActivePresets
)
from database import get_db, DB_PATH

# 预设存储路径（全局级，所有项目共享）
PRESETS_FILE = Path(__file__).parent.parent / "presets.json"
ACTIVE_PRESETS_FILE = Path(__file__).parent.parent / "active_presets.json"

# 内置默认预设
BUILTIN_PRESETS: List[Preset] = [
    # 分镜规划风格
    Preset(
        preset_id="builtin_storyboard_default",
        name="标准分镜风格",
        category=PresetCategory.STORYBOARD_STYLE,
        description="适用于大多数短剧的标准分镜规划风格，注重节奏和叙事流畅性",
        content="你是一位专业的短剧分镜规划师。请根据剧本内容，按照以下规则规划分镜：\n1. 每组时长控制在15秒以内\n2. 注重画面叙事的连贯性\n3. 合理运用景别变化（远景、全景、中景、近景、特写）\n4. 保持节奏流畅，避免过多静态镜头\n5. 重要情节给予更多镜头",
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
    Preset(
        preset_id="builtin_storyboard_suspense",
        name="悬疑惊悚节奏",
        category=PresetCategory.STORYBOARD_STYLE,
        description="悬疑惊悚题材专用，强调紧张节奏和氛围营造",
        content="你是一位擅长悬疑惊悚题材的分镜规划师。请根据剧本内容，按照以下规则规划分镜：\n1. 多用特写和近景，强调人物表情细节\n2. 合理运用空镜头营造氛围\n3. 关键情节前可适当延长镜头制造悬念\n4. 避免过多全景，保持观众的代入感\n5. 每组时长控制在15秒以内",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),

    # 视频提示词风格
    Preset(
        preset_id="builtin_video_realistic",
        name="写实电影质感",
        category=PresetCategory.VIDEO_PROMPT_STYLE,
        description="写实风格，强调真实感和电影质感",
        content="真实电影质感,自然光线,生活化场景,演员表演自然流畅,无过度特效,画面干净,8K分辨率",
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
    Preset(
        preset_id="builtin_video_anime",
        name="动漫赛璐璐风",
        category=PresetCategory.VIDEO_PROMPT_STYLE,
        description="动漫风格，赛璐璐着色，明亮色彩",
        content="动漫赛璐璐风格,明亮色彩,清晰线条,夸张表情,动态运镜,二次元氛围,高质量动画",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),
    Preset(
        preset_id="builtin_video_retro",
        name="复古胶片风",
        category=PresetCategory.VIDEO_PROMPT_STYLE,
        description="复古胶片质感，怀旧氛围",
        content="复古胶片质感,温暖色调,颗粒感,怀旧氛围,柔和光线,经典电影风格,年代感",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),

    # 特殊效果预设
    Preset(
        preset_id="builtin_effect_manga",
        name="漫画效果",
        category=PresetCategory.SPECIAL_EFFECT,
        description="漫画化视觉效果，黑白线条强调",
        content="漫画效果,黑白线条,夸张阴影,动态线条,二次元冲击感",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),
    Preset(
        preset_id="builtin_effect_memory",
        name="回忆效果",
        category=PresetCategory.SPECIAL_EFFECT,
        description="回忆闪回效果，朦胧怀旧感",
        content="回忆闪回效果,朦胧边缘,怀旧色调,柔光处理,梦境氛围",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),
    Preset(
        preset_id="builtin_effect_dream",
        name="梦境效果",
        category=PresetCategory.SPECIAL_EFFECT,
        description="梦幻效果，超现实氛围",
        content="梦境效果,超现实氛围,飘渺光线,模糊边界,幻想色彩",
        is_builtin=True,
        is_active=False,
        created_at=datetime.now().isoformat()
    ),

    # 视频模型规格
    Preset(
        preset_id="builtin_spec_jimeng_15s",
        name="即梦 CLI 15秒规格",
        category=PresetCategory.VIDEO_MODEL_SPEC,
        description="即梦 CLI 默认规格，组时长上限15秒",
        content="即梦 CLI 默认配置",
        model_spec=ModelSpec(
            max_group_duration=15,
            max_ref_images=4,
            default_params={"model": "seedance2.0", "duration": 4, "resolution": "1080p"}
        ),
        is_builtin=True,
        is_active=True,
        created_at=datetime.now().isoformat()
    ),
]


async def load_presets() -> List[Preset]:
    """加载所有预设（内置 + 用户自定义）"""
    presets = list(BUILTIN_PRESETS)

    if PRESETS_FILE.exists():
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            user_presets = json.load(f)
            for p in user_presets:
                presets.append(Preset(**p))

    return presets


async def save_presets(presets: List[Preset]) -> None:
    """保存用户自定义预设"""
    user_presets = [p for p in presets if not p.is_builtin]
    with open(PRESETS_FILE, "w", encoding="utf-8") as f:
        json.dump([p.model_dump() for p in user_presets], f, ensure_ascii=False, indent=2)


async def get_presets_by_category(category: Optional[PresetCategory] = None) -> List[Preset]:
    """按分类获取预设"""
    presets = await load_presets()
    if category:
        return [p for p in presets if p.category == category]
    return presets


async def create_preset(create: PresetCreate) -> Preset:
    """创建新预设"""
    presets = await load_presets()

    # 生成 preset_id
    preset_id = f"preset_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    new_preset = Preset(
        preset_id=preset_id,
        name=create.name,
        category=create.category,
        description=create.description,
        content=create.content,
        model_spec=create.model_spec,
        is_builtin=False,
        is_active=False,
        created_at=datetime.now().isoformat()
    )

    presets.append(new_preset)
    await save_presets(presets)

    return new_preset


async def update_preset(preset_id: str, update: PresetUpdate) -> Optional[Preset]:
    """更新预设"""
    presets = await load_presets()

    for i, p in enumerate(presets):
        if p.preset_id == preset_id:
            if p.is_builtin:
                # 内置预设只能修改 is_active
                if update.is_active is not None:
                    p.is_active = update.is_active
                    p.updated_at = datetime.now().isoformat()
            else:
                # 用户预设可修改所有字段
                if update.name is not None:
                    p.name = update.name
                if update.description is not None:
                    p.description = update.description
                if update.content is not None:
                    p.content = update.content
                if update.model_spec is not None:
                    p.model_spec = update.model_spec
                if update.is_active is not None:
                    p.is_active = update.is_active
                p.updated_at = datetime.now().isoformat()

            await save_presets(presets)
            return p

    return None


async def delete_preset(preset_id: str) -> bool:
    """删除预设（仅限用户自定义）"""
    presets = await load_presets()

    for i, p in enumerate(presets):
        if p.preset_id == preset_id and not p.is_builtin:
            presets.pop(i)
            await save_presets(presets)
            return True

    return False


async def activate_preset(project_id: int, preset_id: str, category: PresetCategory) -> bool:
    """激活预设（项目级）"""
    presets = await load_presets()

    # 找到目标预设
    target_preset = None
    for p in presets:
        if p.preset_id == preset_id and p.category == category:
            target_preset = p
            break

    if not target_preset:
        return False

    # 更新激活状态：同类别只能激活一个（特殊效果除外）
    if category == PresetCategory.SPECIAL_EFFECT:
        # 特殊效果可多选
        for p in presets:
            if p.preset_id == preset_id:
                p.is_active = True
    else:
        # 其他类别只能激活一个
        for p in presets:
            if p.category == category:
                p.is_active = (p.preset_id == preset_id)

    await save_presets(presets)

    # 记录项目激活的预设
    active = await get_active_presets(project_id)
    if category == PresetCategory.STORYBOARD_STYLE:
        active.storyboard_style = preset_id
    elif category == PresetCategory.VIDEO_PROMPT_STYLE:
        active.video_prompt_style = preset_id
    elif category == PresetCategory.SPECIAL_EFFECT:
        if preset_id not in active.special_effects:
            active.special_effects.append(preset_id)
    elif category == PresetCategory.VIDEO_MODEL_SPEC:
        active.video_model_spec = preset_id

    await save_active_presets(project_id, active)

    return True


async def deactivate_preset(project_id: int, preset_id: str) -> bool:
    """取消激活预设"""
    presets = await load_presets()

    for p in presets:
        if p.preset_id == preset_id:
            p.is_active = False
            break

    await save_presets(presets)

    # 从项目激活列表移除
    active = await get_active_presets(project_id)
    for cat in [PresetCategory.STORYBOARD_STYLE, PresetCategory.VIDEO_PROMPT_STYLE, PresetCategory.VIDEO_MODEL_SPEC]:
        if getattr(active, cat.value.replace("_spec", "").replace("storyboard_", "storyboard_").replace("video_prompt_", "video_prompt_").replace("video_model_", "video_model_")) == preset_id:
            setattr(active, cat.value.replace("_spec", ""), None)
    if preset_id in active.special_effects:
        active.special_effects.remove(preset_id)

    await save_active_presets(project_id, active)

    return True


async def get_active_presets(project_id: int) -> ActivePresets:
    """获取项目激活的预设"""
    active_file = Path(__file__).parent.parent / f"active_presets_{project_id}.json"

    if active_file.exists():
        with open(active_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return ActivePresets(**data)

    # 默认激活内置预设
    return ActivePresets(
        storyboard_style="builtin_storyboard_default",
        video_prompt_style="builtin_video_realistic",
        special_effects=[],
        video_model_spec="builtin_spec_jimeng_15s"
    )


async def save_active_presets(project_id: int, active: ActivePresets) -> None:
    """保存项目激活的预设"""
    active_file = Path(__file__).parent.parent / f"active_presets_{project_id}.json"
    with open(active_file, "w", encoding="utf-8") as f:
        json.dump(active.model_dump(), f, ensure_ascii=False, indent=2)


async def get_active_preset_content(project_id: int, category: PresetCategory) -> str:
    """获取项目激活的预设内容"""
    active = await get_active_presets(project_id)
    presets = await load_presets()

    preset_id = None
    if category == PresetCategory.STORYBOARD_STYLE:
        preset_id = active.storyboard_style
    elif category == PresetCategory.VIDEO_PROMPT_STYLE:
        preset_id = active.video_prompt_style
    elif category == PresetCategory.VIDEO_MODEL_SPEC:
        preset_id = active.video_model_spec

    if preset_id:
        for p in presets:
            if p.preset_id == preset_id:
                return p.content

    return ""


async def get_active_special_effects(project_id: int) -> List[str]:
    """获取项目激活的特殊效果预设内容"""
    active = await get_active_presets(project_id)
    presets = await load_presets()

    contents = []
    for preset_id in active.special_effects:
        for p in presets:
            if p.preset_id == preset_id and p.category == PresetCategory.SPECIAL_EFFECT:
                contents.append(p.content)

    return contents