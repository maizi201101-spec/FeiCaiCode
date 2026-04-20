import { useState, useEffect } from 'react'
import { type Shot, type ShotGroup, getDurationColor } from '../../api/shots'

interface GroupViewProps {
  shots: Shot[]
  groups: ShotGroup[]
  onEditShot: (shotId: string) => void
}

export default function GroupView({ shots, groups, onEditShot }: GroupViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map(g => g.group_id))
  )

  // 当 groups 数据刷新时，默认展开所有新组
  useEffect(() => {
    setExpandedGroups(new Set(groups.map(g => g.group_id)))
  }, [groups.length])

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

  const expandAll = () => setExpandedGroups(new Set(groups.map(g => g.group_id)))
  const collapseAll = () => setExpandedGroups(new Set())
  const allExpanded = expandedGroups.size === groups.length

  const getGroupShots = (group: ShotGroup) =>
    shots.filter((s) => s.group_id === group.group_id)

  // 聚合组内资产引用
  const getGroupAssets = (groupShots: Shot[]) => {
    const scenes = new Set<string>()
    const chars = new Set<string>()
    const props = new Set<string>()
    for (const shot of groupShots) {
      if (shot.asset_refs) {
        shot.asset_refs.scenes?.forEach(s => scenes.add(s))
        shot.asset_refs.characters?.forEach(c => chars.add(`${c.name}${c.costume ? `(${c.costume})` : ''}`))
        shot.asset_refs.props?.forEach(p => props.add(p))
      }
    }
    return { scenes: [...scenes], chars: [...chars], props: [...props] }
  }

  return (
    <div className="space-y-2">
      {/* 展开/收起全部 */}
      <div className="flex justify-end mb-1">
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 border border-gray-700 rounded"
        >
          {allExpanded ? '收起全部' : '展开全部'}
        </button>
      </div>

      {groups.map((group) => {
        const color = getDurationColor(group.total_duration)
        const groupShots = getGroupShots(group)
        const isExpanded = expandedGroups.has(group.group_id)
        const assets = getGroupAssets(groupShots)

        return (
          <div key={group.group_id} className="border border-gray-700 rounded-lg overflow-hidden">
            {/* 组标题 */}
            <div
              className="flex items-start justify-between p-3 cursor-pointer hover:bg-gray-800"
              onClick={() => toggleGroup(group.group_id)}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* 颜色条 */}
                <div
                  className={`w-2 h-6 rounded mt-0.5 flex-shrink-0 ${
                    color === 'green'
                      ? 'bg-green-500'
                      : color === 'yellow'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{group.group_id}</span>
                    <span className="text-sm text-gray-500">
                      {group.total_duration.toFixed(1)}s
                    </span>
                    <span className="text-sm text-gray-400">
                      {groupShots.length} 个镜头
                    </span>
                    {/* 时长状态 */}
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        color === 'green'
                          ? 'bg-green-900/50 text-green-400'
                          : color === 'yellow'
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {color === 'green' ? '正常' : color === 'yellow' ? '接近上限' : '超出限制'}
                    </span>
                  </div>

                  {/* 资产聚合：场景 / 角色 / 道具 */}
                  {(assets.scenes.length > 0 || assets.chars.length > 0 || assets.props.length > 0) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {assets.scenes.length > 0 && (
                        <span>场景：{assets.scenes.join('、')}</span>
                      )}
                      {assets.chars.length > 0 && (
                        <span>角色：{assets.chars.join('、')}</span>
                      )}
                      {assets.props.length > 0 && (
                        <span>道具：{assets.props.join('、')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 展开/收起图标 */}
              <span className="text-gray-400 ml-2 flex-shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
            </div>

            {/* 组内镜头列表 */}
            {isExpanded && (
              <div className="border-t border-gray-700 bg-gray-800">
                {groupShots.map((shot) => (
                  <div
                    key={shot.shot_id}
                    className="flex items-start justify-between p-2 hover:bg-gray-700 cursor-pointer gap-3"
                    onClick={() => onEditShot(shot.shot_id)}
                  >
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-medium w-12">{shot.shot_id}</span>
                      <span className="text-sm text-gray-500">{shot.shot_type}</span>
                      <span className="text-sm text-gray-500">{shot.shot_size}</span>
                      <span className="text-sm text-gray-400">
                        {shot.duration.toFixed(1)}s
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 flex-1 min-w-0 break-words whitespace-pre-wrap">
                      {shot.frame_action}
                    </div>

                    <button
                      className="text-blue-500 hover:underline text-sm flex-shrink-0"
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
