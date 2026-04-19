/**
 * 设置页面 - 左右分栏布局
 * 左侧：分类导航
 * 右侧：对应分类的配置内容
 */

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { type GlobalSettings } from '../api/prompts'
import { useGlobalSettings } from '../hooks/useGlobalSettings'
import LLMConfig from '../components/settings/LLMConfig'
import JimengConfig from '../components/settings/JimengConfig'
import GlobalPromptConfig from '../components/settings/GlobalPromptConfig'
import VideoParamsConfig from '../components/settings/VideoParamsConfig'
import PresetsConfig from '../components/settings/PresetsConfig'
import ProvidersConfig from '../components/settings/ProvidersConfig'
import SystemConfig from '../components/settings/SystemConfig'

// 设置分类
const SETTING_CATEGORIES = [
  { key: 'system', label: '系统', icon: '📁' },
  { key: 'llm', label: 'LLM 配置', icon: '🤖' },
  { key: 'image', label: '图片模型', icon: '🖼' },
  { key: 'video', label: '视频模型', icon: '🎬' },
  { key: 'presets', label: '预设库', icon: '📚' },
  { key: 'global', label: '全局提示词', icon: '✨' },
  { key: 'params', label: '视频参数', icon: '⚙' },
  { key: 'jimeng', label: '即梦 CLI', icon: '⚡' },
]

export default function SettingsPage() {
  const projectId = Number(useParams().projectId)
  const { settings, loading, error, save } = useGlobalSettings(projectId)
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState('system')

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
    } catch (e) {
      console.error('保存失败:', e)
    } finally {
      setSaving(false)
    }
  }

  // 加载中
  if (loading && !settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  // 错误状态
  if (error && !settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 顶部导航 */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/project/${projectId}`}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            ← 返回工作台
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-medium text-gray-300">
            项目 #{projectId} 设置
          </span>
        </div>
        {activeCategory !== 'system' && (
          <button
            onClick={handleSave}
            disabled={saving || !localSettings}
            className={`px-4 py-2 rounded text-sm font-medium ${
              saving || !localSettings
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        )}
      </header>

      {/* 主体区域：左右分栏 */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* 左侧导航 */}
        <nav className="w-[200px] bg-gray-900 border-r border-gray-800 p-4">
          <div className="space-y-1">
            {SETTING_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  activeCategory === cat.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* 右侧内容区 */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeCategory === 'system' && (
            <SystemConfig projectId={projectId} />
          )}
          {activeCategory === 'llm' && (
            <LLMConfig settings={localSettings} onChange={setLocalSettings} projectId={projectId} />
          )}
          {activeCategory === 'image' && (
            <ProvidersConfig projectId={projectId} providerType="image" />
          )}
          {activeCategory === 'video' && (
            <ProvidersConfig projectId={projectId} providerType="video" />
          )}
          {activeCategory === 'presets' && (
            <PresetsConfig projectId={projectId} />
          )}
          {activeCategory === 'global' && (
            <GlobalPromptConfig settings={localSettings} onChange={setLocalSettings} />
          )}
          {activeCategory === 'params' && (
            <VideoParamsConfig settings={localSettings} onChange={setLocalSettings} />
          )}
          {activeCategory === 'jimeng' && (
            <JimengConfig settings={localSettings} onChange={setLocalSettings} />
          )}
        </main>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-900 text-red-300 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  )
}