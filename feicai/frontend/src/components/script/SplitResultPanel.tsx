/**分集检测结果面板
 * 显示每集起止位置、字数、置信度、异常标记
 */

import { type EpisodeSplitResult } from '../../api/scriptManagement'

interface SplitResultPanelProps {
  results: EpisodeSplitResult[]
  avgConfidence: number
  avgCharCount: number
  hasGaps: boolean
  gapPositions: number[]
  onConfirm: () => void
  detecting: boolean
  onScrollToEpisode?: (episodeNumber: number) => void
}

export default function SplitResultPanel({
  results,
  avgConfidence,
  avgCharCount,
  hasGaps,
  gapPositions,
  onConfirm,
  detecting,
  onScrollToEpisode,
}: SplitResultPanelProps) {
  if (detecting) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-400">正在分析剧本...</span>
      </div>
    )
  }

  if (!results.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        无检测结果
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 检测结果列表 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm font-medium text-gray-300">
          检测结果
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {results.map((result, index) => (
            <div
              key={index}
              onClick={() => onScrollToEpisode?.(result.episode_number)}
              className={`px-4 py-2 flex items-center justify-between border-b border-gray-800 last:border-b-0 ${
                result.is_abnormal ? 'bg-red-900/20' : ''
              } ${onScrollToEpisode ? 'cursor-pointer hover:bg-gray-800/60' : ''}`}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-300">
                  EP{result.episode_number.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-500">
                  第{result.start_position}-{result.end_position}字
                </span>
                <span className="text-xs text-gray-500">
                  {result.char_count}字
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    result.confidence >= 90
                      ? 'bg-green-900/30 text-green-400'
                      : result.confidence >= 60
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}
                >
                  置信度 {result.confidence.toFixed(0)}%
                </span>
                {result.is_abnormal ? (
                  <span className="text-xs text-red-400">⚠ {result.abnormal_reason}</span>
                ) : (
                  <span className="text-xs text-green-400">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 验证提示 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="text-sm font-medium text-gray-300 mb-2">验证提示</div>
        <div className="space-y-1 text-xs text-gray-400">
          <div>各集字数范围：{Math.min(...results.map(r => r.char_count))}-{Math.max(...results.map(r => r.char_count))}字（平均 {avgCharCount.toFixed(0)}字）</div>
          {hasGaps && (
            <div className="text-red-400">
              集数编号不连续，缺少：EP{gapPositions.join(', EP')}
            </div>
          )}
          {results.filter(r => r.is_abnormal).length > 0 && (
            <div className="text-yellow-400">
              {results.filter(r => r.is_abnormal).length} 异常，建议检查
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onConfirm}
          disabled={detecting}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认分集
        </button>
      </div>

      {/* 状态栏 */}
      <div className="text-xs text-gray-500 text-center">
        已识别 {results.length} 集 · 总字数 {results.reduce((sum, r) => sum + r.char_count, 0)} · 检测置信度 平均 {avgConfidence.toFixed(0)}%
      </div>
    </div>
  )
}