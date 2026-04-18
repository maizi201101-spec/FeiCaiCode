/**
 * 全局提示词配置区块
 * 第1块全局提示词（追加到所有视频提示词末尾）
 */

import { type GlobalSettings } from '../../api/prompts'

interface GlobalPromptConfigProps {
  settings: GlobalSettings | null
  onChange: (settings: GlobalSettings) => void
}

export default function GlobalPromptConfig({ settings, onChange }: GlobalPromptConfigProps) {
  if (!settings) return null

  const handleChange = (value: string) => {
    onChange({ ...settings, global_prompt: value })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">全局提示词（第1块）</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          提示词内容
        </label>
        <textarea
          value={settings.global_prompt}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="真实电影质感,8K,禁BGM,禁字幕"
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          此提示词将追加到所有视频提示词末尾，作为全局风格设定
        </p>
      </div>

      {/* 示例 */}
      <div className="mt-4 p-3 bg-gray-50 rounded">
        <p className="text-xs font-medium text-gray-700 mb-2">常用示例：</p>
        <div className="space-y-1">
          <button
            onClick={() => handleChange('真实电影质感,8K,禁BGM,禁字幕')}
            className="text-xs text-blue-600 hover:underline"
          >
            真实电影质感,8K,禁BGM,禁字幕
          </button>
          <button
            onClick={() => handleChange('动漫赛璐璐风,鲜艳色彩,2D渲染')}
            className="text-xs text-blue-600 hover:underline"
          >
            动漫赛璐璐风,鲜艳色彩,2D渲染
          </button>
          <button
            onClick={() => handleChange('复古胶片风,暖色调,颗粒感')}
            className="text-xs text-blue-600 hover:underline"
          >
            复古胶片风,暖色调,颗粒感
          </button>
        </div>
      </div>
    </div>
  )
}