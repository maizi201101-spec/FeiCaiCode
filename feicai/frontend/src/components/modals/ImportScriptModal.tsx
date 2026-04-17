import { useState, useRef, useEffect } from 'react'
import { uploadScript, splitScript, type ScriptType, type ScriptSplitResult } from '../../api/scripts'
import { useEpisodes } from '../../hooks/useProjects'

interface ImportScriptModalProps {
  projectId: number
  episodeId: number | null
  onImported: () => void
  onClose: () => void
}

export default function ImportScriptModal({
  projectId,
  episodeId,
  onImported,
  onClose,
}: ImportScriptModalProps) {
  const [mode, setMode] = useState<'upload' | 'paste'>('paste')
  const [content, setContent] = useState('')
  const [scriptType, setScriptType] = useState<ScriptType>('traditional')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [splitResults, setSplitResults] = useState<ScriptSplitResult[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取项目集数列表
  const { episodes, refetch } = useEpisodes(projectId)

  useEffect(() => {
    refetch()
  }, [projectId])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContent(ev.target?.result as string || '')
    }
    reader.readAsText(file, 'utf-8')
  }

  // 单集导入
  const handleImport = async () => {
    if (!content.trim()) {
      setError('请输入或上传剧本内容')
      return
    }
    if (!episodeId) {
      setError('请先选择集数')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await uploadScript(episodeId, {
        content: content.trim(),
        script_type: scriptType,
      })
      onImported()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  // AI 分割
  const handleSplit = async () => {
    if (!content.trim()) {
      setError('请先输入全集剧本内容')
      return
    }
    setLoading(true)
    setError(null)
    setSplitResults(null)
    try {
      // 从已有集数推断预期集数
      const estimatedCount = episodes.length > 0 ? episodes.length : 10
      const result = await splitScript(episodeId ?? 0, {
        content: content.trim(),
        episode_count: estimatedCount,
      })
      setSplitResults(result.splits)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 分割失败')
    } finally {
      setLoading(false)
    }
  }

  // 检查分割结果与集数匹配情况
  const getMatchStatus = (epNumber: number): { episodeId: number | null; exists: boolean } => {
    const matched = episodes.find((ep) => ep.number === epNumber)
    return {
      episodeId: matched?.id ?? null,
      exists: !!matched,
    }
  }

  // 批量保存分割结果
  const handleSaveSplitResults = async () => {
    if (!splitResults || splitResults.length === 0) return

    setSaving(true)
    setError(null)

    const results: { ep: number; status: 'success' | 'skipped' | 'error'; message?: string }[] = []

    for (const split of splitResults) {
      const match = getMatchStatus(split.episode_number)

      if (!match.exists) {
        results.push({
          ep: split.episode_number,
          status: 'skipped',
          message: '该集数不存在，请先创建',
        })
        continue
      }

      if (!match.episodeId) {
        results.push({
          ep: split.episode_number,
          status: 'error',
          message: '无法匹配集数 ID',
        })
        continue
      }

      try {
        await uploadScript(match.episodeId, {
          content: split.content,
          script_type: scriptType,
        })
        results.push({ ep: split.episode_number, status: 'success' })
      } catch (e) {
        results.push({
          ep: split.episode_number,
          status: 'error',
          message: e instanceof Error ? e.message : '保存失败',
        })
      }
    }

    setSaving(false)

    const successCount = results.filter((r) => r.status === 'success').length
    const skippedCount = results.filter((r) => r.status === 'skipped').length
    const errorCount = results.filter((r) => r.status === 'error').length

    if (errorCount > 0) {
      setError(`${errorCount} 集保存失败，请检查错误信息`)
    }

    if (successCount === splitResults.length) {
      // 全部成功
      onImported()
      onClose()
    } else if (skippedCount > 0) {
      // 有缺失集数
      const missingEps = results
        .filter((r) => r.status === 'skipped')
        .map((r) => `EP${r.ep}`)
        .join(', ')
      setError(`保存完成 ${successCount}/${splitResults.length} 集。缺失集数：${missingEps}，请先在左侧创建这些集数。`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">导入剧本</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">×</button>
        </div>

        {/* 输入模式切换 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('paste')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              mode === 'paste' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            粘贴文本
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              mode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            上传文件
          </button>
        </div>

        {/* 剧本类型选择 */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">剧本类型</label>
          <select
            value={scriptType}
            onChange={(e) => setScriptType(e.target.value as ScriptType)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
          >
            <option value="traditional">传统影视剧本</option>
            <option value="storyboard">分镜脚本</option>
          </select>
        </div>

        {/* 内容输入 */}
        {mode === 'paste' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="粘贴剧本内容..."
            className="w-full h-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 resize-none"
          />
        ) : (
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-gray-700 rounded-lg px-4 py-8 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
            >
              {content ? '已加载文件内容' : '点击上传 .txt 文件'}
            </button>
            {content && mode === 'upload' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-48 mt-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none"
              />
            )}
          </div>
        )}

        {/* AI 分割结果 */}
        {splitResults && (
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">
              AI 分割结果（共 {splitResults.length} 集，项目已有 {episodes.length} 集）
            </p>
            <div className="space-y-1 max-h-40 overflow-auto">
              {splitResults.map((s) => {
                const match = getMatchStatus(s.episode_number)
                return (
                  <div key={s.episode_number} className="flex items-center gap-2 text-xs">
                    <span className={match.exists ? 'text-green-400' : 'text-red-400'}>
                      EP{s.episode_number.toString().padStart(2, '0')}
                    </span>
                    <span className={match.exists ? 'text-gray-500' : 'text-red-300'}>
                      {match.exists ? '✓ 已有' : '✗ 需新建'}
                    </span>
                    <span className="text-gray-600 truncate">
                      {s.content.slice(0, 60)}...
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 分割结果操作按钮 */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveSplitResults}
                disabled={saving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                {saving ? '保存中...' : '确认保存分割结果'}
              </button>
              <button
                onClick={() => setSplitResults(null)}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
              >
                清除
              </button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={handleSplit}
            disabled={!content.trim() || loading}
            className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? '处理中...' : 'AI 智能分割'}
          </button>
          {!splitResults && (
            <button
              onClick={handleImport}
              disabled={!content.trim() || loading || !episodeId}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? '导入中...' : '导入到当前集'}
            </button>
          )}
        </div>

        {/* 提示 */}
        {splitResults && (
          <p className="text-xs text-gray-500 mt-3">
            提示：分割结果按集数匹配已有集，缺失集数需先在左侧「集数列表」中创建。
          </p>
        )}
      </div>
    </div>
  )
}