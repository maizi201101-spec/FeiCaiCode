/**
 * 组列组件
 * 显示组操作按钮：选定版本、标记返修、去修改
 */

import { type GroupQCData } from '../../api/qc'

interface GroupColumnProps {
  group: GroupQCData
  onSelectVersion: (groupId: string, versionId: number) => void
  onMarkRevision: (groupId: string) => void
  onMarkApproved: (groupId: string) => void
  onGoToTab3: (groupId: string) => void
}

export default function GroupColumn({
  group,
  onSelectVersion,
  onMarkRevision,
  onMarkApproved,
  onGoToTab3,
}: GroupColumnProps) {
  // 获取可选版本列表（已生成且有视频路径的版本）
  const selectableVersions = group.videos
    .filter(v => v.video_path && v.status === 'completed')
    .reduce<Array<{ id: number; version_number: number; shot_id: string }>>((acc, v) => {
      // 避免重复版本号
      if (!acc.find(a => a.version_number === v.version_number)) {
        acc.push({ id: v.id, version_number: v.version_number, shot_id: v.shot_id })
      }
      return acc
    }, [])

  return (
    <div className="flex flex-col gap-1 items-center">
      {/* 选定版本按钮 */}
      {group.status !== 'approved' && selectableVersions.length > 0 && (
        <select
          className="text-xs border rounded px-1 py-0.5 w-full"
          onChange={(e) => {
            const versionId = Number(e.target.value)
            if (versionId) onSelectVersion(group.group_id, versionId)
          }}
          defaultValue=""
        >
          <option value="" disabled>选定版本</option>
          {selectableVersions.map(v => (
            <option key={v.id} value={v.id}>
              V{v.version_number} ({v.shot_id})
            </option>
          ))}
        </select>
      )}

      {/* 已选定的版本显示 */}
      {group.selected_version_id && (
        <span className="text-xs text-green-600">
          ✓ 已选定 V{group.videos.find(v => v.id === group.selected_version_id)?.version_number}
        </span>
      )}

      {/* 状态操作按钮 */}
      {group.status !== 'approved' && (
        <button
          onClick={() => onMarkApproved(group.group_id)}
          className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 w-full"
        >
          标记合格
        </button>
      )}

      {group.status !== 'revision' && (
        <button
          onClick={() => onMarkRevision(group.group_id)}
          className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 w-full"
        >
          标记返修
        </button>
      )}

      {/* 返修状态时显示去修改按钮 */}
      {group.status === 'revision' && (
        <button
          onClick={() => onGoToTab3(group.group_id)}
          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 w-full"
        >
          去修改 → Tab3
        </button>
      )}
    </div>
  )
}