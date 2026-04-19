/**
 * 视频预览浮层
 * 点击缩略图展开，显示视频播放器和操作按钮
 */

import { type VideoVersionSummary } from '../../api/videos'

interface VideoPreviewModalProps {
  video: VideoVersionSummary | null
  onClose: () => void
  onMarkApproved: (versionId: number) => void
  onMarkRejected: (versionId: number) => void
  onSelect: (versionId: number) => void
}

export default function VideoPreviewModal({
  video,
  onClose,
  onMarkApproved,
  onMarkRejected,
  onSelect,
}: VideoPreviewModalProps) {
  if (!video) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
          <div className="text-sm font-medium text-gray-200">
            {video.shot_id} - V{video.version_number}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ×
          </button>
        </div>

        {/* 视频播放器 */}
        <div className="p-4">
          {video.video_path ? (
            <video
              src={video.video_path}
              className="w-full rounded"
              controls
              autoPlay
            />
          ) : (
            <div className="w-full h-48 bg-gray-800 flex items-center justify-center text-gray-500">
              无视频文件
            </div>
          )}
        </div>

        {/* 状态信息 */}
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800 flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            video.qc_status === 'approved' ? 'bg-green-900/50 text-green-400' :
            video.qc_status === 'rejected' ? 'bg-red-900/50 text-red-400' :
            'bg-orange-900/50 text-orange-400'
          }`}>
            {video.qc_status === 'approved' ? '合格' : video.qc_status === 'rejected' ? '不合格' : '待审'}
          </span>
          {video.selected && (
            <span className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-400">
              已选定
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          {video.qc_status !== 'approved' && (
            <button
              onClick={() => onMarkApproved(video.id)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-500"
            >
              合格
            </button>
          )}
          {video.qc_status !== 'rejected' && (
            <button
              onClick={() => onMarkRejected(video.id)}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-500"
            >
              不合格
            </button>
          )}
          {!video.selected && (
            <button
              onClick={() => onSelect(video.id)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              选定
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}