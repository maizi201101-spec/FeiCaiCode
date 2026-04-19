/**
 * 视频参数配置区块
 * 默认模型、时长、分辨率、比例
 * 暗色主题版本
 */

import { type GlobalSettings } from '../../api/prompts'

interface VideoParamsConfigProps {
  settings: GlobalSettings | null
  onChange: (settings: GlobalSettings) => void
}

export default function VideoParamsConfig({ settings, onChange }: VideoParamsConfigProps) {
  if (!settings) return null

  const handleChange = (field: keyof GlobalSettings, value: string | number) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <div className="max-w-2xl">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">视频生成默认参数</h2>
        <p className="text-sm text-gray-400">
          配置视频生成时使用的默认参数
        </p>
      </div>

      {/* 参数配置 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* 默认模型 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              默认模型
            </label>
            <select
              value={settings.default_model}
              onChange={(e) => handleChange('default_model', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="seedance2.0">Seedance 2.0</option>
              <option value="seedance1.5">Seedance 1.5</option>
              <option value="dreamina">Dreamina</option>
            </select>
          </div>

          {/* 默认时长 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              默认时长
            </label>
            <select
              value={settings.default_duration}
              onChange={(e) => handleChange('default_duration', Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="4">4 秒</option>
              <option value="5">5 秒</option>
              <option value="6">6 秒</option>
            </select>
          </div>

          {/* 默认分辨率 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              默认分辨率
            </label>
            <select
              value={settings.default_resolution}
              onChange={(e) => handleChange('default_resolution', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4K">4K</option>
            </select>
          </div>

          {/* 默认比例 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              默认比例
            </label>
            <select
              value={settings.default_ratio}
              onChange={(e) => handleChange('default_ratio', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="9:16">9:16（竖屏）</option>
              <option value="16:9">16:9（横屏）</option>
              <option value="1:1">1:1（方形）</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}