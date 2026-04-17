"""
即梦 CLI 调用服务
采用 subprocess 方式调用本地 CLI 工具生成图片
"""

import asyncio
import subprocess
import json
from pathlib import Path
from typing import Optional
import aiosqlite

DB_PATH = Path(__file__).parent.parent / "feicai.db"


class JimengCLIError(Exception):
    """即梦 CLI 调用错误"""
    pass


async def get_jimeng_config() -> dict:
    """从 settings 表读取即梦 CLI 配置"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key LIKE 'jimeng_%'"
        )
        rows = await cursor.fetchall()

    config = {
        "cli_path": "jimeng",  # 默认命令名（假设已安装到 PATH）
        "default_params": {},
    }

    for key, value in rows:
        if key == "jimeng_cli_path":
            config["cli_path"] = value
        elif key == "jimeng_default_params":
            try:
                config["default_params"] = json.loads(value)
            except json.JSONDecodeError:
                config["default_params"] = {}

    return config


def build_prompt_from_asset(asset_type: str, asset_data: dict) -> str:
    """从资产描述构造图片提示词"""
    if asset_type == "character":
        parts = [
            f"角色设定图：{asset_data.get('name', '未知角色')}",
            asset_data.get("appearance", ""),
            asset_data.get("outfit", ""),
            "全身构图，正面视角",
            "高质量角色设定图，保持风格一致性",
            "无背景，纯色背景",
        ]
    elif asset_type == "scene":
        parts = [
            f"场景设定图：{asset_data.get('name', '未知场景')}",
            asset_data.get("description", ""),
            " ".join(asset_data.get("visual_elements", [])),
            asset_data.get("time_of_day", ""),
            asset_data.get("lighting", ""),
            "高质量场景设定图，清晰构图",
        ]
    elif asset_type == "prop":
        parts = [
            f"道具设定图：{asset_data.get('name', '未知道具')}",
            asset_data.get("description", ""),
            "单独展示，清晰构图",
            "高质量道具设定图",
        ]
    else:
        parts = [f"设定图：{asset_data.get('name', '未知')}"]

    # 过滤空字符串，用分号连接
    prompt = "; ".join([p for p in parts if p])
    return prompt


async def generate_image(
    prompt: str,
    output_path: Path,
    timeout: int = 120,
) -> str:
    """
    调用即梦 CLI 生成图片

    Args:
        prompt: 图片生成提示词
        output_path: 输出文件路径（绝对路径）
        timeout: 超时时间（秒）

    Returns:
        生成的图片路径

    Raises:
        JimengCLIError: CLI 调用失败
    """
    config = await get_jimeng_config()
    cli_path = config["cli_path"]

    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 构造 CLI 命令
    # 假设即梦 CLI 的调用方式：jimeng generate --prompt "..." --output path.jpg
    cmd = [
        cli_path,
        "generate",
        "--prompt", prompt,
        "--output", str(output_path),
    ]

    # 添加额外参数
    for key, value in config.get("default_params", {}).items():
        cmd.extend([f"--{key}", str(value)])

    try:
        # 使用 asyncio 创建 subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout
        )

        if process.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="ignore") if stderr else "未知错误"
            raise JimengCLIError(f"即梦 CLI 调用失败 (code {process.returncode}): {error_msg}")

        # 验证文件是否生成
        if not output_path.exists():
            raise JimengCLIError(f"图片未生成，预期路径: {output_path}")

        return str(output_path)

    except asyncio.TimeoutError:
        process.kill()
        raise JimengCLIError(f"即梦 CLI 调用超时 ({timeout}秒)")
    except FileNotFoundError:
        raise JimengCLIError(f"即梦 CLI 未安装或路径错误: {cli_path}")
    except Exception as e:
        raise JimengCLIError(f"即梦 CLI 调用异常: {str(e)}")


async def test_jimeng_cli() -> bool:
    """测试即梦 CLI 是否可用"""
    config = await get_jimeng_config()
    cli_path = config["cli_path"]

    try:
        process = await asyncio.create_subprocess_exec(
            cli_path,
            "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode == 0
    except FileNotFoundError:
        return False