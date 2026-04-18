/**
 * 即梦 CLI 配置区块
 * CLI 路径、图片生成默认参数
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
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">即梦 CLI 配置</h2>

      <div className="space-y-4">
        {/* CLI 路径 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CLI 路径
          </label>
          <input
            type="text"
            value={settings.jimeng_cli_path}
            onChange={(e) => handleChange('jimeng_cli_path', e.target.value)}
            placeholder="/usr/local/bin/jimeng-cli"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            即梦 CLI 可执行文件路径（用于图片和视频生成）
          </p>
        </div>

        {/* 图片生成模型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            图片生成模型
          </label>
          <input
            type="text"
            value={settings.default_image_model}
            onChange={(e) => handleChange('default_image_model', e.target.value)}
            placeholder="dall-e-3"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 图片尺寸 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            图片尺寸
          </label>
          <select
            value={settings.default_image_size}
            onChange={(e) => handleChange('default_image_size', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="1024x1024">1024x1024</option>
            <option value="1024x1792">1024x1792（竖屏）</option>
            <option value="1792x1024">1792x1024（横屏）</option>
          </select>
        </div>
      </div>
    </div>
  )
}