/**
 * 提示词导出按钮组件
 * 导出 CSV 或 Markdown 格式
 */

import { useState } from 'react'

interface ExportPromptsButtonProps {
  episodeId: number
  projectId?: number
  position?: 'toolbar' | 'bottom'
  selectedGroupIds?: string[]  // 当前选定的组ID列表
}

export default function ExportPromptsButton({
  episodeId,
  projectId,
  position = 'toolbar',
  selectedGroupIds = [],
}: ExportPromptsButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ format: string; file_path: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [format, setFormat] = useState<'csv' | 'markdown'>('csv')
  const [scope, setScope] = useState<'episode' | 'groups' | 'all'>('episode')

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    setResult(null)

    try {
      // 根据 scope 决定导出范围
      const exportScope = scope === 'groups' ? 'group' : 'episode'
      const selectedIds = scope === 'groups' ? selectedGroupIds : null

      const endpoint = format === 'csv'
        ? `/api/episodes/${episodeId}/export-prompts/csv`
        : `/api/episodes/${episodeId}/export-prompts/markdown`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: exportScope, selected_ids: selectedIds }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || '导出失败')
      }

      const data = await res.json()
      setResult({ format: data.format, file_path: data.file_path })
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleExportAll = async () => {
    if (!projectId) {
      setError('需要项目ID才能导出全集')
      return
    }

    setExporting(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/episodes/${episodeId}/export-prompts/all-episodes/csv?project_id=${projectId}`, {
        method: 'POST',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || '导出失败')
      }

      const data = await res.json()
      setResult({ format: 'csv', file_path: data.file_path })
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {/* 按钮 */}
      <button
        onClick={() => setShowModal(true)}
        className={`px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 ${
          position === 'bottom' ? 'w-full' : ''
        }`}
      >
        📤 导出提示词
      </button>

      {/* 弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-[400px] max-w-full">
            <h4 className="font-medium text-gray-900 mb-3">导出提示词</h4>

            <div className="space-y-3">
              {/* 格式选择 */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">导出格式</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`px-3 py-1.5 text-sm rounded ${
                      format === 'csv'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setFormat('markdown')}
                    className={`px-3 py-1.5 text-sm rounded ${
                      format === 'markdown'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Markdown
                  </button>
                </div>
              </div>

              {/* 范围选择 */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">导出范围</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScope('episode')}
                    className={`px-3 py-1.5 text-sm rounded ${
                      scope === 'episode'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    当前集
                  </button>
                  {selectedGroupIds.length > 0 && (
                    <button
                      onClick={() => setScope('groups')}
                      className={`px-3 py-1.5 text-sm rounded ${
                        scope === 'groups'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      选定组 ({selectedGroupIds.length})
                    </button>
                  )}
                  {projectId && (
                    <button
                      onClick={() => setScope('all')}
                      className={`px-3 py-1.5 text-sm rounded ${
                        scope === 'all'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      全集
                    </button>
                  )}
                </div>
              </div>

              {/* 说明 */}
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                {format === 'csv' && 'CSV 格式适合导入其他软件或网页端生成工具'}
                {format === 'markdown' && 'Markdown 格式适合人工查看和审核'}
              </div>
            </div>

            {/* 结果显示 */}
            {result && (
              <div className="mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
                ✅ 导出成功！文件路径：<br />
                <code className="text-xs">{result.file_path}</code>
              </div>
            )}

            {/* 错误显示 */}
            {error && (
              <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                ❌ {error}
              </div>
            )}

            {/* 按钮 */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false)
                  setResult(null)
                  setError(null)
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                关闭
              </button>
              <button
                onClick={scope === 'all' ? handleExportAll : handleExport}
                disabled={exporting}
                className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {exporting ? '导出中...' : '导出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}