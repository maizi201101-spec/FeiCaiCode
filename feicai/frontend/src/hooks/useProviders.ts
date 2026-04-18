/**
 * 提供商配置状态管理 Hook
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type Provider,
  type ProviderType,
  type ProjectProviders,
  type ProviderCreatePayload,
  type ProviderUpdatePayload,
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  setDefaultProvider,
  getProjectDefaults,
} from '../api/providers'

export function useProviders(projectId: number) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [projectDefaults, setProjectDefaults] = useState<ProjectProviders | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProviders = useCallback(async (providerType?: ProviderType) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProviders(providerType)
      setProviders(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载提供商失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProjectDefaults = useCallback(async () => {
    try {
      const data = await getProjectDefaults(projectId)
      setProjectDefaults(data)
    } catch (e) {
      console.error('加载项目默认提供商失败:', e)
    }
  }, [projectId])

  useEffect(() => {
    loadProviders()
    loadProjectDefaults()
  }, [loadProviders, loadProjectDefaults])

  const create = useCallback(async (payload: ProviderCreatePayload) => {
    setLoading(true)
    setError(null)
    try {
      const newProvider = await createProvider(payload)
      setProviders(prev => [...prev, newProvider])
      return newProvider
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建提供商失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(async (providerId: string, payload: ProviderUpdatePayload) => {
    setLoading(true)
    setError(null)
    try {
      const updated = await updateProvider(providerId, payload)
      setProviders(prev => prev.map(p => p.provider_id === providerId ? updated : p))
      return updated
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新提供商失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const remove = useCallback(async (providerId: string) => {
    setLoading(true)
    setError(null)
    try {
      await deleteProvider(providerId)
      setProviders(prev => prev.filter(p => p.provider_id !== providerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除提供商失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const setDefault = useCallback(async (providerType: ProviderType, providerId: string) => {
    setLoading(true)
    setError(null)
    try {
      await setDefaultProvider(projectId, providerType, providerId)
      await loadProjectDefaults()
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置默认提供商失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [projectId, loadProjectDefaults])

  const getByType = useCallback((providerType: ProviderType) => {
    return providers.filter(p => p.provider_type === providerType)
  }, [providers])

  const getDefaultByType = useCallback((providerType: ProviderType) => {
    const defaultsKey = `${providerType}_provider_id` as keyof ProjectProviders
    const defaultId = projectDefaults?.[defaultsKey]
    return providers.find(p => p.provider_id === defaultId)
  }, [providers, projectDefaults])

  return {
    providers,
    projectDefaults,
    loading,
    error,
    loadProviders,
    loadProjectDefaults,
    create,
    update,
    remove,
    setDefault,
    getByType,
    getDefaultByType,
  }
}