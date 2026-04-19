/**第一阶段：导入全集剧本 + 分集确认
 * 上传/粘贴剧本 + 类型选择 + AI 分集检测
 */

import { useState, useRef } from 'react'
import { type ScriptType } from '../../api/scriptManagement'
import SplitResultPanel from './SplitResultPanel'

interface Stage1ImportProps {
  detectionResult: { results: any[]; avg_confidence: number; avg_char_count: number; has_gaps: boolean; gap_positions: number[] } | null
  detecting: boolean
  error: string | null
  onDetect: (content: string, scriptType: ScriptType, expectedEpisodes?: number) => void
  onConfirm: () => void
}

export default function Stage1Import({
  detectionResult,
  detecting,
  error,
  onDetect,
  onConfirm,
}: Stage1ImportProps) {
  const [content, setContent] = useState('')
  const [scriptType, setScriptType] = useState<ScriptType>('traditional')
  const [expectedEpisodes, setExpectedEpisodes] = useState<number | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContent(text)
    }
    reader.readAsText(file, 'utf-8')
  }

  // 处理粘贴
  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => {
      setContent(text)
    }).catch(() => {
      alert('无法读取剪贴板，请手动粘贴')
    })
  }

  // 开始分集
  const handleStartSplit = () => {
    if (!content.trim()) {
      alert('请先导入或粘贴剧本')
      return
    }
    onDetect(content, scriptType, expectedEpisodes)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 导入区域 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="text-sm font-medium text-gray-300 mb-3">上传/粘贴剧本</div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 border border-gray-600"
          >
            上传 txt 文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={handlePaste}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 border border-gray-600"
          >
            粘贴剧本文本
          </button>
        </div>

        {/* 剧本预览 */}
        <div className="bg-gray-800 rounded border border-gray-600 p-3 mb-4">
          <div className="text-xs text-gray-500 mb-1">
            剧本内容预览（前 1000 字）
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {content ? content.slice(0, 1000) + (content.length > 1000 ? '...' : '') : '请导入或粘贴剧本'}
          </div>
          {content && (
            <div className="text-xs text-gray-500 mt-2">
              共 {content.length} 字
            </div>
          )}
        </div>

        {/* 剧本类型选择 */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-gray-400">剧本类型：</span>
          <div className="flex gap-2">
            <button
              onClick={() => setScriptType('traditional')}
              className={`px-3 py-1.5 rounded text-sm ${
                scriptType === 'traditional'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              传统影视剧本
            </button>
            <button
              onClick={() => setScriptType('storyboard')}
              className={`px-3 py-1.5 rounded text-sm ${
                scriptType === 'storyboard'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              分镜脚本
            </button>
          </div>
        </div>

        {/* 预期集数（可选） */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-400">预期集数（可选）：</span>
          <input
            type="number"
            value={expectedEpisodes ?? ''}
            onChange={(e) => setExpectedEpisodes(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="如 60"
            className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300"
          />
        </div>

        {/* 开始分集按钮 */}
        <button
          onClick={handleStartSplit}
          disabled={!content.trim() || detecting}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {detecting ? '分析中...' : '开始分集'}
        </button>

        {/* 错误提示 */}
        {error && (
          <div className="mt-3 text-sm text-red-400 text-center">{error}</div>
        )}
      </div>

      {/* 分集检测结果 */}
      {detectionResult && (
        <div className="flex-1">
          <SplitResultPanel
            results={detectionResult.results}
            avgConfidence={detectionResult.avg_confidence}
            avgCharCount={detectionResult.avg_char_count}
            hasGaps={detectionResult.has_gaps}
            gapPositions={detectionResult.gap_positions}
            onConfirm={onConfirm}
            detecting={detecting}
          />
        </div>
      )}
    </div>
  )
}