import httpx
import json
import aiosqlite
import asyncio
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "feicai.db"

# 全局 LLM 并发限制（最多同时 3 个请求）
_llm_semaphore = asyncio.Semaphore(3)

DEFAULT_LLM_CONFIG = {
    "api_key": "",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
}


async def get_llm_config() -> dict:
    """从 settings 表读取 LLM 配置"""
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await db.execute_fetchall(
            "SELECT key, value FROM settings WHERE key IN ('llm_api_key', 'llm_base_url', 'llm_model')"
        )
    config = DEFAULT_LLM_CONFIG.copy()
    for key, value in rows:
        if key == "llm_api_key":
            config["api_key"] = value
        elif key == "llm_base_url":
            config["base_url"] = value
        elif key == "llm_model":
            config["model"] = value
    return config


async def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """调用 LLM API，返回生成文本（全局并发限制：最多同时 3 个请求）"""
    config = await get_llm_config()
    if not config["api_key"]:
        raise ValueError("LLM API Key 未配置，请在设置中添加")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    async with _llm_semaphore:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{config['base_url']}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config["model"],
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            if resp.status_code != 200:
                raise ValueError(f"LLM API 调用失败: {resp.status_code} - {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]