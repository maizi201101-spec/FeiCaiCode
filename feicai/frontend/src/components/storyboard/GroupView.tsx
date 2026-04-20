import { useState, useEffect } from 'react'
import {
  type Shot,
  type ShotGroup,
  type ShotType,
  type ShotSize,
  type CameraMove,
  type ShotUpdatePayload,
  getDurationColor,
} from '../../api/shots'
import { formatDuration } from '../../utils/format'

const SHOT_TYPES: ShotType[] = ['空境', '对话', '行动冲突', '打斗', '调度']
const SHOT_SIZES: ShotSize[] = ['大远景', '远景', '全景', '中景', '中近景', '近景', '特写']
const CAMERA_MOVES: CameraMove[] = [
  '固定', '缓慢推进', '快速推进', '缓慢拉开', '快速拉开',
  '缓慢横移', '缓慢左摇', '缓慢右摇', '跟随', '手持跟随',
  '缓慢升起', '缓慢下降', '缓慢环绕', '快速环绕', '快速摇摄',
]

interface GroupViewProps {
  shots: Shot[]
  groups: ShotGroup[]
  onSave: (shotId: string, updates: ShotUpdatePayload) => Promise<void>
}

interface InlineEditState {
  shotType: ShotType
  shotSize: ShotSize
  cameraMove: CameraMove
  frameAction: string
  saving: boolean
}

export default function GroupView({ shots, groups, onSave }: GroupViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map(g => g.group_id))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<InlineEditState | null>(null)

  useEffect(() => {
    setExpandedGroups(new Set(groups.map(g => g.group_id)))
  }, [groups.length])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const expandAll = () => setExpandedGroups(new Set(groups.map(g => g.group_id)))
  const collapseAll = () => setExpandedGroups(new Set())
  const allExpanded = expandedGroups.size === groups.length

  const getGroupShots = (group: ShotGroup) =>
    shots.filter(s => s.group_id === group.group_id)

  const getGroupAssets = (groupShots: Shot[]) => {
    const scenes = new Set<string>()
    const chars = new Set<string>()
    const props = new Set<string>()
    for (const shot of groupShots) {
      if (shot.asset_refs) {
        shot.asset_refs.scenes?.forEach(s => scenes.add(s))
        shot.asset_refs.characters?.forEach(c =>
          chars.add(`${c.name}${c.costume ? `(${c.costume})` : ''}`)
        )
        shot.asset_refs.props?.forEach(p => props.add(p))
      }
    }
    return { scenes: [...scenes], chars: [...chars], props: [...props] }
  }

  const startEdit = (shot: Shot) => {
    setEditingId(shot.shot_id)
    setEditState({
      shotType: shot.shot_type,
      shotSize: shot.shot_size,
      cameraMove: shot.camera_move,
      frameAction: shot.frame_action,
      saving: false,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditState(null)
  }

  const handleSave = async (shotId: string) => {
    if (!editState) return
    setEditState(s => s ? { ...s, saving: true } : null)
    try {
      await onSave(shotId, {
        shot_type: editState.shotType,
        shot_size: editState.shotSize,
        camera_move: editState.cameraMove,
        frame_action: editState.frameAction,
      })
      setEditingId(null)
      setEditState(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
      setEditState(s => s ? { ...s, saving: false } : null)
    }
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

      {groups.map(group => {
        const color = getDurationColor(group.total_duration)
        const groupShots = getGroupShots(group)
        const isExpanded = expandedGroups.has(group.group_id)
        const assets = getGroupAssets(groupShots)

        return (
          <div key={group.group_id} className="border border-gray-700 rounded-lg overflow-hidden">
            {/* 组标题 */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800"
              onClick={() => toggleGroup(group.group_id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                {/* 颜色条 */}
                <div
                  className={`w-2 h-5 rounded flex-shrink-0 ${
                    color === 'green' ? 'bg-green-500'
                    : color === 'yellow' ? 'bg-yellow-500'
                    : 'bg-red-500'
                  }`}
                />
                <span className="font-medium">{group.group_id}</span>
                <span className="text-sm text-gray-500">
                  {formatDuration(group.total_duration)}s
                </span>
                <span className="text-sm text-gray-400">{groupShots.length} 个镜头</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  color === 'green' ? 'bg-green-900/50 text-green-400'
                  : color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400'
                  : 'bg-red-900/50 text-red-400'
                }`}>
                  {color === 'green' ? '正常' : color === 'yellow' ? '接近上限' : '超出限制'}
                </span>

                {/* 资产聚合（同行，竖线分隔） */}
                {(assets.scenes.length > 0 || assets.chars.length > 0 || assets.props.length > 0) && (
                  <>
                    <span className="text-gray-700">|</span>
                    <span className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                      {assets.scenes.length > 0 && <span>{assets.scenes.join('、')}</span>}
                      {assets.chars.length > 0 && <span>{assets.chars.join('、')}</span>}
                      {assets.props.length > 0 && <span className="text-gray-600">{assets.props.join('、')}</span>}
                    </span>
                  </>
                )}
              </div>

              <span className="text-gray-400 ml-2 flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {/* 组内镜头列表 */}
            {isExpanded && (
              <div className="border-t border-gray-700 bg-gray-800">
                {groupShots.map(shot => {
                  const isEditing = editingId === shot.shot_id && editState

                  return (
                    <div key={shot.shot_id} className="border-b border-gray-700 last:border-b-0">
                      {isEditing ? (
                        /* 编辑模式 */
                        <div className="p-3 space-y-2 bg-gray-750">
                          {/* 第一行：元信息 + 下拉选择 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium w-10 flex-shrink-0">{shot.shot_id}</span>
                            <select
                              value={editState.shotType}
                              onChange={e => setEditState(s => s ? { ...s, shotType: e.target.value as ShotType } : null)}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200"
                              onClick={e => e.stopPropagation()}
                            >
                              {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                              value={editState.shotSize}
                              onChange={e => setEditState(s => s ? { ...s, shotSize: e.target.value as ShotSize } : null)}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200"
                              onClick={e => e.stopPropagation()}
                            >
                              {SHOT_SIZES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                              value={editState.cameraMove}
                              onChange={e => setEditState(s => s ? { ...s, cameraMove: e.target.value as CameraMove } : null)}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200"
                              onClick={e => e.stopPropagation()}
                            >
                              {CAMERA_MOVES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <span className="text-xs text-gray-500 ml-auto">{formatDuration(shot.duration)}s</span>
                          </div>
                          {/* 第二行：画面内容 textarea */}
                          <textarea
                            value={editState.frameAction}
                            onChange={e => setEditState(s => s ? { ...s, frameAction: e.target.value } : null)}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 resize-none focus:outline-none focus:border-indigo-500"
                            rows={3}
                            onClick={e => e.stopPropagation()}
                          />
                          {/* 操作按钮 */}
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={e => { e.stopPropagation(); cancelEdit() }}
                              className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                            >
                              取消
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleSave(shot.shot_id) }}
                              disabled={editState.saving}
                              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
                            >
                              {editState.saving ? '保存中...' : '保存'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 只读模式 */
                        <div className="flex items-start justify-between p-2 hover:bg-gray-700 gap-3">
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-medium w-10">{shot.shot_id}</span>
                            <span className="text-sm text-gray-500">{shot.shot_type}</span>
                            <span className="text-sm text-gray-500">{shot.shot_size}</span>
                            <span className="text-sm text-gray-400">
                              {formatDuration(shot.duration)}s
                            </span>
                          </div>
                          <div className="text-sm text-gray-400 flex-1 min-w-0 break-words whitespace-pre-wrap">
                            {shot.frame_action}
                          </div>
                          <button
                            className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 flex-shrink-0"
                            onClick={e => { e.stopPropagation(); startEdit(shot) }}
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
