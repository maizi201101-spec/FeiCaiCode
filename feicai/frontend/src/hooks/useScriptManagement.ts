/**剧本管理 Hook
 * 状态管理：阶段切换、分集列表、连通跳转
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type EpisodeStatus,
  type EpisodeSplitResult,
  type EpisodeDetailResponse,
  getScriptStatus,
  confirmSplit,
  getEpisodeScriptDetail,
  regenerateSummary,
  checkCanReSplit,
} from '../api/scriptManagement'

export type Stage = 'stage1' | 'stage2'

export function useScriptManagement(projectId: number) {
  const [stage, setStage] = useState<Stage>('stage1')
  const [episodeStatuses, setEpisodeStatuses] = useState<EpisodeStatus[]>([])
  const [canReSplit, setCanReSplit] = useState(true)
  const [reSplitReason, setReSplitReason] = useState<string | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeStatus | null>(null)
  const [episodeDetail, setEpisodeDetail] = useState<EpisodeDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取全集状态
  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await getScriptStatus(projectId)
      setEpisodeStatuses(status.episodes)
      setCanReSplit(status.can_re_split)
      setReSplitReason(status.reason ?? null)

      // 如果已有分集数据，自动切换到 stage2
      if (status.episodes.length > 0 && status.episodes.some(ep => ep.has_script)) {
        setStage('stage2')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取状态失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 确认分集
  const handleConfirmSplit = useCallback(async (splits: EpisodeSplitResult[]) => {
    // DEBUG: 打印即将发送的 splits 数据
    console.log('[handleConfirmSplit] Sending splits:', splits.slice(0, 3).map(s => ({
      episode_number: s.episode_number,
      start: s.start_position,
      end: s.end_position,
      char_count: s.char_count,
    })))

    setConfirming(true)
    setError(null)
    try {
      const result = await confirmSplit(projectId, {
        splits,
        generate_summaries: true,
      })

      if (result.success) {
        // 切换到 stage2
        setStage('stage2')
        // 刷新状态
        await fetchStatus()
      }

      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认分集失败')
      return null
    } finally {
      setConfirming(false)
    }
  }, [projectId, fetchStatus])

  // 选择集数
  const handleSelectEpisode = useCallback(async (ep: EpisodeStatus) => {
    setSelectedEpisode(ep)
    setEpisodeDetail(null)

    if (ep.episode_id) {
      setLoading(true)
      try {
        const detail = await getEpisodeScriptDetail(ep.episode_id)
        setEpisodeDetail(detail)
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取剧本详情失败')
      } finally {
        setLoading(false)
      }
    }
  }, [])

  // 重新生成梗概
  const handleRegenerateSummary = useCallback(async (episodeId: number) => {
    setGeneratingSummary(true)
    setError(null)
    try {
      const result = await regenerateSummary(episodeId)
      // 更新 episodeDetail
      if (episodeDetail && episodeDetail.episode_id === episodeId) {
        setEpisodeDetail({
          ...episodeDetail,
          summary: result.summary,
          has_summary: true,
        })
      }
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成梗概失败')
      return null
    } finally {
      setGeneratingSummary(false)
    }
  }, [episodeDetail])

  // 检查可重新分集
  const checkReSplit = useCallback(async () => {
    try {
      const result = await checkCanReSplit(projectId)
      setCanReSplit(result.can_re_split)
      setReSplitReason(result.reason ?? null)
    } catch (e) {
      console.error('检查重新分集失败:', e)
    }
  }, [projectId])

  // 返回第一阶段
  const goBackToStage1 = useCallback(() => {
    if (!canReSplit) return
    setStage('stage1')
    setSelectedEpisode(null)
    setEpisodeDetail(null)
  }, [canReSplit])

  // 初始化时获取状态
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
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
    fetchStatus,
    handleConfirmSplit,
    handleSelectEpisode,
    handleRegenerateSummary,
    checkReSplit,
    goBackToStage1,
  }
}