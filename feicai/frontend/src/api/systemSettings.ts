const BASE = '/api'

export interface SystemSettings {
  projects_root_path: string
  llm_api_key: string
  llm_base_url: string
  llm_model: string
}

export interface ProjectZone {
  path: string
  name: string
}

export interface ProjectZonesResponse {
  zones: ProjectZone[]
  active_zone: string
}

/**获取系统设置 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await fetch(`${BASE}/system/settings`)
  if (!res.ok) throw new Error('获取系统设置失败')
  return res.json()
}

/**更新系统设置 */
export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
  const res = await fetch(`${BASE}/system/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('保存系统设置失败')
}

/**获取项目区列表 */
export async function getProjectZones(): Promise<ProjectZonesResponse> {
  const res = await fetch(`${BASE}/system/zones`)
  if (!res.ok) throw new Error('获取项目区失败')
  return res.json()
}

/**添加项目区 */
export async function addProjectZone(path: string, name?: string): Promise<ProjectZonesResponse> {
  const res = await fetch(`${BASE}/system/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '添加项目区失败')
  }
  return res.json()
}

/**移除项目区 */
export async function removeProjectZone(path: string): Promise<ProjectZonesResponse> {
  const res = await fetch(`${BASE}/system/zones`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('移除项目区失败')
  return res.json()
}

/**设置激活项目区 */
export async function setActiveZone(path: string): Promise<void> {
  const res = await fetch(`${BASE}/system/active-zone`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '切换项目区失败')
  }
}
