/**第二阶段：分集列表 + 单集预览
 * 左侧分集列表（状态标记），右侧剧本/梗概预览
 */

import { type EpisodeStatus, type EpisodeDetailResponse } from '../../api/scriptManagement'
import EpisodeScriptPanel from './EpisodeScriptPanel'

interface Stage2ListProps {
  episodes: EpisodeStatus[]
  selectedEpisode: EpisodeStatus | null
  episodeDetail: EpisodeDetailResponse | null
  canReSplit: boolean
  reSplitReason: string | null
  generatingSummary: boolean
  onSelectEpisode: (ep: EpisodeStatus) => void
  onReSplit: () => void
  onRegenerateAllSummaries: () => void
  onRegenerateSummary: () => void
  onGoToAssetExtraction: () => void
}

export default function Stage2List({
  episodes,
  selectedEpisode,
  episodeDetail,
  canReSplit,
  reSplitReason,
  generatingSummary,
  onSelectEpisode,
  onReSplit,
  onRegenerateAllSummaries,
  onRegenerateSummary,
  onGoToAssetExtraction,
}: Stage2ListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 主区域：左右分栏 */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* 左侧：分集列表 */}
        <div className="w-[200px] bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm font-medium text-gray-300">
            分集列表
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 h-full">
            {episodes.length === 0 ? (
              <div className="p-4 text-gray-400 text-center">暂无分集数据</div>
            ) : (
              episodes.map((ep) => (
                <button
                  key={ep.episode_number}
                  onClick={() => onSelectEpisode(ep)}
                  className={`w-full px-4 py-2 flex items-center gap-2 text-sm border-b border-gray-800 last:border-b-0 ${
                    selectedEpisode?.episode_number === ep.episode_number
                      ? 'bg-indigo-900/30 text-indigo-300'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="font-medium">EP{ep.episode_number.toString().padStart(2, '0')}</span>
                  <span className="flex-1"></span>
                  {ep.has_script && ep.has_summary ? (
                    <span className="text-xs text-green-400">✓ 已导入</span>
                  ) : ep.has_script ? (
                    <span className="text-xs text-yellow-400">梗概已生成</span>
                  ) : (
                    <span className="text-xs text-gray-500">○ 待确认</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右侧：剧本和梗概预览 */}
        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <EpisodeScriptPanel
            episodeDetail={episodeDetail}
            generatingSummary={generatingSummary}
            onRegenerateSummary={onRegenerateSummary}
          />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between bg-gray-900 rounded-lg border border-gray-700 p-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={onReSplit}
            disabled={!canReSplit}
            className={`px-3 py-1.5 rounded text-sm ${
              canReSplit
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-600'
            }`}
            title={!canReSplit ? reSplitReason ?? undefined : undefined}
          >
            重新分集
          </button>
          {!canReSplit && reSplitReason && (
            <span className="text-xs text-gray-500">{reSplitReason}</span>
          )}
          <button
            onClick={onRegenerateAllSummaries}
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 border border-gray-600"
          >
            重新生成全部梗概
          </button>
        </div>
        <button
          onClick={onGoToAssetExtraction}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
        >
          进入资产提取 →
        </button>
      </div>
    </div>
  )
}