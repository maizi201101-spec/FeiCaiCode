import { useState, useCallback } from 'react'
import { type VideoVersion, type VideoGenerationRequest, getVideoVersions, generateVideo, updateVideoStatus, selectVideoVersion } from '../api/videos'

export function useVideoGeneration(episodeId: number | null) {
  const [versions, setVersions] = useState<VideoVersion[]>([])
  const [generating, setGenerating] = useState(false)
  const [currentVersionId, setCurrentVersionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 获取镜头视频版本列表
  const fetchVersions = useCallback(async (shotId: string) => {
    if (!episodeId) return
    setError(null)
    try {
      const data = await getVideoVersions(episodeId, shotId)
      setVersions(data)
      // 默认选择最新版本
      if (data.length > 0 && !currentVersionId) {
        setCurrentVersionId(data[data.length - 1].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取视频版本失败')
    }
  }, [episodeId])

  // 提交生成任务
  const submitGeneration = useCallback(async (request: VideoGenerationRequest) => {
    if (!episodeId) throw new Error('未选择集数')

    setGenerating(true)
    setError(null)

    try {
      await generateVideo(episodeId, request)

      // 等待一段时间后刷新版本列表
      await new Promise(resolve => setTimeout(resolve, 30000)) // 简化：等待 30 秒后刷新

      await fetchVersions(request.shot_id)
      setGenerating(false)
    } catch (e) {
      setGenerating(false)
      setError(e instanceof Error ? e.message : '提交视频生成失败')
      throw e
    }
  }, [episodeId, fetchVersions])

  // 更新质检状态（合格）
  const markApproved = useCallback(async (versionId: number) => {
    try {
      await updateVideoStatus(versionId, 'approved')
      setVersions(prev => prev.map(v => v.id === versionId ? { ...v, qc_status: 'approved' } : v))
    } catch (e) {
      setError(e instanceof Error ? e.message : '标记合格失败')
    }
  }, [])

  // 更新质检状态（不合格）
  const markRejected = useCallback(async (versionId: number) => {
    try {
      await updateVideoStatus(versionId, 'rejected')
      setVersions(prev => prev.map(v => v.id === versionId ? { ...v, qc_status: 'rejected' } : v))
    } catch (e) {
      setError(e instanceof Error ? e.message : '标记不合格失败')
    }
  }, [])

  // 选定版本
  const selectVersion = useCallback(async (versionId: number) => {
    try {
      await selectVideoVersion(versionId)
      setVersions(prev => prev.map(v => ({
        ...v,
        selected: v.id === versionId,
        qc_status: v.id === versionId ? 'approved' : v.qc_status,
      })))
      setCurrentVersionId(versionId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '选定版本失败')
    }
  }, [])

  // 当前版本
  const currentVersion = versions.find(v => v.id === currentVersionId)

  // 清空版本（切换镜头时）
  const clearVersions = useCallback(() => {
    setVersions([])
    setCurrentVersionId(null)
  }, [])

  return {
    versions,
    generating,
    currentVersion,
    currentVersionId,
    error,
    fetchVersions,
    submitGeneration,
    markApproved,
    markRejected,
    selectVersion,
    setCurrentVersionId,
    clearVersions,
  }
}