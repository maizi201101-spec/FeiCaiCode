/**
 * 全局设置页面
 * 配置 LLM API、即梦 CLI、全局提示词、视频参数
 */

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { type GlobalSettings } from '../api/prompts'
import { useGlobalSettings } from '../hooks/useGlobalSettings'
import LLMConfig from '../components/settings/LLMConfig'
import JimengConfig from '../components/settings/JimengConfig'
import GlobalPromptConfig from '../components/settings/GlobalPromptConfig'
import VideoParamsConfig from '../components/settings/VideoParamsConfig'

export default function SettingsPage() {
  const projectId = Number(useParams().projectId)
  const { settings, loading, error, save } = useGlobalSettings(projectId)
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null)
  const [saving, setSaving] = useState(false)

  // 从远程 settings 初始化本地状态
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  // 保存设置
  const handleSave = async () => {
    if (!localSettings) return
    setSaving(true)
    try {
      await save(localSettings)
      // 保存成功提示
    } catch (e) {
      console.error('保存失败:', e)
    } finally {
      setSaving(false)
    }
  }

  // 加载中
  if (loading && !settings) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  // 错误状态
  if (error && !settings) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Link
          to={`/project/${projectId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 返回工作台
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-900">
          项目 #{projectId} 设置
        </span>
      </header>

      {/* 主体区域 */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* LLM 配置 */}
        <LLMConfig settings={localSettings} onChange={setLocalSettings} />

        {/* 即梦 CLI 配置 */}
        <JimengConfig settings={localSettings} onChange={setLocalSettings} />

        {/* 全局提示词配置 */}
        <GlobalPromptConfig settings={localSettings} onChange={setLocalSettings} />

        {/* 视频参数配置 */}
        <VideoParamsConfig settings={localSettings} onChange={setLocalSettings} />

        {/* 保存按钮 */}
        <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {saving ? '保存中...' : '修改后点击保存'}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !localSettings}
            className={`px-4 py-2 rounded text-sm font-medium ${
              saving || !localSettings
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-sm text-red-500 text-center">{error}</div>
        )}
      </main>
    </div>
  )
}