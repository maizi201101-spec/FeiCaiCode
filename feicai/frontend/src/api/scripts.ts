const BASE = '/api'

export type ScriptType = 'traditional' | 'storyboard'

export interface ScriptUploadPayload {
  content: string
  script_type: ScriptType
  is_full_series?: boolean
}

export interface ScriptResponse {
  episode_id: number
  episode_number: number
  has_script: boolean
  content: string | null
  script_type: ScriptType | null
  file_path: string | null
}

export interface ScriptSplitPayload {
  content: string
  episode_count: number
}

export interface ScriptSplitResult {
  episode_number: number
  content: string
  start_marker: string | null
}

export interface ScriptSplitResponse {
  splits: ScriptSplitResult[]
  total_episodes: number
}

export async function uploadScript(
  episodeId: number,
  payload: ScriptUploadPayload
): Promise<ScriptResponse> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '上传剧本失败')
  }
  return res.json()
}

export async function getScript(episodeId: number): Promise<ScriptResponse> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/script`)
  if (!res.ok) throw new Error('获取剧本失败')
  return res.json()
}

export async function splitScript(
  episodeId: number,
  payload: ScriptSplitPayload
): Promise<ScriptSplitResponse> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/script/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'AI 分割失败')
  }
  return res.json()
}

