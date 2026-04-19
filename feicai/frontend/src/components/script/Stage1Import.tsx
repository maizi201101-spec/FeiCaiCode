/**第一阶段：导入全集剧本 + 分集确认
 * 左右布局：左侧剧本全文预览，右侧检测结果
 */

import { useState, useRef } from 'react'
import { type ScriptType, type EpisodeSplitResult } from '../../api/scriptManagement'
import SplitResultPanel from './SplitResultPanel'

interface Stage1ImportProps {
  detectionResult: { results: EpisodeSplitResult[]; avg_confidence: number; avg_char_count: number; has_gaps: boolean; gap_positions: number[] } | null
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

  // 根据检测结果高亮剧本内容
  const renderHighlightedContent = () => {
    if (!detectionResult || !content) return content

    // 按分集位置分段显示
    const segments: { text: string; episode: number; start: number; end: number }[] = []
    let lastEnd = 0

    for (const result of detectionResult.results) {
      // 标记之前的内容（可能是无关内容）
      if (result.start_position > lastEnd) {
        segments.push({
          text: content.slice(lastEnd, result.start_position),
          episode: 0, // 0 表示未分配
          start: lastEnd,
          end: result.start_position
        })
      }
      // 该集内容
      segments.push({
        text: content.slice(result.start_position, result.end_position),
        episode: result.episode_number,
        start: result.start_position,
        end: result.end_position
      })
      lastEnd = result.end_position
    }

    // 最后剩余内容
    if (lastEnd < content.length) {
      segments.push({
        text: content.slice(lastEnd),
        episode: 0,
        start: lastEnd,
        end: content.length
      })
    }

    return segments.map((seg, idx) => (
      <span
        key={idx}
        className={seg.episode > 0 ? '' : 'text-gray-500'}
        title={seg.episode > 0 ? `EP${seg.episode} (${seg.start}-${seg.end})` : '未分配'}
      >
        {seg.episode > 1 && <span className="text-indigo-400 font-medium">【EP{seg.episode}】</span>}
        {seg.text}
      </span>
    ))
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导入控制栏 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 border border-gray-600"
          >
            上传 txt
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
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 border border-gray-600"
          >
            粘贴
          </button>

          {/* 剧本类型 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">类型：</span>
            <button
              onClick={() => setScriptType('traditional')}
              className={`px-2 py-1 rounded text-xs ${
                scriptType === 'traditional'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              传统剧本
            </button>
            <button
              onClick={() => setScriptType('storyboard')}
              className={`px-2 py-1 rounded text-xs ${
                scriptType === 'storyboard'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              分镜脚本
            </button>
          </div>

          {/* 预期集数 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">预期：</span>
            <input
              type="number"
              value={expectedEpisodes ?? ''}
              onChange={(e) => setExpectedEpisodes(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="集数"
              className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300"
            />
          </div>

          {/* 开始分集 */}
          <button
            onClick={handleStartSplit}
            disabled={!content.trim() || detecting}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {detecting ? '分析中...' : '开始分集'}
          </button>

          {/* 字数统计 */}
          {content && (
            <span className="text-xs text-gray-500">{content.length}字</span>
          )}

          {/* 错误提示 */}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>
      </div>

      {/* 主区域：左右布局 */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* 左侧：剧本全文预览 */}
        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm font-medium text-gray-300">
            剧本全文
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100%-40px)] text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {content ? (
              detectionResult ? renderHighlightedContent() : content
            ) : (
              <div className="text-gray-500 text-center py-8">
                请上传或粘贴剧本内容
              </div>
            )}
          </div>
        </div>

        {/* 右侧：检测结果 */}
        {detectionResult && (
          <div className="w-[280px]">
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

        {/* 无检测结果时的提示 */}
        {!detectionResult && !detecting && content && (
          <div className="w-[280px] bg-gray-900 rounded-lg border border-gray-700 p-4">
            <div className="text-gray-400 text-center text-sm">
              点击「开始分集」进行 AI 分集检测
            </div>
          </div>
        )}

        {/* 检测中状态 */}
        {detecting && (
          <div className="w-[280px] bg-gray-900 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
              <span className="ml-2 text-gray-400 text-sm">正在分析...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}