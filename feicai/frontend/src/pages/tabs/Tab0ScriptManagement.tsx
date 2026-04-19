/**Tab 0 剧本管理主页面
 * 两阶段结构：导入全集 + 分集确认 / 分集列表 + 单集预览
 */

import { useScriptManagement } from '../../hooks/useScriptManagement'
import { useSplitDetection } from '../../hooks/useSplitDetection'
import Stage1Import from '../../components/script/Stage1Import'
import Stage2List from '../../components/script/Stage2List'
import { type EpisodeSplitResult, type ScriptType } from '../../api/scriptManagement'

interface Tab0ScriptManagementProps {
  projectId: number
  onGoToTab1: () => void
}

export default function Tab0ScriptManagement({ projectId, onGoToTab1 }: Tab0ScriptManagementProps) {
  const {
    stage,
    setStage,
    episodeStatuses,
    canReSplit,
    reSplitReason,
    selectedEpisode,
    episodeDetail,
    loading,
    confirming,
    generatingSummary,
    error,
    handleConfirmSplit,
    handleSelectEpisode,
    handleRegenerateSummary,
    goBackToStage1,
  } = useScriptManagement(projectId)

  const {
    detectionResult,
    detecting,
    detect,
    clear,
  } = useSplitDetection(projectId)

  // 确认分集
  const handleConfirm = async () => {
    if (!detectionResult) return
    const result = await handleConfirmSplit(detectionResult.results as EpisodeSplitResult[])
    if (result?.success) {
      clear()
    }
  }

  // 返回第一阶段
  const handleReSplit = () => {
    if (!canReSplit) return
    goBackToStage1()
    clear()
  }

  // 重新生成全部梗概
  const handleRegenerateAllSummaries = async () => {
    // TODO: 实现批量重新生成
    alert('功能开发中')
  }

  return (
    <div className="flex flex-col h-full p-4">
      {/* 阶段指示 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-300">
          剧本管理 · {stage === 'stage1' ? '第一阶段：导入全集' : '第二阶段：分集管理'}
        </div>
        {stage === 'stage2' && (
          <button
            onClick={() => setStage('stage1')}
            disabled={!canReSplit}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:text-gray-600"
          >
            返回第一阶段
          </button>
        )}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto">
        {stage === 'stage1' ? (
          <Stage1Import
            detectionResult={detectionResult ? {
              results: detectionResult.results,
              avg_confidence: detectionResult.avg_confidence,
              avg_char_count: detectionResult.avg_char_count,
              has_gaps: detectionResult.has_gaps,
              gap_positions: detectionResult.gap_positions,
            } : null}
            detecting={detecting}
            error={error}
            onDetect={(content, scriptType, expectedEpisodes) => {
              detect(content, scriptType as ScriptType, expectedEpisodes)
            }}
            onConfirm={handleConfirm}
          />
        ) : (
          <Stage2List
            episodes={episodeStatuses}
            selectedEpisode={selectedEpisode}
            episodeDetail={episodeDetail}
            canReSplit={canReSplit}
            reSplitReason={reSplitReason}
            generatingSummary={generatingSummary}
            onSelectEpisode={handleSelectEpisode}
            onReSplit={handleReSplit}
            onRegenerateAllSummaries={handleRegenerateAllSummaries}
            onRegenerateSummary={() => {
              if (selectedEpisode?.episode_id) {
                handleRegenerateSummary(selectedEpisode.episode_id)
              }
            }}
            onGoToAssetExtraction={onGoToTab1}
          />
        )}
      </div>

      {/* 加载状态 */}
      {(loading || confirming) && (
        <div className="absolute inset-0 bg-gray-950/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-gray-400">
            {confirming ? '确认分集中...' : '加载中...'}
          </span>
        </div>
      )}
    </div>
  )
}