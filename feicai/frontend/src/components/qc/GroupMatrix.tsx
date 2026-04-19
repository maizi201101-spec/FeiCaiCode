/**
 * 组质检矩阵表格
 * 横向滚动，行标题 sticky 固定左侧
 */

import { type GroupQCData } from '../../api/qc'
import GroupColumn from './GroupColumn'

interface GroupMatrixProps {
  groups: GroupQCData[]
  onSelectVersion: (groupId: string, versionId: number) => void
  onMarkRevision: (groupId: string) => void
  onMarkApproved: (groupId: string) => void
  onPreviewVideo: (versionId: number, videoPath: string) => void
  onGoToTab3: (groupId: string) => void
}

export default function GroupMatrix({
  groups,
  onSelectVersion,
  onMarkRevision,
  onMarkApproved,
  onPreviewVideo,
  onGoToTab3,
}: GroupMatrixProps) {
  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        无组数据
      </div>
    )
  }

  // 计算最大版本数（决定版本行数）
  const maxVersions = Math.max(...groups.map(g => {
    const versionCounts: Record<string, number> = {}
    g.videos.forEach(v => {
      versionCounts[v.shot_id] = Math.max(versionCounts[v.shot_id] || 0, v.version_number)
    })
    return Math.max(...Object.values(versionCounts), 0)
  }))

  // 版本行标签（V1/V2/V3...）
  const versionRows = Array.from({ length: maxVersions }, (_, i) => `V${i + 1}`)

  return (
    <div className="overflow-x-auto overflow-y-hidden flex-1">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {/* 行标题列（固定） */}
            <th className="sticky left-0 z-10 bg-gray-900 border-b border-r border-gray-700 px-3 py-2 text-sm font-medium text-gray-400 w-[100px]">
              行标题
            </th>
            {/* 组列标题 */}
            {groups.map(g => (
              <th key={g.group_id} className="border-b border-gray-700 px-3 py-2 text-sm font-medium text-gray-400 min-w-[120px]">
                {g.group_id} ({g.total_duration}s)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* 状态行 */}
          <tr>
            <td className="sticky left-0 z-10 bg-gray-900 border-b border-r border-gray-700 px-3 py-2 text-sm font-medium text-gray-400">
              状态
            </td>
            {groups.map(g => (
              <td key={g.group_id} className="border-b border-gray-800 px-2 py-2 text-center">
                <span className={`inline-block px-2 py-1 text-xs rounded ${
                  g.status === 'approved' ? 'bg-green-900/50 text-green-400' :
                  g.status === 'revision' ? 'bg-red-900/50 text-red-400' :
                  'bg-orange-900/50 text-orange-400'
                }`}>
                  {g.status === 'approved' ? '✓ 合格' : g.status === 'revision' ? '🔴 返修' : '⚠ 待审'}
                </span>
              </td>
            ))}
          </tr>

          {/* 选定版本行 */}
          <tr>
            <td className="sticky left-0 z-10 bg-gray-900 border-b border-r border-gray-700 px-3 py-2 text-sm font-medium text-gray-400">
              选定版本
            </td>
            {groups.map(g => (
              <td key={g.group_id} className="border-b border-gray-800 px-2 py-2 text-center text-sm">
                {g.selected_version_id ? (
                  <span className="text-green-400 font-medium">
                    V{g.videos.find(v => v.id === g.selected_version_id)?.version_number}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            ))}
          </tr>

          {/* 版本缩略图行（按需） */}
          {versionRows.map((vLabel, vIdx) => (
            <tr key={vLabel}>
              <td className="sticky left-0 z-10 bg-gray-900 border-b border-r border-gray-700 px-3 py-2 text-sm font-medium text-gray-400">
                {vLabel} 缩略图
              </td>
              {groups.map(g => {
                const versionVideos = g.videos.filter(v => v.version_number === vIdx + 1)
                if (versionVideos.length === 0) {
                  return (
                    <td key={g.group_id} className="border-b border-gray-800 px-2 py-2 text-center text-sm text-gray-600">
                      -
                    </td>
                  )
                }
                // 显示第一个有视频路径的缩略图
                const firstVideo = versionVideos.find(v => v.video_path)
                return (
                  <td key={g.group_id} className="border-b border-gray-800 px-2 py-2 text-center">
                    {firstVideo?.video_path ? (
                      <button
                        onClick={() => onPreviewVideo(firstVideo.id, firstVideo.video_path!)}
                        className="w-16 h-10 bg-gray-700 rounded flex items-center justify-center hover:bg-gray-600"
                      >
                        <span className="text-xs">▶</span>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">无视频</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}

          {/* 操作行 */}
          <tr>
            <td className="sticky left-0 z-10 bg-gray-900 border-r border-gray-700 px-3 py-2 text-sm font-medium text-gray-400">
              操作
            </td>
            {groups.map(g => (
              <td key={g.group_id} className="px-2 py-2">
                <GroupColumn
                  group={g}
                  onSelectVersion={onSelectVersion}
                  onMarkRevision={onMarkRevision}
                  onMarkApproved={onMarkApproved}
                  onGoToTab3={onGoToTab3}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}