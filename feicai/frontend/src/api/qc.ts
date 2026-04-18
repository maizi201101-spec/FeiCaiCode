/**
 * 质检 API
 * 组级别质检数据查询、状态更新、版本选定
 */

import { type VideoVersionSummary } from './videos'

export interface GroupQCData {
  group_id: string
  total_duration: number
  status: 'pending' | 'approved' | 'revision'
  selected_version_id?: number
  revision_note?: string
  videos: VideoVersionSummary[]
}

const API_BASE = '/api/episodes'

/**
 * 获取全集组质检数据
 */
export async function getEpisodeQCData(episodeId: number): Promise<GroupQCData[]> {
  const res = await fetch(`${API_BASE}/${episodeId}/qc/groups`)
  if (!res.ok) throw new Error('获取质检数据失败')
  return res.json()
}

/**
 * 获取单个组质检详情
 */
export async function getGroupQCDetail(episodeId: number, groupId: string): Promise<GroupQCData> {
  const res = await fetch(`${API_BASE}/${episodeId}/qc/groups/${groupId}`)
  if (!res.ok) throw new Error('获取组质检详情失败')
  return res.json()
}

/**
 * 更新组质检状态
 */
export async function updateGroupStatus(
  episodeId: number,
  groupId: string,
  status: 'pending' | 'approved' | 'revision',
  revisionNote?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/${episodeId}/qc/groups/${groupId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, revision_note: revisionNote }),
  })
  if (!res.ok) throw new Error('更新组状态失败')
}

/**
 * 选定组版本
 */
export async function selectGroupVersion(
  episodeId: number,
  groupId: string,
  versionId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/${episodeId}/qc/groups/${groupId}/select-version?version_id=${versionId}`, {
    method: 'PUT',
  })
  if (!res.ok) throw new Error('选定版本失败')
}

/**
 * 获取返修镜头 ID 列表
 */
export async function getRevisionShotIds(episodeId: number): Promise<string[]> {
  const res = await fetch(`${API_BASE}/${episodeId}/qc/revision-shots`)
  if (!res.ok) throw new Error('获取返修镜头失败')
  return res.json()
}