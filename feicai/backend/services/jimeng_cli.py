"""
Dreamina CLI 调用服务
使用 subprocess 方式调用本地 dreamina CLI 工具生成图片
"""

import asyncio
import subprocess
import json
from pathlib import Path
from typing import Optional
import aiosqlite
import shutil

DB_PATH = Path(__file__).parent.parent / "feicai.db"

# Dreamina CLI 默认路径
DREAMINA_CLI_PATH = Path.home() / ".local" / "bin" / "dreamina"


class DreaminaCLIError(Exception):
    """Dreamina CLI 调用错误"""
    pass


async def get_dreamina_config() -> dict:
    """从 settings 表读取 Dreamina CLI 配置"""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key LIKE 'dreamina_%'"
        )
        rows = await cursor.fetchall()

    config = {
        "cli_path": str(DREAMINA_CLI_PATH) if DREAMINA_CLI_PATH.exists() else "dreamina",
        "default_params": {
            "model_version": "4.0",
            "ratio": "1:1",
            "resolution_type": "2k",
        },
    }

    for key, value in rows:
        if key == "dreamina_cli_path":
            config["cli_path"] = value
        elif key == "dreamina_default_params":
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
    output_dir: Path,
    timeout: int = 120,
) -> str:
    """
    调用 Dreamina CLI 生成图片

    Args:
        prompt: 图片生成提示词
        output_dir: 输出目录（图片下载目录）
        timeout: 超时时间（秒），用于 --poll 参数

    Returns:
        生成的图片路径

    Raises:
        DreaminaCLIError: CLI 调用失败
    """
    config = await get_dreamina_config()
    cli_path = config["cli_path"]

    # 确保输出目录存在
    output_dir.mkdir(parents=True, exist_ok=True)

    # 检查 CLI 是否存在
    if not Path(cli_path).exists():
        # 尝试在 PATH 中查找
        cli_in_path = shutil.which("dreamina")
        if cli_in_path:
            cli_path = cli_in_path
        else:
            raise DreaminaCLIError(f"Dreamina CLI 未安装或路径错误: {cli_path}")

    # 构造 CLI 命令：text2image + poll（等待结果）
    cmd = [
        cli_path,
        "text2image",
        f"--prompt={prompt}",
        f"--poll={timeout}",  # 在提交后轮询等待结果
    ]

    # 添加默认参数
    for key, value in config.get("default_params", {}).items():
        cmd.append(f"--{key}={value}")

    try:
        # 使用 asyncio 创建 subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout + 30
        )

        if process.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="ignore") if stderr else "未知错误"
            raise DreaminaCLIError(f"Dreamina CLI 调用失败 (code {process.returncode}): {error_msg}")

        # 解析 JSON 输出
        output = stdout.decode("utf-8", errors="ignore")
        result = json.loads(output)

        if result.get("gen_status") == "success":
            submit_id = result.get("submit_id")
            if submit_id:
                # 使用 query_result 下载图片到指定目录
                return await download_result_image(cli_path, submit_id, output_dir)
            raise DreaminaCLIError("缺少 submit_id")

        if result.get("gen_status") == "fail":
            fail_reason = result.get("fail_reason") or result.get("result_json", {}).get("fail_reason", "未知原因")
            raise DreaminaCLIError(f"生成失败: {fail_reason}")

        if result.get("gen_status") == "querying":
            submit_id = result.get("submit_id")
            if submit_id:
                return await download_result_image(cli_path, submit_id, output_dir, poll_timeout=timeout)
            raise DreaminaCLIError("缺少 submit_id，无法查询结果")

        raise DreaminaCLIError(f"未知状态: {result.get('gen_status')}")

    except json.JSONDecodeError as e:
        raise DreaminaCLIError(f"解析输出失败: {e}")
    except asyncio.TimeoutError:
        process.kill()
        raise DreaminaCLIError(f"Dreamina CLI 调用超时 ({timeout}秒)")
    except FileNotFoundError:
        raise DreaminaCLIError(f"Dreamina CLI 未安装或路径错误: {cli_path}")
    except Exception as e:
        raise DreaminaCLIError(f"Dreamina CLI 调用异常: {str(e)}")


async def download_result_image(cli_path: str, submit_id: str, output_dir: Path, poll_timeout: int = 60) -> str:
    """使用 query_result 下载图片"""
    cmd = [
        cli_path,
        "query_result",
        f"--submit_id={submit_id}",
        f"--download_dir={str(output_dir)}",
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await asyncio.wait_for(
        process.communicate(),
        timeout=poll_timeout + 10
    )

    if process.returncode != 0:
        error_msg = stderr.decode("utf-8", errors="ignore") if stderr else "未知错误"
        raise DreaminaCLIError(f"下载图片失败: {error_msg}")

    # 解析输出获取图片路径
    output = stdout.decode("utf-8", errors="ignore")
    result = json.loads(output)

    if result.get("gen_status") == "success":
        images = result.get("result_json", {}).get("images", [])
        if images and images[0].get("path"):
            return images[0]["path"]
        raise DreaminaCLIError("未找到图片路径")

    if result.get("gen_status") == "fail":
        fail_reason = result.get("fail_reason") or "未知原因"
        raise DreaminaCLIError(f"下载失败: {fail_reason}")

    # 在 download_dir 中查找图片文件
    for ext in ["png", "jpg", "jpeg", "webp"]:
        files = list(output_dir.glob(f"*.{ext}"))
        if files:
            return str(files[0])

    raise DreaminaCLIError("未找到下载的图片文件")


async def test_dreamina_cli() -> bool:
    """测试 Dreamina CLI 是否可用"""
    config = await get_dreamina_config()
    cli_path = config["cli_path"]

    try:
        process = await asyncio.create_subprocess_exec(
            cli_path,
            "version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode == 0
    except FileNotFoundError:
        return False


async def check_login_status() -> bool:
    """检查登录状态"""
    config = await get_dreamina_config()
    cli_path = config["cli_path"]

    try:
        process = await asyncio.create_subprocess_exec(
            cli_path,
            "user_credit",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode == 0
    except FileNotFoundError:
        return False