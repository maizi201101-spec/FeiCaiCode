/**
 * LLM 配置区块 - 左右分栏 + 预设提供商选择
 * 支持火山引擎、阿里云百炼、阿里云百炼 Coding Plan、第三方等
 */

import { useState } from 'react'
import { type GlobalSettings } from '../../api/prompts'

// 预设提供商配置
const LLM_PRESETS = [
  {
    key: 'volcengine',
    name: '火山引擎',
    description: '豆包大模型',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-32k',
    docs_url: 'https://www.volcengine.com/docs/82379',
  },
  {
    key: 'aliyun_bailian',
    name: '阿里云百炼',
    description: '通义千问',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    docs_url: 'https://help.aliyun.com/zh/model-studio/',
  },
  {
    key: 'aliyun_coding',
    name: '阿里云百炼 Coding Plan',
    description: '通义灵码',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-coder-plus',
    docs_url: 'https://help.aliyun.com/zh/model-studio/',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 / GPT-3.5',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4',
    docs_url: 'https://platform.openai.com/docs',
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat',
    base_url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    docs_url: 'https://platform.deepseek.com/docs',
  },
  {
    key: 'custom',
    name: '第三方 / 自定义',
    description: 'OpenAI 兼容接口',
    base_url: '',
    model: '',
    docs_url: '',
  },
]

interface LLMConfigProps {
  settings: GlobalSettings | null
  onChange: (settings: GlobalSettings) => void
}

export default function LLMConfig({ settings, onChange }: LLMConfigProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!settings) return null

  const handleChange = (field: keyof GlobalSettings, value: string) => {
    onChange({ ...settings, [field]: value })
  }

  // 选择预设提供商
  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey)
    const preset = LLM_PRESETS.find(p => p.key === presetKey)
    if (preset && presetKey !== 'custom') {
      onChange({
        ...settings,
        llm_base_url: preset.base_url,
        llm_model: preset.model,
      })
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">LLM API 配置</h2>
        <p className="text-sm text-gray-400">
          用于资产提取、分镜规划、提示词生成、梗概生成等
        </p>
      </div>

      {/* 预设提供商选择 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="text-sm font-medium text-gray-300 mb-3">选择提供商</div>

        <div className="grid grid-cols-2 gap-2">
          {LLM_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handleSelectPreset(preset.key)}
              className={`px-3 py-2 rounded border text-sm ${
                selectedPreset === preset.key
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="font-medium">{preset.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* 预设说明 */}
        {selectedPreset !== 'custom' && (
          <div className="mt-3 p-2 bg-gray-800 rounded text-xs text-gray-400">
            <div className="flex items-center justify-between">
              <span>
                Base URL: {LLM_PRESETS.find(p => p.key === selectedPreset)?.base_url}
              </span>
              {LLM_PRESETS.find(p => p.key === selectedPreset)?.docs_url && (
                <a
                  href={LLM_PRESETS.find(p => p.key === selectedPreset)?.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  获取 API Key →
                </a>
              )}
            </div>
            <div className="mt-1">
              模型: {LLM_PRESETS.find(p => p.key === selectedPreset)?.model}
            </div>
          </div>
        )}
      </div>

      {/* API Key 配置 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="text-sm font-medium text-gray-300 mb-3">API Key</div>

        <input
          type="password"
          value={settings.llm_api_key}
          onChange={(e) => handleChange('llm_api_key', e.target.value)}
          placeholder="输入 API Key..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        />

        <p className="text-xs text-gray-500 mt-2">
          API Key 会安全存储在本地数据库，不会上传到服务器
        </p>
      </div>

      {/* 高级配置（自定义时显示） */}
      {selectedPreset === 'custom' && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            <span>{showAdvanced ? '▼' : '▶'}</span>
            <span>高级配置</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4">
              {/* Base URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Base URL</label>
                <input
                  type="text"
                  value={settings.llm_base_url}
                  onChange={(e) => handleChange('llm_base_url', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  OpenAI 兼容接口地址
                </p>
              </div>

              {/* 模型名 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">模型名</label>
                <input
                  type="text"
                  value={settings.llm_model}
                  onChange={(e) => handleChange('llm_model', e.target.value)}
                  placeholder="gpt-4"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  推荐使用具备代码生成能力的模型
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 测试连接 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            // TODO: 实现测试连接功能
            alert('功能开发中：测试 LLM 连接')
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700"
        >
          测试连接
        </button>
        <span className="text-xs text-gray-500">
          点击测试验证 API Key 是否正确
        </span>
      </div>
    </div>
  )
}