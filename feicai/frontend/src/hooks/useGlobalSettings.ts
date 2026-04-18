import { useState, useCallback, useEffect } from 'react'
import { type GlobalSettings, getGlobalSettings, updateGlobalSettings } from '../api/prompts'

export function useGlobalSettings(projectId: number | null) {
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getGlobalSettings(projectId)
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取设置失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // projectId 变化时自动获取设置
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = useCallback(async (newSettings: GlobalSettings) => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      await updateGlobalSettings(projectId, newSettings)
      setSettings(newSettings)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存设置失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    save: saveSettings,
  }
}