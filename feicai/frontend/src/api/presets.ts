/**
 * 预设库 API
 * 预设 CRUD + 激活状态管理
 */

const BASE = '/api'

// 类型定义
export type PresetCategory =
  | 'storyboard_style'
  | 'video_prompt_style'
  | 'image_prompt_style'
  | 'special_effect'
  | 'asset_extraction'
  | 'video_model_spec'

export interface ModelSpec {
  max_group_duration: number
  max_ref_images: number
  default_params: Record<string, unknown>
}

export interface Preset {
  preset_id: string
  name: string
  category: PresetCategory
  description: string
  content: string
  model_spec?: ModelSpec
  is_active: boolean
  is_builtin: boolean
  created_at?: string
  updated_at?: string
}

export interface PresetCreatePayload {
  name: string
  category: PresetCategory
  description?: string
  content: string
  model_spec?: ModelSpec
}

export interface PresetUpdatePayload {
  name?: string
  description?: string
  content?: string
  model_spec?: ModelSpec
  is_active?: boolean
}

export interface ActivePresets {
  storyboard_style?: string
  video_prompt_style?: string
  image_prompt_style?: string
  special_effects: string[]
  asset_extraction?: string
  video_model_spec?: string
}

export interface PresetListResponse {
  presets: Preset[]
}

// API 函数

export async function getPresets(category?: PresetCategory): Promise<Preset[]> {
  const url = category
    ? `${BASE}/presets?category=${category}`
    : `${BASE}/presets`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取预设失败')
  }
  const data: PresetListResponse = await res.json()
  return data.presets
}

export async function createPreset(payload: PresetCreatePayload): Promise<Preset> {
  const res = await fetch(`${BASE}/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '创建预设失败')
  }
  return res.json()
}

export async function updatePreset(presetId: string, payload: PresetUpdatePayload): Promise<Preset> {
  const res = await fetch(`${BASE}/presets/${presetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新预设失败')
  }
  return res.json()
}

export async function deletePreset(presetId: string): Promise<void> {
  const res = await fetch(`${BASE}/presets/${presetId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '删除预设失败')
  }
}

export async function activatePreset(
  presetId: string,
  projectId: number,
  category: PresetCategory
): Promise<void> {
  const res = await fetch(`${BASE}/presets/${presetId}/activate?project_id=${projectId}&category=${category}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '激活预设失败')
  }
}

export async function deactivatePreset(presetId: string, projectId: number): Promise<void> {
  const res = await fetch(`${BASE}/presets/${presetId}/deactivate?project_id=${projectId}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '取消激活失败')
  }
}

export async function getActivePresets(projectId: number): Promise<ActivePresets> {
  const res = await fetch(`${BASE}/presets/active/${projectId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取激活预设失败')
  }
  return res.json()
}

export async function getActivePresetContent(
  projectId: number,
  category: PresetCategory
): Promise<string> {
  const res = await fetch(`${BASE}/presets/content/${projectId}/${category}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取预设内容失败')
  }
  const data = await res.json()
  return data.content
}

export async function getActiveEffects(projectId: number): Promise<string[]> {
  const res = await fetch(`${BASE}/presets/effects/${projectId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取特殊效果失败')
  }
  const data = await res.json()
  return data.effects
}

// 分类名称映射
export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  storyboard_style: '分镜规划风格',
  video_prompt_style: '视频提示词风格',
  image_prompt_style: '图片提示词风格',
  special_effect: '特殊效果预设',
  asset_extraction: '资产提取规则',
  video_model_spec: '视频模型规格',
}