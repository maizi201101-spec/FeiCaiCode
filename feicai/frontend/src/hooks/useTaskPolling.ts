import { useState, useEffect, useCallback, useRef } from 'react'
import { getTaskStatus, type TaskStatus } from '../api/assets'

interface PollingOptions {
  interval?: number // 轮询间隔（毫秒），默认 2000
  maxAttempts?: number // 最大尝试次数，默认 60（2 分钟）
  onComplete?: (result: TaskStatus) => void // 完成回调
  onFailed?: (error: string) => void // 失败回调
  onProgress?: (status: TaskStatus) => void // 进度回调
}

export function useTaskPolling() {
  const [polling, setPolling] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const pollingRef = useRef(false)
  const attemptsRef = useRef(0)

  const startPolling = useCallback(
    async (taskId: number, options: PollingOptions = {}) => {
      const {
        interval = 2000,
        maxAttempts = 60,
        onComplete,
        onFailed,
        onProgress,
      } = options

      setCurrentTaskId(taskId)
      setPolling(true)
      pollingRef.current = true
      attemptsRef.current = 0

      const poll = async (): Promise<boolean> => {
        if (!pollingRef.current) return false

        attemptsRef.current += 1

        if (attemptsRef.current > maxAttempts) {
          setPolling(false)
          pollingRef.current = false
          onFailed?.('轮询超时')
          return false
        }

        try {
          const status = await getTaskStatus(taskId)
          setTaskStatus(status)
          onProgress?.(status)

          if (status.status === 'completed') {
            setPolling(false)
            pollingRef.current = false
            onComplete?.(status)
            return false
          }

          if (status.status === 'failed') {
            setPolling(false)
            pollingRef.current = false
            onFailed?.(status.error || '任务失败')
            return false
          }

          // 继续轮询
          await new Promise((resolve) => setTimeout(resolve, interval))
          return poll()
        } catch (e) {
          // 网络错误，继续尝试
          await new Promise((resolve) => setTimeout(resolve, interval))
          return poll()
        }
      }

      await poll()
      return true
    },
    []
  )

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    setPolling(false)
    setCurrentTaskId(null)
    setTaskStatus(null)
  }, [])

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      pollingRef.current = false
    }
  }, [])

  return {
    polling,
    currentTaskId,
    taskStatus,
    startPolling,
    stopPolling,
  }
}

// 简单的单次轮询函数（不使用 hook）
export async function pollTaskStatus(
  taskId: number,
  options: PollingOptions = {}
): Promise<TaskStatus> {
  const {
    interval = 2000,
    maxAttempts = 60,
    onComplete,
    onFailed,
    onProgress,
  } = options

  let attempts = 0

  while (attempts < maxAttempts) {
    attempts += 1

    const status = await getTaskStatus(taskId)
    onProgress?.(status)

    if (status.status === 'completed') {
      onComplete?.(status)
      return status
    }

    if (status.status === 'failed') {
      onFailed?.(status.error || '任务失败')
      throw new Error(status.error || '任务失败')
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error('轮询超时')
}