import { useState, useEffect, useCallback } from 'react'
import {
  type Asset,
  type AssetType,
  type AssetCreatePayload,
  type AssetUpdatePayload,
  type ExtractPayload,
  getAssets,
  getEpisodeAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  extractAssets,
} from '../api/assets'

export function useAssets(
  projectId: number | null,
  episodeId?: number | null,
  viewMode?: 'all' | 'episode'
) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<AssetType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [extracting, setExtracting] = useState(false)

  const fetchAssets = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      let data: Asset[]
      if (viewMode === 'episode' && episodeId) {
        data = await getEpisodeAssets(projectId, episodeId, filterType ?? undefined)
      } else {
        data = await getAssets(projectId, filterType ?? undefined)
      }
      setAssets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取资产失败')
    } finally {
      setLoading(false)
    }
  }, [projectId, episodeId, viewMode, filterType])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.asset_id.toLowerCase().includes(query) ||
      (asset.description && asset.description.toLowerCase().includes(query)) ||
      (asset.appearance && asset.appearance.toLowerCase().includes(query))
    )
  })

  const addNewAsset = useCallback(async (payload: AssetCreatePayload) => {
    if (!projectId) throw new Error('No project selected')
    const newAsset = await createAsset(projectId, payload)
    setAssets((prev) => [...prev, newAsset])
    return newAsset
  }, [projectId])

  const editAsset = useCallback(
    async (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => {
      if (!projectId) throw new Error('No project selected')
      const updated = await updateAsset(projectId, assetType, assetId, payload)
      setAssets((prev) =>
        prev.map((a) =>
          a.asset_type === assetType && a.asset_id === assetId ? updated : a
        )
      )
      return updated
    },
    [projectId]
  )

  const removeAsset = useCallback(
    async (assetType: AssetType, assetId: string) => {
      if (!projectId) throw new Error('No project selected')
      await deleteAsset(projectId, assetType, assetId)
      setAssets((prev) =>
        prev.filter((a) => !(a.asset_type === assetType && a.asset_id === assetId))
      )
    },
    [projectId]
  )

  const triggerExtract = useCallback(async (payload: ExtractPayload) => {
    if (!projectId) throw new Error('No project selected')
    setExtracting(true)
    setError(null)
    try {
      const result = await extractAssets(projectId, payload)
      await fetchAssets()
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : '提取资产失败')
      throw e
    } finally {
      setExtracting(false)
    }
  }, [projectId, fetchAssets])

  return {
    assets: filteredAssets,
    allAssets: assets,
    loading,
    error,
    extracting,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    refetch: fetchAssets,
    addAsset: addNewAsset,
    editAsset,
    deleteAsset: removeAsset,
    extractAssets: triggerExtract,
  }
}