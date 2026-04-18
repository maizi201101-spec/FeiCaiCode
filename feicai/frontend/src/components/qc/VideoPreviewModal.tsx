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
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="text-sm font-medium text-gray-700">
            {video.shot_id} - V{video.version_number}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
            <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
              无视频文件
            </div>
          )}
        </div>

        {/* 状态信息 */}
        <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            video.qc_status === 'approved' ? 'bg-green-100 text-green-700' :
            video.qc_status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {video.qc_status === 'approved' ? '合格' : video.qc_status === 'rejected' ? '不合格' : '待审'}
          </span>
          {video.selected && (
            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
              已选定
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          {video.qc_status !== 'approved' && (
            <button
              onClick={() => onMarkApproved(video.id)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              合格
            </button>
          )}
          {video.qc_status !== 'rejected' && (
            <button
              onClick={() => onMarkRejected(video.id)}
              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              不合格
            </button>
          )}
          {!video.selected && (
            <button
              onClick={() => onSelect(video.id)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              选定
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}