/**分集检测 Hook
 * 状态管理：检测结果、检测中状态、原始内容
 */

import { useState, useCallback } from 'react'
import {
  type SplitDetectionResponse,
  detectSplitPoints,
} from '../api/scriptManagement'

export function useSplitDetection(projectId: number) {
  const [detectionResult, setDetectionResult] = useState<SplitDetectionResponse | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawContent, setRawContent] = useState<string>('')

  // 执行分集检测
  const detect = useCallback(async (
    content: string,
    scriptType: 'traditional' | 'storyboard' = 'traditional',
    expectedEpisodes?: number
  ) => {
    setDetecting(true)
    setError(null)
    setRawContent(content)
    try {
      const result = await detectSplitPoints(projectId, {
        content,
        script_type: scriptType,
        expected_episodes: expectedEpisodes,
      })
      setDetectionResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '分集检测失败')
      setDetectionResult(null)
    } finally {
      setDetecting(false)
    }
  }, [projectId])

  // 手动调整分割点
  const adjustSplit = useCallback((index: number, newStart: number, newEnd: number) => {
    if (!detectionResult) return

    const newResults = [...detectionResult.results]
    const oldSplit = newResults[index]

    newResults[index] = {
      ...oldSplit,
      start_position: newStart,
      end_position: newEnd,
      char_count: newEnd - newStart,
      is_abnormal: false,  // 用户手动调整后取消异常标记
      abnormal_reason: undefined,
    }

    // 调整前一个分割点的结束位置
    if (index > 0) {
      newResults[index - 1] = {
        ...newResults[index - 1],
        end_position: newStart,
        char_count: newStart - newResults[index - 1].start_position,
      }
    }

    setDetectionResult({
      ...detectionResult,
      results: newResults,
    })
  }, [detectionResult])

  // 清除检测结果
  const clear = useCallback(() => {
    setDetectionResult(null)
    setError(null)
    setRawContent('')
  }, [])

  return {
    detectionResult,
    detecting,
    error,
    rawContent,
    detect,
    adjustSplit,
    clear,
  }
}