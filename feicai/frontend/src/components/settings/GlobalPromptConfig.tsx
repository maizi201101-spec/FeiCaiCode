/**
 * 全局提示词配置区块
 * 第1块全局提示词（追加到所有视频提示词末尾）
 * 暗色主题版本
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
    <div className="max-w-2xl">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">全局提示词（第1块）</h2>
        <p className="text-sm text-gray-400">
          此提示词将追加到所有视频提示词末尾，作为全局风格设定
        </p>
      </div>

      {/* 提示词输入 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <label className="text-sm font-medium text-gray-300 block mb-2">
          提示词内容
        </label>
        <textarea
          value={settings.global_prompt}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="真实电影质感,8K,禁BGM,禁字幕"
          rows={4}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* 常用示例 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="text-sm font-medium text-gray-300 mb-3">常用示例</div>
        <div className="space-y-2">
          <button
            onClick={() => handleChange('真实电影质感,8K,禁BGM,禁字幕')}
            className="w-full text-left px-3 py-2 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            真实电影质感,8K,禁BGM,禁字幕
          </button>
          <button
            onClick={() => handleChange('动漫赛璐璐风,鲜艳色彩,2D渲染')}
            className="w-full text-left px-3 py-2 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            动漫赛璐璐风,鲜艳色彩,2D渲染
          </button>
          <button
            onClick={() => handleChange('复古胶片风,暖色调,颗粒感')}
            className="w-full text-left px-3 py-2 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            复古胶片风,暖色调,颗粒感
          </button>
        </div>
      </div>
    </div>
  )
}