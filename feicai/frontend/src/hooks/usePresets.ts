/**
 * 预设库状态管理 Hook
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type Preset,
  type PresetCategory,
  type ActivePresets,
  type PresetCreatePayload,
  type PresetUpdatePayload,
  getPresets,
  createPreset,
  updatePreset,
  deletePreset,
  activatePreset,
  deactivatePreset,
  getActivePresets,
} from '../api/presets'

export function usePresets(projectId: number) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [activePresets, setActivePresets] = useState<ActivePresets | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载所有预设
  const loadPresets = useCallback(async (category?: PresetCategory) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPresets(category)
      setPresets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载预设失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载激活的预设
  const loadActivePresets = useCallback(async () => {
    try {
      const data = await getActivePresets(projectId)
      setActivePresets(data)
    } catch (e) {
      console.error('加载激活预设失败:', e)
    }
  }, [projectId])

  // 初始加载
  useEffect(() => {
    loadPresets()
    loadActivePresets()
  }, [loadPresets, loadActivePresets])

  // 创建预设
  const create = useCallback(async (payload: PresetCreatePayload) => {
    setLoading(true)
    setError(null)
    try {
      const newPreset = await createPreset(payload)
      setPresets(prev => [...prev, newPreset])
      return newPreset
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建预设失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // 更新预设
  const update = useCallback(async (presetId: string, payload: PresetUpdatePayload) => {
    setLoading(true)
    setError(null)
    try {
      const updated = await updatePreset(presetId, payload)
      setPresets(prev => prev.map(p => p.preset_id === presetId ? updated : p))
      return updated
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新预设失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除预设
  const remove = useCallback(async (presetId: string) => {
    setLoading(true)
    setError(null)
    try {
      await deletePreset(presetId)
      setPresets(prev => prev.filter(p => p.preset_id !== presetId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除预设失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // 激活预设
  const activate = useCallback(async (presetId: string, category: PresetCategory) => {
    setLoading(true)
    setError(null)
    try {
      await activatePreset(presetId, projectId, category)
      // 更新本地状态
      setPresets(prev => prev.map(p => {
        if (category === 'special_effect') {
          return p.preset_id === presetId ? { ...p, is_active: true } : p
        }
        // 其他类别只能激活一个
        return p.category === category
          ? { ...p, is_active: p.preset_id === presetId }
          : p
      }))
      // 重新加载激活状态
      await loadActivePresets()
    } catch (e) {
      setError(e instanceof Error ? e.message : '激活预设失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [projectId, loadActivePresets])

  // 取消激活
  const deactivate = useCallback(async (presetId: string) => {
    setLoading(true)
    setError(null)
    try {
      await deactivatePreset(presetId, projectId)
      setPresets(prev => prev.map(p => p.preset_id === presetId ? { ...p, is_active: false } : p))
      await loadActivePresets()
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消激活失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [projectId, loadActivePresets])

  // 按分类筛选
  const getByCategory = useCallback((category: PresetCategory) => {
    return presets.filter(p => p.category === category)
  }, [presets])

  // 获取激活的预设
  const getActiveByCategory = useCallback((category: PresetCategory) => {
    return presets.find(p => p.category === category && p.is_active)
  }, [presets])

  return {
    presets,
    activePresets,
    loading,
    error,
    loadPresets,
    loadActivePresets,
    create,
    update,
    remove,
    activate,
    deactivate,
    getByCategory,
    getActiveByCategory,
  }
}