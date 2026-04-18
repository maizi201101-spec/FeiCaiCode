/**
 * 剪映草稿导出 API
 */

export interface ExportResult {
  file_path: string
  status: string
  message?: string
}

export interface ExportStatus {
  ready: boolean
  missing_groups: string[]
}

/**
 * 导出剪映草稿
 */
export async function exportCapcutDraft(episodeId: number): Promise<ExportResult> {
  const res = await fetch(`/api/episodes/${episodeId}/export/capcut`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '导出失败')
  }
  return res.json()
}

/**
 * 检查导出条件
 */
export async function checkExportStatus(episodeId: number): Promise<ExportStatus> {
  const res = await fetch(`/api/episodes/${episodeId}/export/status`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '获取导出状态失败')
  }
  return res.json()
}