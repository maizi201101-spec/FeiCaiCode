const BASE = '/api'

export interface VideoVersion {
  id: number
  shot_id: string
  episode_id: number
  group_id: string
  version_number: number
  status: string
  video_prompt: string
  final_prompt?: string
  reference_images: string[]
  anchor_declaration?: string
  model: string
  duration: number
  resolution: string
  video_path?: string
  submit_id?: string
  qc_status: string
  selected: boolean
  error_message?: string
  created_at: string
  updated_at: string
}

export interface VideoVersionSummary {
  id: number
  shot_id: string
  group_id: string
  version_number: number
  status: string
  video_path?: string
  qc_status: string
  selected: boolean
  created_at: string
}

export interface VideoGenerationRequest {
  shot_id: string
  video_prompt: string
  reference_images?: string[]
  anchor_declaration?: string
  model?: string
  duration?: number
  resolution?: string
}

export interface BatchGenerationRequest {
  group_id?: string
  all_groups?: boolean
}

// 提交单镜头视频生成
export async function generateVideo(episodeId: number, request: VideoGenerationRequest): Promise<{ version_id: number; status: string }> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/videos/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '提交视频生成失败')
  }
  return res.json()
}

// 批量生成
export async function generateVideoBatch(episodeId: number, request: BatchGenerationRequest): Promise<{ version_ids: number[]; count: number; status: string }> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/videos/generate-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '批量生成失败')
  }
  return res.json()
}

// 获取全集视频列表
export async function getEpisodeVideos(episodeId: number): Promise<VideoVersionSummary[]> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/videos`)
  if (!res.ok) throw new Error('获取视频列表失败')
  return res.json()
}

// 获取镜头视频版本列表
export async function getVideoVersions(episodeId: number, shotId: string): Promise<VideoVersion[]> {
  const res = await fetch(`${BASE}/episodes/${episodeId}/videos/${shotId}`)
  if (!res.ok) throw new Error('获取视频版本失败')
  return res.json()
}

// 更新质检状态
export async function updateVideoStatus(versionId: number, qcStatus: string): Promise<void> {
  const res = await fetch(`${BASE}/episodes/videos/${versionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qc_status: qcStatus }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '更新状态失败')
  }
}

// 选定版本
export async function selectVideoVersion(versionId: number): Promise<void> {
  const res = await fetch(`${BASE}/episodes/videos/${versionId}/select`, {
    method: 'PUT',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '选定版本失败')
  }
}