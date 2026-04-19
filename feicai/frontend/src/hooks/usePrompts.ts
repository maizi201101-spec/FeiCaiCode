import { useState, useEffect, useCallback } from 'react'
import {
  type PromptsCollection,
  type PromptUpdatePayload,
  generatePrompts,
  getPrompts,
  updatePrompt,
  confirmPrompt,
} from '../api/prompts'
import { pollTaskStatus } from './useTaskPolling'

export function usePrompts(episodeId: number | null) {
  const [promptsCollection, setPromptsCollection] = useState<PromptsCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchPrompts = useCallback(async () => {
    if (!episodeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPrompts(episodeId)
      setPromptsCollection(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取提示词失败')
    } finally {
      setLoading(false)
    }
  }, [episodeId])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // AI 生成提示词
  const triggerGenerate = useCallback(async () => {
    if (!episodeId) throw new Error('未选择集数')

    setGenerating(true)
    setError(null)

    try {
      const { taskId } = await generatePrompts(episodeId)

      await pollTaskStatus(taskId, {
        interval: 5000,
        maxAttempts: 120,
        onComplete: () => {
          setGenerating(false)
          fetchPrompts()
        },
        onFailed: (err) => {
          setGenerating(false)
          setError(err)
        },
      })
    } catch (e) {
      setGenerating(false)
      setError(e instanceof Error ? e.message : '生成提示词失败')
      throw e
    }
  }, [episodeId, fetchPrompts])

  // 更新单镜头提示词
  const editPrompt = useCallback(
    async (shotId: string, updates: PromptUpdatePayload) => {
      if (!episodeId) throw new Error('未选择集数')
      if (!promptsCollection) throw new Error('无提示词数据')

      const updated = await updatePrompt(episodeId, shotId, updates)

      setPromptsCollection((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          prompts: prev.prompts.map((p) => (p.shot_id === shotId ? updated : p)),
        }
      })

      return updated
    },
    [episodeId, promptsCollection]
  )

  // 确认提示词
  const confirmPromptStatus = useCallback(
    async (shotId: string) => {
      if (!episodeId) throw new Error('未选择集数')

      const updated = await confirmPrompt(episodeId, shotId)

      setPromptsCollection((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          prompts: prev.prompts.map((p) => (p.shot_id === shotId ? updated : p)),
        }
      })

      return updated
    },
    [episodeId]
  )

  return {
    promptsCollection,
    prompts: promptsCollection?.prompts ?? [],
    loading,
    error,
    generating,
    refetch: fetchPrompts,
    generatePrompts: triggerGenerate,
    editPrompt,
    confirmPrompt: confirmPromptStatus,
  }
}