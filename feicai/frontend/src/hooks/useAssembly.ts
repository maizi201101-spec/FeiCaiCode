import { useState, useCallback } from 'react'
import { type Prompt, type SpecialPrompt, buildFinalVideoPrompt } from '../api/prompts'

export function useAssembly(
  prompts: Prompt[],
  globalPrompt: string
) {
  const [currentShotId, setCurrentShotId] = useState<string | null>(null)
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [mode, setMode] = useState<'image' | 'video'>('video')
  const [specialPrompts, setSpecialPrompts] = useState<SpecialPrompt[]>([])
  const [referenceImages, setReferenceImages] = useState<string[]>([])

  // 判断特殊提示词是否适用于某镜头
  const appliesToShot = useCallback((sp: SpecialPrompt, shotId: string, groupId: string | null) => {
    switch (sp.scope) {
      case 'shot':
        return sp.target_ids.includes(shotId)
      case 'group':
        return groupId !== null && sp.target_ids.includes(groupId)
      case 'episode':
        return true
      case 'selected':
        return sp.target_ids.includes(shotId)
      default:
        return false
    }
  }, [])

  // 获取最终视频提示词（拼接正文 + 特殊 + 全局）
  const getFinalVideoPrompt = useCallback((shotId: string) => {
    const prompt = prompts.find(p => p.shot_id === shotId)
    if (!prompt) return ''

    const groupId = prompts.find(p => p.shot_id === shotId)?.group_id || null
    const applicableSpecials = specialPrompts.filter(sp => appliesToShot(sp, shotId, groupId))

    return buildFinalVideoPrompt(prompt.video_prompt, applicableSpecials, globalPrompt)
  }, [prompts, specialPrompts, globalPrompt, appliesToShot])

  // 添加特殊提示词
  const addSpecialPrompt = useCallback((content: string, scope: SpecialPrompt['scope'], targetIds: string[] = []) => {
    const newSp: SpecialPrompt = {
      id: `sp_${Date.now()}`,
      content,
      scope,
      target_ids: targetIds,
    }
    setSpecialPrompts(prev => [...prev, newSp])
    return newSp
  }, [])

  // 删除特殊提示词
  const removeSpecialPrompt = useCallback((id: string) => {
    setSpecialPrompts(prev => prev.filter(sp => sp.id !== id))
  }, [])

  // 更新特殊提示词作用范围
  const updateSpecialPromptScope = useCallback((id: string, scope: SpecialPrompt['scope'], targetIds: string[]) => {
    setSpecialPrompts(prev =>
      prev.map(sp =>
        sp.id === id ? { ...sp, scope, target_ids: targetIds } : sp
      )
    )
  }, [])

  // 设置参考图（带锚定声明）
  const setReferenceImagesWithAnchors = useCallback((images: string[]) => {
    setReferenceImages(images.slice(0, 6)) // 最多 6 张
  }, [])

  // 清空当前镜头选择
  const clearSelection = useCallback(() => {
    setCurrentShotId(null)
    setCurrentGroupId(null)
  }, [])

  // 选择镜头时同步更新 group
  const selectShot = useCallback((shotId: string, groupId: string) => {
    setCurrentShotId(shotId)
    setCurrentGroupId(groupId)
  }, [])

  return {
    // 状态
    currentShotId,
    currentGroupId,
    mode,
    specialPrompts,
    referenceImages,

    // 操作
    setCurrentShotId,
    setCurrentGroupId,
    setMode,
    selectShot,
    clearSelection,

    // 特殊提示词
    addSpecialPrompt,
    removeSpecialPrompt,
    updateSpecialPromptScope,

    // 参考图
    setReferenceImages: setReferenceImagesWithAnchors,

    // 提示词拼接
    getFinalVideoPrompt,
    appliesToShot,

    // 获取当前镜头提示词
    getCurrentPrompt: () => prompts.find(p => p.shot_id === currentShotId),
  }
}