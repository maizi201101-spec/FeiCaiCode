import { useState } from 'react'
import { useShots } from '../../hooks/useShots'
import { type ShotUpdatePayload } from '../../api/shots'
import { extractFromStoryboard } from '../../api/assets'
import ShotTable from '../../components/storyboard/ShotTable'
import GroupView from '../../components/storyboard/GroupView'
import ShotEditPanel from '../../components/storyboard/ShotEditPanel'
import ExportPromptsButton from '../../components/common/ExportPromptsButton'

interface Tab2StoryboardProps {
  projectId: number
  episodeId: number | null
}

export default function Tab2Storyboard({ projectId, episodeId }: Tab2StoryboardProps) {
  const [viewMode, setViewMode] = useState<'table' | 'group'>('table')
  const [editingShotId, setEditingShotId] = useState<string | null>(null)
  const [extractingAssets, setExtractingAssets] = useState(false)

  const {
    shotsCollection,
    shots,
    groups,
    loading,
    error,
    generating,
    refetch,
    planShots,
    editShot,
    changeShotGroup,
  } = useShots(episodeId)

  const handlePlanShots = async () => {
    if (!episodeId) {
      alert('请先选择集数')
      return
    }
    try {
      await planShots()
    } catch (e) {
      alert(e instanceof Error ? e.message : '分镜规划失败')
    }
  }

  const handleEditShot = (shotId: string) => {
    setEditingShotId(shotId)
  }

  const handleCloseEditPanel = () => {
    setEditingShotId(null)
  }

  const handleSaveShot = async (shotId: string, updates: ShotUpdatePayload) => {
    try {
      await editShot(shotId, updates)
      setEditingShotId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  const handleChangeGroup = async (shotId: string, groupId: string) => {
    try {
      await changeShotGroup(shotId, groupId)
    } catch (e) {
      alert(e instanceof Error ? e.message : '调整归组失败')
    }
  }

  const handleExtractAssets = async () => {
    if (!episodeId) {
      alert('请先选择集数')
      return
    }
    setExtractingAssets(true)
    try {
      const result = await extractFromStoryboard(episodeId)
      alert(`资产提取完成：${result.characters_count} 角色，${result.scenes_count} 场景，${result.props_count} 道具`)
    } catch (e) {
      alert(e instanceof Error ? e.message : '提取失败')
    } finally {
      setExtractingAssets(false)
    }
  }

  // 空状态
  if (!episodeId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        请先选择集数
      </div>
    )
  }

  // 加载状态
  if (loading && !shotsCollection) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        加载中...
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    )
  }

  // 无分镜数据
  if (!shotsCollection || shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-500">暂无分镜数据</p>
        <button
          onClick={handlePlanShots}
          disabled={generating}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {generating ? '规划中...' : 'AI 规划分镜'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            {/* 视图切换 */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded ${
                  viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                表格视图
              </button>
              <button
                onClick={() => setViewMode('group')}
                className={`px-3 py-1 rounded ${
                  viewMode === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                组视图
              </button>
            </div>

            {/* 统计信息 */}
            <span className="text-sm text-gray-500">
              共 {shots.length} 个镜头，{groups.length} 个组
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <ExportPromptsButton episodeId={episodeId} />
            <button
              onClick={handleExtractAssets}
              disabled={extractingAssets || generating}
              className="px-3 py-1 bg-teal-500 text-white rounded disabled:bg-gray-300 text-sm"
            >
              {extractingAssets ? '提取中...' : '提取资产'}
            </button>
            <button
              onClick={refetch}
              className="px-3 py-1 bg-gray-100 rounded"
            >
              刷新
            </button>
            <button
              onClick={handlePlanShots}
              disabled={generating}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              {generating ? '规划中...' : '重新规划'}
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'table' ? (
            <ShotTable
              shots={shots}
              groups={groups}
              onEditShot={handleEditShot}
            />
          ) : (
            <GroupView
              shots={shots}
              groups={groups}
              onEditShot={handleEditShot}
            />
          )}
        </div>
      </div>

      {/* 编辑面板（右侧） */}
      {editingShotId && (
        <ShotEditPanel
          shot={shots.find((s) => s.shot_id === editingShotId)!}
          groups={groups}
          onClose={handleCloseEditPanel}
          onSave={handleSaveShot}
          onChangeGroup={handleChangeGroup}
        />
      )}
    </div>
  )
}