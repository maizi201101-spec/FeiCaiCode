import { useState, useEffect } from 'react'
import { getScript, type ScriptResponse } from '../../api/scripts'
import ImportScriptModal from '../modals/ImportScriptModal'

interface ScriptPanelProps {
  projectId: number
  episodeId: number | null
  episodeNumber: number | null
}

export default function ScriptPanel({ projectId, episodeId, episodeNumber }: ScriptPanelProps) {
  const [script, setScript] = useState<ScriptResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const fetchScript = async () => {
    if (!episodeId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getScript(episodeId)
      setScript(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取剧本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScript()
  }, [episodeId])

  if (!episodeId || !episodeNumber) {
    return (
      <div className="p-6 text-center text-gray-500">
        请先选择集数
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">
            EP{episodeNumber.toString().padStart(2, '0')} 剧本
          </span>
          {script?.has_script && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {script.script_type === 'traditional' ? '传统剧本' : '分镜脚本'}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
        >
          {script?.has_script ? '重新导入' : '导入剧本'}
        </button>
      </div>

      {/* 剧本内容 */}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!script?.has_script ? (
        <div className="text-center py-12 text-gray-600">
          <p className="mb-2">暂无剧本</p>
          <p className="text-sm">点击上方「导入剧本」添加</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-[60vh]">
            {script.content}
          </pre>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <ImportScriptModal
          projectId={projectId}
          episodeId={episodeId}
          onImported={fetchScript}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}