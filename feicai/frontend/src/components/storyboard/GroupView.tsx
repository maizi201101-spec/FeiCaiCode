import { useState } from 'react'
import { type Shot, type ShotGroup, getDurationColor } from '../../api/shots'

interface GroupViewProps {
  shots: Shot[]
  groups: ShotGroup[]
  onEditShot: (shotId: string) => void
}

export default function GroupView({ shots, groups, onEditShot }: GroupViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // 获取组内的镜头
  const getGroupShots = (group: ShotGroup) => {
    return shots.filter((s) => s.group_id === group.group_id)
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const color = getDurationColor(group.total_duration)
        const groupShots = getGroupShots(group)
        const isExpanded = expandedGroups.has(group.group_id)

        return (
          <div key={group.group_id} className="border rounded-lg overflow-hidden">
            {/* 组标题 */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleGroup(group.group_id)}
            >
              <div className="flex items-center gap-3">
                {/* 颜色条 */}
                <div
                  className={`w-2 h-6 rounded ${
                    color === 'green'
                      ? 'bg-green-500'
                      : color === 'yellow'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />

                <span className="font-medium">{group.group_id}</span>
                <span className="text-sm text-gray-500">
                  {group.total_duration.toFixed(1)}s
                </span>
                <span className="text-sm text-gray-400">
                  {groupShots.length} 个镜头
                </span>
              </div>

              {/* 时长状态 */}
              <span
                className={`px-2 py-1 rounded text-xs ${
                  color === 'green'
                    ? 'bg-green-100 text-green-700'
                    : color === 'yellow'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {color === 'green' ? '正常' : color === 'yellow' ? '接近上限' : '超出限制'}
              </span>

              {/* 展开/收起图标 */}
              <span className="text-gray-400">
                {isExpanded ? '▼' : '▶'}
              </span>
            </div>

            {/* 组内镜头列表 */}
            {isExpanded && (
              <div className="border-t bg-gray-50">
                {groupShots.map((shot) => (
                  <div
                    key={shot.shot_id}
                    className="flex items-center justify-between p-2 hover:bg-blue-50 cursor-pointer"
                    onClick={() => onEditShot(shot.shot_id)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{shot.shot_id}</span>
                      <span className="text-sm text-gray-500">{shot.shot_type}</span>
                      <span className="text-sm text-gray-500">{shot.shot_size}</span>
                      <span className="text-sm text-gray-400">
                        {shot.duration.toFixed(1)}s
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 truncate max-w-md">
                      {shot.frame_action}
                    </div>

                    <button
                      className="text-blue-500 hover:underline text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditShot(shot.shot_id)
                      }}
                    >
                      编辑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}