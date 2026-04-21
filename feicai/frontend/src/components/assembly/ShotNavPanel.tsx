import { useState, useEffect } from 'react'
import { type Shot } from '../../api/shots'
import { type Prompt } from '../../api/prompts'

interface ShotNavPanelProps {
  shots: Shot[]
  prompts: Prompt[]
  currentShotId: string | null
  currentGroupId: string | null
  onSelectShot: (shotId: string, groupId: string) => void
  onSelectGroup: (groupId: string) => void
  revisionShotIds?: string[]
  focusGroupId?: string | null
  onFocusHandled?: () => void
}

export default function ShotNavPanel({
  shots,
  prompts,
  currentShotId,
  currentGroupId,
  onSelectShot,
  onSelectGroup,
  revisionShotIds = [],
  focusGroupId = null,
  onFocusHandled,
}: ShotNavPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(shots.map(s => s.group_id))
  )

  useEffect(() => {
    if (focusGroupId) {
      setExpandedGroups(prev => {
        const next = new Set(prev)
        next.add(focusGroupId)
        return next
      })
      const firstShot = shots.find(s => s.group_id === focusGroupId)
      if (firstShot) onSelectShot(firstShot.shot_id, focusGroupId)
      if (onFocusHandled) onFocusHandled()
    }
  }, [focusGroupId, shots, onSelectShot, onFocusHandled])

  const groups = shots.reduce<Record<string, Shot[]>>((acc, shot) => {
    const gid = shot.group_id
    if (!acc[gid]) acc[gid] = []
    acc[gid].push(shot)
    return acc
  }, {})

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const hasPrompt = (shotId: string) => prompts.some(p => p.shot_id === shotId)
  const isRevision = (shotId: string) => revisionShotIds.includes(shotId)

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 顶部统计 */}
      <div className="p-2 border-b border-gray-800 bg-gray-900">
        <div className="text-xs text-gray-500">
          共 {shots.length} 个镜头 / {Object.keys(groups).length} 个组
        </div>
        {revisionShotIds.length > 0 && (
          <div className="text-xs text-red-400 mt-0.5">返修: {revisionShotIds.length}</div>
        )}
      </div>

      {/* 组列表 */}
      <div className="flex-1 overflow-auto">
        {Object.entries(groups).map(([groupId, groupShots]) => {
          const isExpanded = expandedGroups.has(groupId)
          const hasRevision = groupShots.some(s => isRevision(s.shot_id))

          return (
            <div key={groupId} className="border-b border-gray-800">
              <div
                className={`w-full px-2 py-1.5 font-medium text-sm flex items-center gap-2 cursor-pointer
                  ${hasRevision ? 'bg-red-950/50' : currentGroupId === groupId ? 'bg-blue-900/40 border-l-2 border-blue-500' : 'bg-gray-800'}
                `}
                onClick={() => onSelectGroup(groupId)}
              >
                <span
                  className="text-gray-400 hover:text-gray-200 px-0.5"
                  onClick={(e) => { e.stopPropagation(); toggleGroup(groupId) }}
                >
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="text-gray-300">{groupId}</span>
                <span className="text-xs text-gray-400">({groupShots.length} 镜头)</span>
              </div>

              {isExpanded && groupShots.map((shot) => {
                const isSelected = currentShotId === shot.shot_id
                const generated = hasPrompt(shot.shot_id)
                const revision = isRevision(shot.shot_id)

                return (
                  <button
                    key={shot.shot_id}
                    onClick={() => onSelectShot(shot.shot_id, shot.group_id)}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                      ${isSelected ? 'bg-blue-900/50 border-l-2 border-blue-500' : 'hover:bg-gray-800'}
                    `}
                  >
                    <span className="font-mono">{shot.shot_id}</span>
                    {revision && (
                      <span className="text-xs px-1 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-700">返修</span>
                    )}
                    {!generated && !revision && (
                      <span className="text-xs text-gray-600">未生成</span>
                    )}
                    <span className="text-xs text-gray-400 truncate">
                      {shot.shot_size} / {shot.camera_move}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
