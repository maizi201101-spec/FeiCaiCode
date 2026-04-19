import { useState, useEffect, useCallback } from 'react'
import {
  type ShotsCollection,
  type ShotUpdatePayload,
  planShots,
  getShots,
  updateShot,
  updateShotGroup,
} from '../api/shots'
import { pollTaskStatus } from './useTaskPolling'

export function useShots(episodeId: number | null) {
  const [shotsCollection, setShotsCollection] = useState<ShotsCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchShots = useCallback(async () => {
    if (!episodeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getShots(episodeId)
      setShotsCollection(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取分镜失败')
    } finally {
      setLoading(false)
    }
  }, [episodeId])

  useEffect(() => {
    fetchShots()
  }, [fetchShots])

  // 触发 AI 分镜规划
  const triggerPlanShots = useCallback(async () => {
    if (!episodeId) throw new Error('未选择集数')

    setGenerating(true)
    setError(null)

    try {
      const { taskId } = await planShots(episodeId)

      // 轮询任务状态（最多等 10 分钟：120次 × 5秒）
      await pollTaskStatus(taskId, {
        interval: 5000,
        maxAttempts: 120,
        onComplete: () => {
          setGenerating(false)
          fetchShots()
        },
        onFailed: (err) => {
          setGenerating(false)
          setError(err)
        },
      })
    } catch (e) {
      setGenerating(false)
      setError(e instanceof Error ? e.message : '分镜规划失败')
      throw e
    }
  }, [episodeId, fetchShots])

  // 更新单个镜头字段
  const editShot = useCallback(
    async (shotId: string, updates: ShotUpdatePayload) => {
      if (!episodeId) throw new Error('未选择集数')
      if (!shotsCollection) throw new Error('无分镜数据')

      const updatedShot = await updateShot(episodeId, shotId, updates)

      // 更新本地状态
      setShotsCollection((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          shots: prev.shots.map((s) => (s.shot_id === shotId ? updatedShot : s)),
        }
      })

      return updatedShot
    },
    [episodeId, shotsCollection]
  )

  // 调整镜头归组
  const changeShotGroup = useCallback(
    async (shotId: string, newGroupId: string) => {
      if (!episodeId) throw new Error('未选择集数')
      if (!shotsCollection) throw new Error('无分镜数据')

      const updatedShot = await updateShotGroup(episodeId, shotId, newGroupId)

      // 更新本地状态（包括组时长重算）
      setShotsCollection((prev) => {
        if (!prev) return prev

        // 更新镜头的 group_id
        const updatedShots = prev.shots.map((s) =>
          s.shot_id === shotId ? { ...s, group_id: newGroupId } : s
        )

        // 重算所有组时长
        const updatedGroups = prev.groups.map((g) => {
          const groupShots = updatedShots.filter((s) => s.group_id === g.group_id)
          return {
            ...g,
            shots: groupShots.map((s) => s.shot_id),
            total_duration: groupShots.reduce((sum, s) => sum + s.duration, 0),
          }
        })

        return {
          ...prev,
          shots: updatedShots,
          groups: updatedGroups,
        }
      })

      return updatedShot
    },
    [episodeId, shotsCollection]
  )

  return {
    shotsCollection,
    shots: shotsCollection?.shots ?? [],
    groups: shotsCollection?.groups ?? [],
    loading,
    error,
    generating,
    refetch: fetchShots,
    planShots: triggerPlanShots,
    editShot,
    changeShotGroup,
  }
}