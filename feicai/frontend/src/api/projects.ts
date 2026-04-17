const BASE = '/api'

export interface Project {
  id: number
  name: string
  path: string
  created_at: string
  updated_at: string
  episode_count?: number
}

export interface Episode {
  id: number
  project_id: number
  number: number
  title: string | null
  created_at: string
  updated_at: string
}

export interface CreateProjectPayload {
  name: string
  path: string
}

export interface CreateEpisodePayload {
  number: number
  title?: string
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`)
  if (!res.ok) throw new Error('获取项目列表失败')
  return res.json()
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '创建项目失败')
  }
  return res.json()
}

export async function getProject(id: number): Promise<Project> {
  const res = await fetch(`${BASE}/projects/${id}`)
  if (!res.ok) throw new Error('获取项目详情失败')
  return res.json()
}

export async function getEpisodes(projectId: number): Promise<Episode[]> {
  const res = await fetch(`${BASE}/projects/${projectId}/episodes`)
  if (!res.ok) throw new Error('获取集数列表失败')
  return res.json()
}

export async function createEpisode(
  projectId: number,
  payload: CreateEpisodePayload
): Promise<Episode> {
  const res = await fetch(`${BASE}/projects/${projectId}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '创建集数失败')
  }
  return res.json()
}

export async function deleteEpisode(projectId: number, episodeId: number): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/episodes/${episodeId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('删除集数失败')
}
