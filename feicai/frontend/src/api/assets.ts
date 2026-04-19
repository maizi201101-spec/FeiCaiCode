const BASE = '/api'

export type AssetType = 'character' | 'scene' | 'prop'

export interface Variant {
  variant_id: string
  variant_name: string
  trigger_condition?: string
  visual_diff?: string
}

export interface Asset {
  asset_type: AssetType
  asset_id: string
  name: string
  gender?: string
  age?: string
  appearance?: string
  outfit?: string
  description?: string
  visual_elements: string[]
  time_of_day?: string
  lighting?: string
  tags: string[]
  variants: Variant[]
  base_asset?: string
  images: string[]
}

export interface AssetCreatePayload {
  asset_type: AssetType
  asset_id: string
  name: string
  gender?: string
  age?: string
  appearance?: string
  outfit?: string
  description?: string
  visual_elements?: string[]
  time_of_day?: string
  lighting?: string
  tags?: string[]
  variants?: Variant[]
  base_asset?: string
}

export interface AssetUpdatePayload {
  name?: string
  gender?: string
  age?: string
  appearance?: string
  outfit?: string
  description?: string
  visual_elements?: string[]
  time_of_day?: string
  lighting?: string
  tags?: string[]
  variants?: Variant[]
  base_asset?: string
}

export interface ExtractPayload {
  episode_ids: number[]
  merge_mode?: boolean
}

export interface ExtractResult {
  episode_id: number
  episode_number: number
  status: string
  characters_count: number
  scenes_count: number
  props_count: number
  summary?: string
  error?: string
}

export async function getAssets(
  projectId: number,
  assetType?: AssetType
): Promise<Asset[]> {
  const url = assetType
    ? `${BASE}/projects/${projectId}/assets?asset_type=${assetType}`
    : `${BASE}/projects/${projectId}/assets`
  const res = await fetch(url)
  if (!res.ok) throw new Error('获取资产列表失败')
  return res.json()
}

export async function getEpisodeAssets(
  projectId: number,
  episodeId: number,
  assetType?: AssetType
): Promise<Asset[]> {
  const url = assetType
    ? `${BASE}/projects/${projectId}/episodes/${episodeId}/assets?asset_type=${assetType}`
    : `${BASE}/projects/${projectId}/episodes/${episodeId}/assets`
  const res = await fetch(url)
  if (!res.ok) throw new Error('获取分集资产失败')
  return res.json()
}

export async function getAssetDetail(
  projectId: number,
  assetType: AssetType,
  assetId: string
): Promise<Asset> {
  const res = await fetch(`${BASE}/projects/${projectId}/assets/${assetType}/${assetId}`)
  if (!res.ok) throw new Error('获取资产详情失败')
  return res.json()
}

export async function createAsset(
  projectId: number,
  payload: AssetCreatePayload
): Promise<Asset> {
  const res = await fetch(`${BASE}/projects/${projectId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '创建资产失败')
  }
  return res.json()
}

export async function updateAsset(
  projectId: number,
  assetType: AssetType,
  assetId: string,
  payload: AssetUpdatePayload
): Promise<Asset> {
  const res = await fetch(`${BASE}/projects/${projectId}/assets/${assetType}/${assetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新资产失败')
  }
  return res.json()
}

export async function deleteAsset(
  projectId: number,
  assetType: AssetType,
  assetId: string
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/assets/${assetType}/${assetId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('删除资产失败')
}

export async function extractAssets(
  projectId: number,
  payload: ExtractPayload
): Promise<{ results: ExtractResult[] }> {
  const res = await fetch(`${BASE}/projects/${projectId}/assets/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '提取资产失败')
  }
  return res.json()
}

// ========== 图片管理 API ==========

export interface AssetImage {
  index: number
  path: string
  exists: boolean
  is_primary: boolean
}

export interface UploadResult {
  message: string
  image_index: number
  image_path: string
}

export interface GenerateResult {
  task_id: number
  status: string
  message: string
}

export interface TaskStatus {
  id: number
  project_id: number
  episode_id: number | null
  type: string
  status: string
  payload: Record<string, unknown>
  result: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export async function uploadAssetImage(
  projectId: number,
  assetType: AssetType,
  assetId: string,
  file: File
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(
    `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '上传图片失败')
  }
  return res.json()
}

export async function generateAssetImage(
  projectId: number,
  assetType: AssetType,
  assetId: string
): Promise<GenerateResult> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images/generate`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'AI 生图失败')
  }
  return res.json()
}

export async function getAssetImages(
  projectId: number,
  assetType: AssetType,
  assetId: string
): Promise<{ images: AssetImage[]; total: number }> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images`
  )
  if (!res.ok) throw new Error('获取图片列表失败')
  return res.json()
}

export async function deleteAssetImage(
  projectId: number,
  assetType: AssetType,
  assetId: string,
  imageIndex: number
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images/${imageIndex}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '删除图片失败')
  }
}

export async function setPrimaryImage(
  projectId: number,
  assetType: AssetType,
  assetId: string,
  imageIndex: number
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images/${imageIndex}/primary`,
    { method: 'PUT' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '设置主图失败')
  }
}

export async function getTaskStatus(taskId: number): Promise<TaskStatus> {
  const res = await fetch(`${BASE}/tasks/${taskId}`)
  if (!res.ok) throw new Error('获取任务状态失败')
  return res.json()
}

export function getImageUrl(projectId: number, assetType: AssetType, assetId: string, imageIndex: number): string {
  return `${BASE}/projects/${projectId}/assets/${assetType}/${assetId}/images/${imageIndex}/file`
}