import { useState } from 'react'
import { useShots } from '../../hooks/useShots'
import { planAllShots } from '../../api/shots'

import ShotTable from '../../components/storyboard/ShotTable'
import GroupView from '../../components/storyboard/GroupView'

interface Tab2StoryboardProps {
  projectId: number
  episodeId: number | null
}

export default function Tab2Storyboard({ projectId, episodeId }: Tab2StoryboardProps) {
  const [viewMode, setViewMode] = useState<'table' | 'group'>('group')
  const [planningAll, setPlanningAll] = useState(false)

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

  const handlePlanAll = async () => {
    setPlanningAll(true)
    try {
      // 第一次调用：检测是否需要确认
      const result = await planAllShots(projectId, false)

      if (result.needsConfirmation) {
        // 已有提示词，需要二次确认
        const confirmed = confirm(
          `⚠️ ${result.message}\n\n` +
          `共 ${result.episodeCount} 集将被重新规划，所有资产和提示词数据将被删除。\n\n` +
          `此操作通常仅在项目初期使用，相当于重置整个工作流。\n\n` +
          `确定要继续吗？`
        )
        if (!confirmed) {
          setPlanningAll(false)
          return
        }
        // 用户确认，强制执行
        const forceResult = await planAllShots(projectId, true)
        alert(`${forceResult.message}\n任务ID: ${forceResult.taskId}`)
      } else {
        // 首次规划，直接执行
        alert(`${result.message}\n任务ID: ${result.taskId}`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '批量规划失败')
    } finally {
      setPlanningAll(false)
    }
  }

  const handleChangeGroup = async (shotId: string, groupId: string) => {
    try {
      await changeShotGroup(shotId, groupId)
    } catch (e) {
      alert(e instanceof Error ? e.message : '调整归组失败')
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
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-700"
        >
          {generating ? '规划中...' : 'AI 规划分镜'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-4">
          {/* 视图切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded ${
                viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              表格视图
            </button>
            <button
              onClick={() => setViewMode('group')}
              className={`px-3 py-1 rounded ${
                viewMode === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
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
          <button
            onClick={refetch}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            刷新
          </button>
          <button
            onClick={handlePlanShots}
            disabled={generating}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-700"
          >
            {generating ? '规划中...' : '重新规划'}
          </button>
          <button
            onClick={handlePlanAll}
            disabled={planningAll || generating}
            className="px-3 py-1 bg-purple-600 text-white rounded disabled:bg-gray-700 hover:bg-purple-700"
          >
            {planningAll ? '批量规划中...' : '批量规划所有集'}
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'table' ? (
          <ShotTable
            shots={shots}
            groups={groups}
          />
        ) : (
          <GroupView
            shots={shots}
            groups={groups}
            onSave={editShot}
          />
        )}
      </div>
    </div>
  )
}