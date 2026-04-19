/**
 * 即梦 CLI 配置区块
 * CLI 路径、图片生成默认参数
 * 暗色主题版本
 */

import { type GlobalSettings } from '../../api/prompts'

interface JimengConfigProps {
  settings: GlobalSettings | null
  onChange: (settings: GlobalSettings) => void
}

export default function JimengConfig({ settings, onChange }: JimengConfigProps) {
  if (!settings) return null

  const handleChange = (field: keyof GlobalSettings, value: string) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <div className="max-w-2xl">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">即梦 CLI 配置</h2>
        <p className="text-sm text-gray-400">
          配置即梦 CLI 工具路径和默认参数
        </p>
      </div>

      {/* CLI 路径 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <label className="text-sm font-medium text-gray-300 block mb-2">
          CLI 路径
        </label>
        <input
          type="text"
          value={settings.jimeng_cli_path}
          onChange={(e) => handleChange('jimeng_cli_path', e.target.value)}
          placeholder="/usr/local/bin/jimeng-cli"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-gray-500 mt-2">
          即梦 CLI 可执行文件路径（用于图片和视频生成）
        </p>
      </div>

      {/* 图片生成参数 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="text-sm font-medium text-gray-300 mb-3">图片生成默认参数</div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">图片生成模型</label>
            <input
              type="text"
              value={settings.default_image_model}
              onChange={(e) => handleChange('default_image_model', e.target.value)}
              placeholder="dall-e-3"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">图片尺寸</label>
            <select
              value={settings.default_image_size}
              onChange={(e) => handleChange('default_image_size', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="1024x1024">1024x1024</option>
              <option value="1024x1792">1024x1792（竖屏）</option>
              <option value="1792x1024">1792x1024（横屏）</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}