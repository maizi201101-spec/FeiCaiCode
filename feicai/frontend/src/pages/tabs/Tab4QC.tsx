/**
 * Tab 4: 质检与确认
 * 横向矩阵表格展示组质检状态，支持筛选、版本选定、返修标记
 */

import { useState, useEffect } from 'react'
import { useQC } from '../../hooks/useQC'
import { type VideoVersionSummary } from '../../api/videos'
import GroupMatrix from '../../components/qc/GroupMatrix'
import TimelineBar from '../../components/qc/TimelineBar'
import VideoPreviewModal from '../../components/qc/VideoPreviewModal'
import ExportButton from '../../components/qc/ExportButton'

interface Tab4QCProps {
  episodeId: number | null
  projectId: number
  onGoToTab3?: (groupId: string) => void
  onRevisionShotIdsChange?: (shotIds: string[]) => void
}

export default function Tab4QC({ episodeId, onGoToTab3, onRevisionShotIdsChange }: Tab4QCProps) {
  const {
    groups,
    filteredGroups,
    loading,
    error,
    filter,
    setFilter,
    confirmedCount,
    totalCount,
    revisionShotIds,
    markRevision,
    markApproved,
    selectVersion,
  } = useQC(episodeId)

  // 同步 revisionShotIds 到父组件
  useEffect(() => {
    if (onRevisionShotIdsChange) {
      onRevisionShotIdsChange(revisionShotIds)
    }
  }, [revisionShotIds, onRevisionShotIdsChange])

  // 视频预览状态
  const [previewVideo, setPreviewVideo] = useState<VideoVersionSummary | null>(null)

  // 处理跳转到 Tab3
  const handleGoToTab3 = (groupId: string) => {
    if (onGoToTab3) {
      onGoToTab3(groupId)
    }
  }

  // 处理视频预览
  const handlePreviewVideo = (versionId: number, _videoPath: string) => {
    // 从 groups 中找到对应视频
    const video = groups.flatMap(g => g.videos).find(v => v.id === versionId)
    if (video) setPreviewVideo(video)
  }

  // 处理预览浮层的操作
  const handlePreviewMarkApproved = async (versionId: number) => {
    // 需要找到对应的 groupId
    const group = groups.find(g => g.videos.some(v => v.id === versionId))
    if (group) await markApproved(group.group_id)
    setPreviewVideo(null)
  }

  const handlePreviewMarkRejected = async (versionId: number) => {
    const group = groups.find(g => g.videos.some(v => v.id === versionId))
    if (group) await markRevision(group.group_id)
    setPreviewVideo(null)
  }

  const handlePreviewSelect = async (versionId: number) => {
    const group = groups.find(g => g.videos.some(v => v.id === versionId))
    if (group) await selectVersion(group.group_id, versionId)
    setPreviewVideo(null)
  }

  // 空状态检查
  if (!episodeId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        请先选择集数
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-gray-400">无分镜数据</div>
        <div className="text-sm text-gray-500">
          请先在 Tab 2 进行分镜规划
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-gray-900 shrink-0">
        {/* 确认进度 */}
        <div className="text-sm text-gray-400">
          已确认：<span className="font-medium text-green-400">{confirmedCount}</span> / {totalCount} 组
        </div>

        {/* 筛选按钮 */}
        <div className="flex gap-1">
          {(['all', 'pending', 'revision', 'approved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待审' : f === 'revision' ? '返修' : '合格'}
            </button>
          ))}
        </div>

        {/* 导出按钮 */}
        <ExportButton
          episodeId={episodeId}
          confirmedCount={confirmedCount}
          totalCount={totalCount}
        />
      </div>

      {/* 主区域：矩阵表格 */}
      <div className="flex-1 overflow-hidden">
        <GroupMatrix
          groups={filteredGroups}
          onSelectVersion={selectVersion}
          onMarkRevision={markRevision}
          onMarkApproved={markApproved}
          onPreviewVideo={handlePreviewVideo}
          onGoToTab3={handleGoToTab3}
        />
      </div>

      {/* 底部时间线 */}
      <TimelineBar
        groups={groups}
        onScrollToGroup={() => {
          // 滚动到对应组（可以传递给 GroupMatrix 实现）
          // 简化实现：切换筛选到全部
          setFilter('all')
        }}
      />

      {/* 视频预览浮层 */}
      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
          onMarkApproved={handlePreviewMarkApproved}
          onMarkRejected={handlePreviewMarkRejected}
          onSelect={handlePreviewSelect}
        />
      )}
    </div>
  )
}