/**剧本管理 API 封装
 * 全集剧本导入、AI 分集检测、分集确认、梗概生成
 */

const BASE = '/api'

export type ScriptType = 'traditional' | 'storyboard'
export type DetectionLayer = 'explicit_marker' | 'scene_title' | 'blank_line' | 'content_structure'

// 类型定义
export interface EpisodeSplitResult {
  episode_number: number
  start_position: number
  end_position: number
  char_count: number
  confidence: number
  detection_layer: DetectionLayer
  is_abnormal: boolean
  abnormal_reason?: string
  content_preview: string
}

export interface FullScriptUploadPayload {
  content: string
  script_type: ScriptType
  expected_episodes?: number
}

export interface SplitDetectionResponse {
  results: EpisodeSplitResult[]
  total_episodes: number
  total_chars: number
  avg_confidence: number
  avg_char_count: number
  has_gaps: boolean
  gap_positions: number[]
}

export interface ConfirmSplitPayload {
  splits: EpisodeSplitResult[]
  generate_summaries: boolean
}

export interface ConfirmSplitResponse {
  success: boolean
  created_episodes: number
  summaries_generated: number
  message: string
}

export interface EpisodeStatus {
  episode_id?: number
  episode_number: number
  has_script: boolean
  has_summary: boolean
  status: 'imported' | 'summary_generated' | 'pending'
}

export interface FullSeriesStatusResponse {
  episodes: EpisodeStatus[]
  can_re_split: boolean
  reason?: string
}

export interface EpisodeDetailResponse {
  episode_id: number
  episode_number: number
  script_content?: string
  summary?: string
  has_script: boolean
  has_summary: boolean
}

export interface RegenerateSummaryResponse {
  episode_id: number
  episode_number: number
  summary: string
  message: string
}

// API 函数

/**上传全集剧本 */
export async function uploadFullScript(
  projectId: number,
  payload: FullScriptUploadPayload
): Promise<{ success: boolean; file_path: string; total_chars: number; script_type: string }> {
  const res = await fetch(`${BASE}/projects/${projectId}/full-script`, {
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

/**AI 分集检测 */
export async function detectSplitPoints(
  projectId: number,
  payload: FullScriptUploadPayload
): Promise<SplitDetectionResponse> {
  const res = await fetch(`${BASE}/projects/${projectId}/split-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '分集检测失败')
  }
  return res.json()
}

/**确认分集 */
export async function confirmSplit(
  projectId: number,
  payload: ConfirmSplitPayload
): Promise<ConfirmSplitResponse> {
  const res = await fetch(`${BASE}/projects/${projectId}/confirm-split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '确认分集失败')
  }
  return res.json()
}

/**获取全集状态 */
export async function getScriptStatus(projectId: number): Promise<FullSeriesStatusResponse> {
  const res = await fetch(`${BASE}/projects/${projectId}/script-status`)
  if (!res.ok) throw new Error('获取状态失败')
  return res.json()
}

/**获取单集详情 */
export async function getEpisodeScriptDetail(episodeId: number): Promise<EpisodeDetailResponse> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/script-detail`)
  if (!res.ok) throw new Error('获取剧本详情失败')
  return res.json()
}

/**重新生成梗概 */
export async function regenerateSummary(episodeId: number): Promise<RegenerateSummaryResponse> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/regenerate-summary`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '生成梗概失败')
  }
  return res.json()
}

/**检查是否可重新分集 */
export async function checkCanReSplit(projectId: number): Promise<{ can_re_split: boolean; reason?: string }> {
  const res = await fetch(`${BASE}/projects/${projectId}/can-re-split`)
  if (!res.ok) throw new Error('检查失败')
  return res.json()
}