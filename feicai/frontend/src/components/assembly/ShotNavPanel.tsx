import { useState, useEffect } from 'react'
import { type Shot } from '../../api/shots'
import { type Prompt } from '../../api/prompts'

interface ShotNavPanelProps {
  shots: Shot[]
  prompts: Prompt[]
  currentShotId: string | null
  onSelectShot: (shotId: string, groupId: string) => void
  // Tab4 返修状态
  revisionShotIds?: string[]
  // Tab4 跳转定位
  focusGroupId?: string | null
  onFocusHandled?: () => void
}

// 状态颜色：绿=合格, 橙=待审, 红=返修, 灰=未生成
type ShotStatus = 'confirmed' | 'pending' | 'revision' | 'not_generated'

function getShotStatus(
  shotId: string,
  prompts: Prompt[],
  revisionShotIds: string[]
): ShotStatus {
  // 优先检查返修状态（Tab4 标记）
  if (revisionShotIds.includes(shotId)) return 'revision'

  const prompt = prompts.find(p => p.shot_id === shotId)
  if (!prompt) return 'not_generated'
  if (prompt.confirmed) return 'confirmed'
  return 'pending'
}

function getStatusStyle(status: ShotStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-900/50 text-green-400 border-green-700'
    case 'pending':
      return 'bg-orange-900/50 text-orange-400 border-orange-700'
    case 'revision':
      return 'bg-red-900/50 text-red-400 border-red-700'
    case 'not_generated':
      return 'bg-gray-800 text-gray-500 border-gray-600'
    default:
      return 'bg-gray-800 text-gray-500'
  }
}

function getStatusLabel(status: ShotStatus): string {
  switch (status) {
    case 'confirmed': return '合格'
    case 'pending': return '待审'
    case 'revision': return '返修'
    case 'not_generated': return '未生成'
    default: return '未知'
  }
}

export default function ShotNavPanel({
  shots,
  prompts,
  currentShotId,
  onSelectShot,
  revisionShotIds = [],
  focusGroupId = null,
  onFocusHandled,
}: ShotNavPanelProps) {
  // 折叠状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(shots.map(s => s.group_id))
  )

  // 处理 focusGroupId 定位（从 Tab4 跳转）
  useEffect(() => {
    if (focusGroupId) {
      // 确保该组展开
      setExpandedGroups(prev => {
        const next = new Set(prev)
        next.add(focusGroupId)
        return next
      })
      // 定位到该组第一个镜头
      const firstShot = shots.find(s => s.group_id === focusGroupId)
      if (firstShot) {
        onSelectShot(firstShot.shot_id, focusGroupId)
      }
      // 通知父组件定位完成
      if (onFocusHandled) {
        onFocusHandled()
      }
    }
  }, [focusGroupId, shots, onSelectShot, onFocusHandled])

  // 按 group_id 分组
  const groups = shots.reduce<Record<string, Shot[]>>((acc, shot) => {
    const gid = shot.group_id
    if (!acc[gid]) acc[gid] = []
    acc[gid].push(shot)
    return acc
  }, {})

  // 切换组折叠
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // 统计
  const confirmedCount = prompts.filter(p => p.confirmed).length
  const pendingCount = prompts.filter(p => !p.confirmed && !revisionShotIds.includes(p.shot_id)).length
  const revisionCount = revisionShotIds.length
  const notGeneratedCount = shots.length - prompts.length

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 顶部统计 */}
      <div className="p-2 border-b border-gray-800 bg-gray-900">
        <div className="text-xs text-gray-500">
          共 {shots.length} 个镜头 / {Object.keys(groups).length} 个组
        </div>
        <div className="flex gap-2 text-xs mt-1">
          <span className="text-green-600">合格: {confirmedCount}</span>
          <span className="text-orange-600">待审: {pendingCount}</span>
          {revisionCount > 0 && (
            <span className="text-red-600">返修: {revisionCount}</span>
          )}
          {notGeneratedCount > 0 && (
            <span className="text-gray-400">未生成: {notGeneratedCount}</span>
          )}
        </div>
      </div>

      {/* 组列表 */}
      <div className="flex-1 overflow-auto">
        {Object.entries(groups).map(([groupId, groupShots]) => {
          const isExpanded = expandedGroups.has(groupId)
          // 组整体状态
          const groupStatuses = groupShots.map(s =>
            getShotStatus(s.shot_id, prompts, revisionShotIds)
          )
          const hasRevision = groupStatuses.includes('revision')
          const allConfirmed = groupStatuses.every(s => s === 'confirmed')

          return (
            <div key={groupId} className="border-b border-gray-800">
              {/* 组标题（可折叠） */}
              <button
                onClick={() => toggleGroup(groupId)}
                className={`w-full px-2 py-1 font-medium text-sm flex items-center gap-2
                  ${hasRevision ? 'bg-red-950/50' : allConfirmed ? 'bg-green-950/50' : 'bg-gray-800'}
                `}
              >
                {/* 折叠图标 */}
                <span className="text-gray-400">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="text-gray-300">{groupId}</span>
                <span className="text-xs text-gray-400">
                  ({groupShots.length} 镜头)
                </span>
              </button>

              {/* 镜头列表（折叠时隐藏） */}
              {isExpanded && groupShots.map((shot) => {
                const status = getShotStatus(shot.shot_id, prompts, revisionShotIds)
                const isSelected = currentShotId === shot.shot_id

                return (
                  <button
                    key={shot.shot_id}
                    onClick={() => onSelectShot(shot.shot_id, shot.group_id)}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                      ${isSelected ? 'bg-blue-900/50 border-l-2 border-blue-500' : 'hover:bg-gray-800'}
                    `}
                  >
                    {/* 镜头ID */}
                    <span className="font-mono">{shot.shot_id}</span>

                    {/* 状态标记 */}
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${getStatusStyle(status)}`}>
                      {getStatusLabel(status)}
                    </span>

                    {/* 景别/运镜 */}
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