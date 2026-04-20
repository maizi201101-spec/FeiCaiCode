import aiosqlite
from pathlib import Path
from typing import Optional
import json
import re

from schemas.script import ScriptType, ScriptSplitResult, ScriptSplitResponse
from services.llm_client import call_llm

DB_PATH = Path(__file__).parent.parent / "feicai.db"


async def get_project_path(project_id: int) -> Optional[str]:
    """获取项目存储路径"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT path FROM projects WHERE id = ?", (project_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def get_episode_info(episode_id: int) -> Optional[dict]:
    """获取集数信息"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id, project_id, number FROM episodes WHERE id = ?", (episode_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return {"id": row[0], "project_id": row[1], "number": row[2]}


async def save_script(
    episode_id: int, content: str, script_type: ScriptType
) -> str:
    """保存剧本到文件，返回文件路径"""
    episode = await get_episode_info(episode_id)
    if not episode:
        raise ValueError(f"集数 {episode_id} 不存在")

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        raise ValueError(f"项目路径不存在")

    # 构建剧本文件路径
    ep_dir = Path(project_path) / "episodes" / f"EP{episode['number']:02d}"
    ep_dir.mkdir(parents=True, exist_ok=True)

    script_file = ep_dir / "script.txt"
    script_file.write_text(content, encoding="utf-8")

    # 保存剧本类型到元数据文件
    meta_file = ep_dir / "meta.json"
    meta = {"script_type": script_type.value}
    meta_file.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    return str(script_file)


async def read_script(episode_id: int) -> Optional[dict]:
    """读取剧本内容"""
    episode = await get_episode_info(episode_id)
    if not episode:
        return None

    project_path = await get_project_path(episode["project_id"])
    if not project_path:
        return None

    script_file = (
        Path(project_path) / "episodes" / f"EP{episode['number']:02d}" / "script.txt"
    )
    if not script_file.exists():
        return None

    content = script_file.read_text(encoding="utf-8")

    # 读取剧本类型
    meta_file = script_file.parent / "meta.json"
    script_type = ScriptType.traditional
    if meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        script_type = ScriptType(meta.get("script_type", "traditional"))

    return {
        "content": content,
        "script_type": script_type,
        "file_path": str(script_file),
    }


async def split_script_by_ai(
    content: str, episode_count: int
) -> ScriptSplitResponse:
    """调用 LLM 分析全集剧本并识别分割点"""

    system_prompt = """你是一个专业的剧本分析助手，负责将全集剧本按集数分割。

分割规则：
1. 通常每集约 800-1000 字
2. 优先按集数标题分割（如"第一集"、"第1集"、"EP1"等）
3. 若无明确标题，按剧情自然断点分割（场景切换、时间跳跃）
4. 确保每集内容完整，不截断对话或场景

输出格式（严格 JSON，不要添加任何额外文字）：
```json
[
  {"episode": 1, "content": "第一集完整剧本内容...", "marker": "第一集结束标记"},
  {"episode": 2, "content": "第二集完整剧本内容...", "marker": "第二集开始标记"}
]
```"""

    prompt = f"""全集剧本共约 {len(content)} 字符，预期约 {episode_count} 集。

剧本内容：
{content[:8000]}"""

    result = await call_llm(prompt, system_prompt, temperature=0.3, max_tokens=4000)

    # 解析 JSON 结果
    json_match = re.search(r"\[[\s\S]*\]", result)
    if not json_match:
        raise ValueError("LLM 未返回有效的分割结果")

    try:
        splits_data = json.loads(json_match.group())
    except json.JSONDecodeError:
        raise ValueError("分割结果 JSON 解析失败")

    splits = [
        ScriptSplitResult(
            episode_number=s["episode"],
            content=s["content"],
            start_marker=s.get("marker"),
        )
        for s in splits_data
    ]

    return ScriptSplitResponse(splits=splits, total_episodes=len(splits))