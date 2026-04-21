"""分集梗概生成服务
串行调用 LLM 为每集生成 100-200 字梗概
"""

import aiosqlite
from pathlib import Path
from typing import List, Optional, Dict

from services.llm_client import call_llm
from schemas.script_management_schema import EpisodeSplitResult

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def get_project_path(project_id: int) -> Optional[str]:
    """获取项目存储路径"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT path FROM projects WHERE id = ?", (project_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def get_or_create_episode(project_id: int, episode_number: int) -> int:
    """获取或创建集数记录，返回 episode_id"""
    async with aiosqlite.connect(DB_PATH) as db:
        # 检查是否存在
        cursor = await db.execute(
            "SELECT id FROM episodes WHERE project_id = ? AND number = ?",
            (project_id, episode_number)
        )
        row = await cursor.fetchone()
        if row:
            return row[0]

        # 创建新集数
        await db.execute(
            "INSERT INTO episodes (project_id, number) VALUES (?, ?)",
            (project_id, episode_number)
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT id FROM episodes WHERE project_id = ? AND number = ?",
            (project_id, episode_number)
        )
        row = await cursor.fetchone()
        return row[0]


async def generate_summary(episode_content: str, project_id: Optional[int] = None) -> str:
    """为单集剧本生成 100-200 字梗概"""
    system_prompt = """你是一个专业的剧本分析助手，擅长概括剧情梗概。

要求：
1. 概括主要剧情走向，保留关键事件和人物
2. 不要添加新内容，忠实于原文
3. 字数控制在 100-200 字
4. 使用简洁、客观的语言"""

    prompt = f"请为以下剧本内容生成梗概：\n\n{episode_content[:2000]}"

    summary = await call_llm(prompt, system_prompt, temperature=0.3, max_tokens=500, project_id=project_id)
    return summary.strip()


async def save_summary(
    project_path: str,
    episode_number: int,
    summary: str
) -> str:
    """保存梗概到文件

    存入 episodes/EP{xx}/summary.txt
    返回文件路径
    """
    ep_dir = Path(project_path) / "episodes" / f"EP{episode_number:02d}"
    ep_dir.mkdir(parents=True, exist_ok=True)

    summary_file = ep_dir / "summary.txt"
    summary_file.write_text(summary, encoding="utf-8")

    return str(summary_file)


async def save_script(
    project_path: str,
    episode_number: int,
    script_content: str
) -> str:
    """保存剧本到文件

    存入 episodes/EP{xx}/script.txt
    同时清理多余空行（超过2个连续空行压缩为2个）
    返回文件路径
    """
    import re

    ep_dir = Path(project_path) / "episodes" / f"EP{episode_number:02d}"
    ep_dir.mkdir(parents=True, exist_ok=True)

    # 清理多余空行：3个以上连续空行压缩为2个
    cleaned_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', script_content)

    script_file = ep_dir / "script.txt"
    script_file.write_text(cleaned_content, encoding="utf-8")

    return str(script_file)


async def generate_all_summaries(
    project_id: int,
    content: str,
    splits: List[EpisodeSplitResult]
) -> List[Dict]:
    """串行调用，为所有分集生成梗概

    返回每集梗概结果列表
    """
    project_path = await get_project_path(project_id)
    if not project_path:
        raise ValueError(f"项目 {project_id} 路径不存在")

    results = []

    for split in splits:
        # 提取该集内容
        episode_content = content[split.start_position:split.end_position]

        # 获取或创建 episode
        episode_id = await get_or_create_episode(project_id, split.episode_number)

        # 保存剧本
        await save_script(project_path, split.episode_number, episode_content)

        # 生成梗概
        summary = await generate_summary(episode_content, project_id=project_id)

        # 保存梗概
        await save_summary(project_path, split.episode_number, summary)

        results.append({
            "episode_id": episode_id,
            "episode_number": split.episode_number,
            "summary": summary,
            "status": "completed"
        })

    return results


async def regenerate_summary(episode_id: int) -> str:
    """重新生成单集梗概"""
    # 获取集数信息
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT project_id, number FROM episodes WHERE id = ?",
            (episode_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise ValueError(f"集数 {episode_id} 不存在")

        project_id, episode_number = row

    # 获取项目路径
    project_path = await get_project_path(project_id)
    if not project_path:
        raise ValueError(f"项目路径不存在")

    # 读取剧本内容
    script_file = Path(project_path) / "episodes" / f"EP{episode_number:02d}" / "script.txt"
    if not script_file.exists():
        raise ValueError(f"剧本文件不存在")

    script_content = script_file.read_text(encoding="utf-8")

    # 重新生成梗概
    summary = await generate_summary(script_content, project_id=project_id)

    # 保存梗概
    await save_summary(project_path, episode_number, summary)

    return summary