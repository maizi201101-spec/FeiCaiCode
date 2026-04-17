import { type VideoVersion } from '../../api/videos'

interface VideoVersionTabsProps {
  versions: VideoVersion[]
  currentVersionId: number | null
  onSelectVersion: (versionId: number) => void
  onMarkApproved: (versionId: number) => void
  onMarkRejected: (versionId: number) => void
  generating: boolean
}

export default function VideoVersionTabs({
  versions,
  currentVersionId,
  onSelectVersion,
  onMarkApproved,
  onMarkRejected,
  generating,
}: VideoVersionTabsProps) {
  if (versions.length === 0 && !generating) {
    return (
      <div className="text-xs text-gray-400 py-1">
        无视频版本，点击「生成此镜头」创建
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1 py-1">
      {/* 版本标签 */}
      {versions.map((v) => {
        const isSelected = v.id === currentVersionId
        const statusColor =
          v.qc_status === 'approved' ? 'bg-green-100 text-green-700 border-green-300'
          : v.qc_status === 'rejected' ? 'bg-red-100 text-red-700 border-red-300'
          : 'bg-gray-100 text-gray-600 border-gray-300'

        return (
          <button
            key={v.id}
            onClick={() => onSelectVersion(v.id)}
            className={`px-2 py-0.5 text-xs rounded border ${
              isSelected ? 'ring-2 ring-blue-500 font-medium' : ''
            } ${statusColor}`}
          >
            v{v.version_number}
            {v.selected && <span className="ml-1">✓</span>}
          </button>
        )
      })}

      {/* 生成中状态 */}
      {generating && (
        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded animate-pulse">
          生成中...
        </span>
      )}

      {/* 当前版本操作按钮 */}
      {currentVersionId && (
        <div className="ml-2 flex items-center gap-1">
          <button
            onClick={() => onMarkApproved(currentVersionId)}
            className="px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100"
          >
            合格
          </button>
          <button
            onClick={() => onMarkRejected(currentVersionId)}
            className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
          >
            不合格
          </button>
          <button
            onClick={() => onSelectVersion(currentVersionId)}
            className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            选定
          </button>
        </div>
      )}
    </div>
  )
}