/**
 * 底部折叠时间线
 * 显示各组时长色块，按状态着色
 */

import { useState } from 'react'
import { type GroupQCData } from '../../api/qc'

interface TimelineBarProps {
  groups: GroupQCData[]
  onScrollToGroup: (groupId: string) => void
}

export default function TimelineBar({ groups, onScrollToGroup }: TimelineBarProps) {
  const [expanded, setExpanded] = useState(false)

  if (groups.length === 0) return null

  // 计算总时长
  const totalDuration = groups.reduce((sum, g) => sum + g.total_duration, 0)

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-400'
      case 'revision': return 'bg-red-400'
      default: return 'bg-orange-400'
    }
  }

  return (
    <div className="border-t bg-gray-50">
      {/* 折叠控制 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-100"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>时间线预览</span>
        <span className="text-gray-400 ml-auto">总时长: {totalDuration.toFixed(1)}s</span>
      </button>

      {/* 时间线内容 */}
      {expanded && (
        <div className="px-4 py-2 overflow-x-auto flex gap-1">
          {groups.map(g => {
            // 计算宽度比例（最小 20px）
            const widthPercent = (g.total_duration / totalDuration) * 100
            const minWidth = Math.max(widthPercent, 5)

            return (
              <button
                key={g.group_id}
                onClick={() => onScrollToGroup(g.group_id)}
                className={`relative h-8 rounded flex items-center justify-center text-xs text-white cursor-pointer hover:opacity-80 ${getStatusColor(g.status)}`}
                style={{ minWidth: `${minWidth}%`, width: `${minWidth}%` }}
              >
                <span className="truncate px-1">{g.group_id}</span>
                <span className="absolute bottom-0.5 text-xs opacity-80">{g.total_duration}s</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}