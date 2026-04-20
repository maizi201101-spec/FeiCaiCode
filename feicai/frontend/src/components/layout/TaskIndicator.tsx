import { useState, useEffect, useCallback } from 'react'
import { type TaskStatus } from '../../api/assets'

interface TaskIndicatorProps {
  projectId: number
}

const TASK_TYPE_LABELS: Record<string, string> = {
  plan_shots: '分镜规划',
  plan_all_shots: '批量分镜规划',
  generate_prompts: '提示词生成',
  extract_assets: '资产提取',
  generate_image: '图片生成',
  generate_video: '视频生成',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:    { label: '等待中', cls: 'bg-yellow-900/50 text-yellow-400' },
  processing: { label: '执行中', cls: 'bg-blue-900/50 text-blue-400' },
  completed:  { label: '完成',   cls: 'bg-green-900/50 text-green-400' },
  failed:     { label: '失败',   cls: 'bg-red-900/50 text-red-400' },
  cancelled:  { label: '已取消', cls: 'bg-gray-700/50 text-gray-400' },
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const start = new Date(createdAt).getTime()
  const end = new Date(updatedAt).getTime()
  const secs = Math.max(0, Math.round((end - start) / 1000))
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m${secs % 60}s`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

export default function TaskIndicator({ projectId }: TaskIndicatorProps) {
  const [tasks, setTasks] = useState<TaskStatus[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks?limit=30`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? data)
      }
    } catch (e) {
      console.error('获取任务失败:', e)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  const handleCancel = async (taskId: number) => {
    setCancelling(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { detail?: string }).detail || '取消失败')
      } else {
        await fetchTasks()
      }
    } catch {
      alert('取消请求失败')
    }
    setCancelling(null)
  }

  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing')
  const historyTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
  const displayTasks = showHistory ? tasks : activeTasks

  return (
    <div className="relative">
      {/* 指示器按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800"
      >
        <span className="text-sm text-gray-400">任务</span>
        {activeTasks.length > 0 && (
          <span className="bg-red-500 text-white text-xs px-1.5 rounded-full animate-pulse">
            {activeTasks.length}
          </span>
        )}
      </button>

      {/* 任务列表浮层 */}
      {expanded && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-gray-900 border border-gray-700 rounded shadow-xl z-50">
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <span className="font-medium text-sm text-gray-200">
              任务监控
              {activeTasks.length > 0 && (
                <span className="ml-2 text-blue-400">{activeTasks.length} 个进行中</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`text-xs px-2 py-0.5 rounded ${showHistory ? 'bg-gray-600 text-gray-200' : 'text-gray-400 hover:text-gray-200'}`}
              >
                历史
              </button>
              <button
                onClick={fetchTasks}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
              >
                {loading ? '刷新中' : '刷新'}
              </button>
            </div>
          </div>

          {/* 任务列表 */}
          <div className="max-h-96 overflow-auto divide-y divide-gray-800">
            {displayTasks.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">
                {showHistory ? '无任务记录' : '无进行中任务'}
              </div>
            ) : (
              displayTasks.map((task) => {
                const isActive = task.status === 'pending' || task.status === 'processing'
                const statusCfg = STATUS_CONFIG[task.status] ?? { label: task.status, cls: 'bg-gray-700 text-gray-300' }
                const typeLabel = TASK_TYPE_LABELS[task.type] ?? task.type
                const elapsed = formatDuration(task.created_at, task.updated_at)

                return (
                  <div
                    key={task.id}
                    className={`p-3 ${isActive ? '' : 'opacity-60'}`}
                  >
                    {/* 第一行：类型 + 状态 + 取消 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">{typeLabel}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                        {isActive && (
                          <button
                            onClick={() => handleCancel(task.id)}
                            disabled={cancelling === task.id}
                            className="text-xs px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded hover:bg-red-900/70 disabled:opacity-50"
                          >
                            {cancelling === task.id ? '…' : '取消'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 第二行：集数 + 时间 + 耗时 */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {task.episode_id && <span>EP{task.episode_id}</span>}
                      <span>#{task.id}</span>
                      <span>{formatTime(task.created_at)}</span>
                      {!isActive && <span>耗时 {elapsed}</span>}
                    </div>

                    {/* 结果 */}
                    {task.result && (
                      <div className="mt-1 text-xs text-green-400 truncate" title={task.result}>
                        {task.result}
                      </div>
                    )}

                    {/* 错误 */}
                    {task.error && (
                      <div className="mt-1 text-xs text-red-400 truncate" title={task.error}>
                        {task.error}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
