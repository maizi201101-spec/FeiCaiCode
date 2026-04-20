const BASE = '/api'

// 类型定义
export type ShotType = '空境' | '对话' | '行动冲突' | '打斗' | '调度'
export type ShotSize = '大远景' | '远景' | '全景' | '中景' | '中近景' | '近景' | '特写'
export type CameraMove =
  | '固定'
  | '缓慢推进'
  | '快速推进'
  | '缓慢拉开'
  | '快速拉开'
  | '缓慢横移'
  | '缓慢左摇'
  | '缓慢右摇'
  | '跟随'
  | '手持跟随'
  | '缓慢升起'
  | '缓慢下降'
  | '缓慢环绕'
  | '快速环绕'
  | '快速摇摄'

export interface SpeechLine {
  type: string // 'dialogue' | 'os'
  speaker: string
  text: string
}

export interface TimeRange {
  start_sec: number
  end_sec: number
}

export interface CharacterRef {
  name: string
  costume: string
}

export interface AssetRefs {
  characters: CharacterRef[]
  scenes: string[]
  props: string[]
  shot_annotations: string
}

export interface AssetBinding {
  asset_id: string
  variant_id?: string | null
  confidence: number
  needs_review: boolean
}

export interface Shot {
  shot_id: string
  group_id: string
  scene_id: string
  time_range: TimeRange
  duration: number
  shot_type: ShotType
  shot_size: ShotSize
  camera_move: CameraMove
  assets: string[]
  asset_refs?: AssetRefs | null
  asset_bindings: AssetBinding[]
  frame_action: string
  lighting?: string
  screen_text?: string
  speech: SpeechLine[]
  time_of_day?: string
}

export interface ShotGroup {
  group_id: string
  shots: string[]
  total_duration: number
  scene_context: string
}

export interface ShotsCollection {
  episode_id: number
  shots: Shot[]
  groups: ShotGroup[]
}

export interface ShotUpdatePayload {
  shot_type?: ShotType
  shot_size?: ShotSize
  camera_move?: CameraMove
  frame_action?: string
  lighting?: string
  screen_text?: string
  speech?: SpeechLine[]
  assets?: string[]
  asset_refs?: AssetRefs | null
  time_of_day?: string
}

// 时长颜色判断
export function getDurationColor(duration: number): 'green' | 'yellow' | 'red' {
  if (duration <= 15) return 'green'
  if (duration <= 17) return 'yellow'
  return 'red'
}

// API 函数

export async function planShots(episodeId: number): Promise<{ taskId: number; status: string }> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/shots/plan`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || '分镜规划失败')
  }
  const data = await res.json()
  return { taskId: data.task_id, status: data.status }
}

export async function getShots(episodeId: number): Promise<ShotsCollection> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/shots`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取分镜失败')
  }
  return res.json()
}


export async function updateShot(
  episodeId: number,
  shotId: string,
  updates: ShotUpdatePayload
): Promise<Shot> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/shots/${shotId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新镜头失败')
  }
  return res.json()
}

export async function updateShotGroup(
  episodeId: number,
  shotId: string,
  groupId: string
): Promise<Shot> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/shots/${shotId}/group`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '调整归组失败')
  }
  return res.json()
}

export async function getStoryboardMd(episodeId: number): Promise<string> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/shots/storyboard.md`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取分镜表失败')
  }
  return res.text()
}

export async function planAllShots(projectId: number): Promise<{ taskId: number; status: string; message: string }> {
  const res = await fetch(`${BASE}/projects/${projectId}/shots/plan-all`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || '批量规划失败')
  }
  const data = await res.json()
  return { taskId: data.task_id, status: data.status, message: data.message }
}