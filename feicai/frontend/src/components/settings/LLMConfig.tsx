/**
 * LLM 配置区块
 * API Key、Base URL、模型名
 */

import { type GlobalSettings } from '../../api/prompts'

interface LLMConfigProps {
  settings: GlobalSettings | null
  onChange: (settings: GlobalSettings) => void
}

export default function LLMConfig({ settings, onChange }: LLMConfigProps) {
  if (!settings) return null

  const handleChange = (field: keyof GlobalSettings, value: string) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">LLM API 配置</h2>

      <div className="space-y-4">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <input
            type="password"
            value={settings.llm_api_key}
            onChange={(e) => handleChange('llm_api_key', e.target.value)}
            placeholder="sk-..."
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            用于资产提取、分镜规划、提示词生成
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL
          </label>
          <input
            type="text"
            value={settings.llm_base_url}
            onChange={(e) => handleChange('llm_base_url', e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            OpenAI 兼容接口地址
          </p>
        </div>

        {/* 模型名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            模型名
          </label>
          <input
            type="text"
            value={settings.llm_model}
            onChange={(e) => handleChange('llm_model', e.target.value)}
            placeholder="gpt-4"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            推荐 gpt-4 或 gpt-3.5-turbo
          </p>
        </div>
      </div>
    </div>
  )
}