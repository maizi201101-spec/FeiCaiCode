import { useState, useCallback, useEffect } from 'react'
import { type GlobalSettings, getGlobalSettings, updateGlobalSettings } from '../api/prompts'

const BASE = '/api'

async function getGlobalOnlySettings(): Promise<GlobalSettings> {
  const res = await fetch(`${BASE}/settings/global`)
  if (!res.ok) throw new Error('获取全局设置失败')
  return res.json()
}

async function updateGlobalOnlySettings(settings: GlobalSettings): Promise<void> {
  const res = await fetch(`${BASE}/settings/global`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('保存全局设置失败')
}

export function useGlobalSettings(projectId: number | null) {
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = projectId
        ? await getGlobalSettings(projectId)
        : await getGlobalOnlySettings()
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取设置失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = useCallback(async (newSettings: GlobalSettings) => {
    setLoading(true)
    setError(null)
    try {
      if (projectId) {
        await updateGlobalSettings(projectId, newSettings)
      } else {
        await updateGlobalOnlySettings(newSettings)
      }
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