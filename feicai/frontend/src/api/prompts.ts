const BASE = '/api'

// 类型定义
export interface Prompt {
  shot_id: string
  group_id: string
  image_prompt: string
  video_prompt: string
  edited: boolean
  confirmed: boolean
}

export interface PromptsCollection {
  episode_id: number
  prompts: Prompt[]
  generated_at?: string
}

export interface PromptUpdatePayload {
  image_prompt?: string
  video_prompt?: string
  confirmed?: boolean
}

export interface GlobalSettings {
  global_prompt: string
  default_model: string
  default_duration: number
  default_resolution: string
  default_ratio: string
}

export interface SpecialPrompt {
  id: string
  content: string
  scope: 'shot' | 'group' | 'episode' | 'selected'
  target_ids: string[]
}

// API 函数

export async function generatePrompts(episodeId: number): Promise<{ taskId: number; status: string }> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/prompts/generate`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '生成提示词失败')
  }
  return res.json()
}

export async function getPrompts(episodeId: number): Promise<PromptsCollection> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/prompts`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取提示词失败')
  }
  return res.json()
}

export async function updatePrompts(episodeId: number, collection: PromptsCollection): Promise<PromptsCollection> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/prompts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collection),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新提示词失败')
  }
  return res.json()
}

export async function updatePrompt(
  episodeId: number,
  shotId: string,
  updates: PromptUpdatePayload
): Promise<Prompt> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/prompts/${shotId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新提示词失败')
  }
  return res.json()
}

export async function confirmPrompt(episodeId: number, shotId: string): Promise<Prompt> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/prompts/${shotId}/confirm`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '确认失败')
  }
  return res.json()
}

// 全局设置
export async function getGlobalSettings(projectId: number): Promise<GlobalSettings> {
  const res = await fetch(`${BASE}/projects/${projectId}/settings`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取设置失败')
  }
  return res.json()
}

export async function updateGlobalSettings(projectId: number, settings: GlobalSettings): Promise<GlobalSettings> {
  const res = await fetch(`${BASE}/projects/${projectId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新设置失败')
  }
  return res.json()
}

// 提示词拼接
export function buildFinalVideoPrompt(
  videoPrompt: string,
  specialPrompts: SpecialPrompt[],
  globalPrompt: string
): string {
  const parts = [videoPrompt]

  for (const sp of specialPrompts) {
    parts.push(`\n[特殊效果] ${sp.content}`)
  }

  if (globalPrompt) {
    parts.push(`\n[全局设定] ${globalPrompt}`)
  }

  return parts.join('\n')
}