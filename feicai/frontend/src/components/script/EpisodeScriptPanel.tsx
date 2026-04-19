/**单集剧本和梗概面板
 * 显示剧本全文 + 梗概，支持重新生成梗概
 */

import { useState } from 'react'
import { type EpisodeDetailResponse } from '../../api/scriptManagement'

interface EpisodeScriptPanelProps {
  episodeDetail: EpisodeDetailResponse | null
  generatingSummary: boolean
  onRegenerateSummary: () => void
}

export default function EpisodeScriptPanel({
  episodeDetail,
  generatingSummary,
  onRegenerateSummary,
}: EpisodeScriptPanelProps) {
  const [showFullScript, setShowFullScript] = useState(false)

  if (!episodeDetail) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        请选择集数查看详情
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 剧本全文 */}
      <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">
            EP{episodeDetail.episode_number.toString().padStart(2, '0')} 剧本全文
          </span>
          <button
            onClick={() => setShowFullScript(!showFullScript)}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            {showFullScript ? '收起' : '展开全部'}
          </button>
        </div>
        <div className={`p-4 overflow-y-auto ${showFullScript ? 'max-h-[400px]' : 'max-h-[200px]'}`}>
          {episodeDetail.has_script && episodeDetail.script_content ? (
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {showFullScript
                ? episodeDetail.script_content
                : episodeDetail.script_content.slice(0, 500) + '...'}
            </div>
          ) : (
            <div className="text-gray-400">暂无剧本</div>
          )}
        </div>
      </div>

      {/* 本集梗概 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">本集梗概</span>
          {episodeDetail.has_summary && (
            <button
              onClick={onRegenerateSummary}
              disabled={generatingSummary}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {generatingSummary ? '生成中...' : '重新生成'}
            </button>
          )}
        </div>
        <div className="p-4">
          {generatingSummary ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              <span className="ml-2 text-gray-400">生成梗概...</span>
            </div>
          ) : episodeDetail.has_summary && episodeDetail.summary ? (
            <div className="text-sm text-gray-300">{episodeDetail.summary}</div>
          ) : (
            <div className="text-gray-400 text-center">暂无梗概</div>
          )}
        </div>
      </div>
    </div>
  )
}