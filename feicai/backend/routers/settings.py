"""
全局设置 API
项目级全局提示词和默认生成参数
"""

from fastapi import APIRouter, HTTPException

from schemas.prompts_schema import GlobalSettings
from services.prompt_service import get_global_settings, update_global_settings, get_llm_only_settings, update_llm_only_settings
from services.script_service import get_project_path
from services.llm_client import get_llm_config, call_llm

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings"])

global_router = APIRouter(prefix="/api/settings", tags=["settings"])


@global_router.get("/global", response_model=GlobalSettings)
async def get_global_only_settings():
    """获取全局设置（不依赖项目，只读 LLM 全局配置）"""
    settings = await get_llm_only_settings()
    return settings


@global_router.put("/global", response_model=GlobalSettings)
async def update_global_only_settings(settings: GlobalSettings):
    """更新全局 LLM 设置（不依赖项目）"""
    await update_llm_only_settings(settings)
    return settings


@router.get("", response_model=GlobalSettings)
async def get_settings(project_id: int):
    """获取全局设置"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    settings = await get_global_settings(project_id)
    return settings


@router.put("", response_model=GlobalSettings)
async def update_settings(project_id: int, settings: GlobalSettings):
    """更新全局设置"""
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    await update_global_settings(project_id, settings)
    return settings


@router.post("/test-llm")
async def test_llm_connection(project_id: int):
    """测试 LLM API 连接

    发送一个简单的请求验证 API Key 是否有效
    """
    project_path = await get_project_path(project_id)
    if not project_path:
        raise HTTPException(404, "项目不存在")

    # 获取 LLM 配置
    config = await get_llm_config()
    if not config["api_key"]:
        raise HTTPException(400, "LLM API Key 未配置")

    try:
        # 发送一个简单的测试请求
        response = await call_llm(
            prompt="回复一个字：好",
            system_prompt="你是一个测试助手，只需回复一个字。",
            max_tokens=10
        )
        return {
            "success": True,
            "message": f"连接成功！模型 {config['model']} 响应正常",
            "model": config["model"],
            "base_url": config["base_url"],
            "response_preview": response[:50]
        }
    except Exception as e:
        raise HTTPException(500, f"连接失败: {str(e)}")