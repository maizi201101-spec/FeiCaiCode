const BASE = '/api'

export interface SystemSettings {
  projects_root_path: string
  llm_api_key: string
  llm_base_url: string
  llm_model: string
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