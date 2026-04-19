/**
 * 剪映草稿导出按钮
 * 检查导出条件，显示导出结果
 */

import { useState } from 'react'
import { exportCapcutDraft } from '../../api/export'

interface ExportButtonProps {
  episodeId: number
  confirmedCount: number
  totalCount: number
}

export default function ExportButton({ episodeId, confirmedCount, totalCount }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ file_path: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isReady = confirmedCount === totalCount

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    setResult(null)

    try {
      const res = await exportCapcutDraft(episodeId)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        disabled={!isReady || exporting}
        className={`px-3 py-1 text-sm rounded ${
          !isReady
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : exporting
            ? 'bg-gray-700 text-gray-500 cursor-wait'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {exporting ? '导出中...' : isReady ? '导出剪映草稿' : `未完成 (${confirmedCount}/${totalCount})`}
      </button>

      {/* 导出结果 */}
      {result && (
        <div className="text-xs text-green-400 text-right max-w-[300px]">
          <div className="font-medium">导出成功！</div>
          <div className="text-gray-500 mt-1">文件路径:</div>
          <div className="text-gray-400">{result.file_path}</div>
          <div className="text-gray-600 mt-1">
            请在剪映中选择「导入草稿」，选择此文件
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="text-xs text-red-500 text-right max-w-[300px]">
          {error}
        </div>
      )}
    </div>
  )
}