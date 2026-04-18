/**
 * 提供商配置 API
 * 提供商 CRUD + 项目默认提供商设置
 */

const BASE = '/api'

// 类型定义
export type ProviderType = 'llm' | 'image' | 'video'
export type ProviderImplType = 'jimeng_cli' | 'http_api'
export type LLMUsageTag = 'asset_extract' | 'storyboard_plan' | 'prompt_generate'

export interface Provider {
  provider_id: string
  name: string
  provider_type: ProviderType
  impl_type: ProviderImplType
  api_key?: string
  base_url?: string
  model_name?: string
  cli_path?: string
  usage_tags: LLMUsageTag[]
  default_image_params: Record<string, unknown>
  video_spec_preset_id?: string
  is_active: boolean
  is_builtin: boolean
  created_at?: string
  updated_at?: string
}

export interface ProviderCreatePayload {
  name: string
  provider_type: ProviderType
  impl_type?: ProviderImplType
  api_key?: string
  base_url?: string
  model_name?: string
  cli_path?: string
  usage_tags?: LLMUsageTag[]
  default_image_params?: Record<string, unknown>
  video_spec_preset_id?: string
}

export interface ProviderUpdatePayload {
  name?: string
  api_key?: string
  base_url?: string
  model_name?: string
  cli_path?: string
  usage_tags?: LLMUsageTag[]
  default_image_params?: Record<string, unknown>
  video_spec_preset_id?: string
  is_active?: boolean
}

export interface ProjectProviders {
  llm_provider_id?: string
  image_provider_id?: string
  video_provider_id?: string
}

export interface ProviderListResponse {
  providers: Provider[]
}

// API 函数

export async function getProviders(providerType?: ProviderType): Promise<Provider[]> {
  const url = providerType
    ? `${BASE}/providers?provider_type=${providerType}`
    : `${BASE}/providers`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取提供商失败')
  }
  const data: ProviderListResponse = await res.json()
  return data.providers
}

export async function createProvider(payload: ProviderCreatePayload): Promise<Provider> {
  const res = await fetch(`${BASE}/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '创建提供商失败')
  }
  return res.json()
}

export async function updateProvider(providerId: string, payload: ProviderUpdatePayload): Promise<Provider> {
  const res = await fetch(`${BASE}/providers/${providerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新提供商失败')
  }
  return res.json()
}

export async function deleteProvider(providerId: string): Promise<void> {
  const res = await fetch(`${BASE}/providers/${providerId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '删除提供商失败')
  }
}

export async function setDefaultProvider(
  projectId: number,
  providerType: ProviderType,
  providerId: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/providers/project/${projectId}/default?provider_type=${providerType}&provider_id=${providerId}`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '设置默认提供商失败')
  }
}

export async function getProjectDefaults(projectId: number): Promise<ProjectProviders> {
  const res = await fetch(`${BASE}/providers/project/${projectId}/defaults`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取项目默认提供商失败')
  }
  return res.json()
}

// 类型名称映射
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  llm: 'LLM 提供商',
  image: '图片模型提供商',
  video: '视频模型提供商',
}

export const IMPLEMENTATION_TYPE_LABELS: Record<ProviderImplType, string> = {
  jimeng_cli: '即梦 CLI',
  http_api: 'HTTP API',
}

export const USAGE_TAG_LABELS: Record<LLMUsageTag, string> = {
  asset_extract: '资产提取',
  storyboard_plan: '分镜规划',
  prompt_generate: '提示词生成',
}