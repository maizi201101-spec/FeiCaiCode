/**
 * 质检状态管理 Hook
 * 组级别 QC 数据、返修镜头 IDs、状态更新操作
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  type GroupQCData,
  getEpisodeQCData,
  updateGroupStatus,
  selectGroupVersion,
} from '../api/qc'

type QCFilter = 'all' | 'pending' | 'revision' | 'approved'

export function useQC(episodeId: number | null) {
  const [groups, setGroups] = useState<GroupQCData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QCFilter>('all')

  // 获取全集 QC 数据
  const fetchQCData = useCallback(async () => {
    if (!episodeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getEpisodeQCData(episodeId)
      setGroups(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取质检数据失败')
    } finally {
      setLoading(false)
    }
  }, [episodeId])

  useEffect(() => {
    fetchQCData()
  }, [fetchQCData])

  // 标记返修
  const markRevision = useCallback(async (groupId: string, note?: string) => {
    if (!episodeId) return
    try {
      await updateGroupStatus(episodeId, groupId, 'revision', note)
      // 乐观更新
      setGroups(prev =>
        prev.map(g => (g.group_id === groupId ? { ...g, status: 'revision', revision_note: note } : g))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '标记返修失败')
      throw e
    }
  }, [episodeId])

  // 标记合格
  const markApproved = useCallback(async (groupId: string) => {
    if (!episodeId) return
    try {
      await updateGroupStatus(episodeId, groupId, 'approved')
      setGroups(prev =>
        prev.map(g => (g.group_id === groupId ? { ...g, status: 'approved' } : g))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '标记合格失败')
      throw e
    }
  }, [episodeId])

  // 选定版本
  const selectVersion = useCallback(async (groupId: string, versionId: number) => {
    if (!episodeId) return
    try {
      await selectGroupVersion(episodeId, groupId, versionId)
      setGroups(prev =>
        prev.map(g =>
          g.group_id === groupId
            ? { ...g, status: 'approved', selected_version_id: versionId }
            : g
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '选定版本失败')
      throw e
    }
  }, [episodeId])

  // 获取返修镜头 IDs（用于传递给 Tab3）
  const revisionShotIds = useMemo(() => {
    return groups
      .filter(g => g.status === 'revision')
      .flatMap(g => g.videos.map(v => v.shot_id))
  }, [groups])

  // 筛选后的组列表
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groups
    return groups.filter(g => g.status === filter)
  }, [groups, filter])

  // 确认进度统计
  const confirmedCount = groups.filter(g => g.status === 'approved').length
  const totalCount = groups.length

  return {
    groups,
    filteredGroups,
    loading,
    error,
    filter,
    setFilter,
    revisionShotIds,
    confirmedCount,
    totalCount,
    fetchQCData,
    markRevision,
    markApproved,
    selectVersion,
  }
}