import { useState, useEffect } from 'react'
import { type TaskStatus } from '../../api/assets'

interface TaskIndicatorProps {
  projectId: number
}

export default function TaskIndicator({ projectId }: TaskIndicatorProps) {
  const [tasks, setTasks] = useState<TaskStatus[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  // 获取进行中任务
  const fetchActiveTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks?limit=20`)
      if (res.ok) {
        const data = await res.json()
        const list: TaskStatus[] = data.tasks ?? data
        setTasks(list)
      }
    } catch (e) {
      console.error('获取任务失败:', e)
    }
    setLoading(false)
  }

  // 定期刷新
  useEffect(() => {
    fetchActiveTasks()
    const interval = setInterval(fetchActiveTasks, 10000) // 10秒刷新
    return () => clearInterval(interval)
  }, [projectId])

  const activeCount = tasks.filter(t => t.status === 'pending' || t.status === 'processing').length

  return (
    <div className="relative">
      {/* 指示器按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800"
      >
        <span className="text-sm text-gray-400">任务</span>
        {activeCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">
            {activeCount}
          </span>
        )}
      </button>

      {/* 任务列表浮层 */}
      {expanded && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
          <div className="p-2 border-b border-gray-700 font-medium text-sm text-gray-300">进行中任务 ({activeCount})</div>
          <div className="max-h-64 overflow-auto">
            {tasks.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">无进行中任务</div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-2 border-b border-gray-800 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">{task.type}</span>
                    <span className={`text-xs px-1 rounded ${
                      task.status === 'processing' ? 'bg-blue-900/50 text-blue-400' : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {task.status === 'processing' ? '执行中' : '等待中'}
                    </span>
                  </div>
                  {task.episode_id && (
                    <div className="text-xs text-gray-400 mt-1">EP{task.episode_id}</div>
                  )}
                  {task.error && (
                    <div className="text-xs text-red-500 mt-1 truncate">{task.error}</div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-gray-700">
            <button
              onClick={() => fetchActiveTasks()}
              disabled={loading}
              className="w-full text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}