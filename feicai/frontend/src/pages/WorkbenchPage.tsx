import { useState } from 'react'
import WorkbenchLayout from '../components/layout/WorkbenchLayout'
import ScriptPanel from '../components/tabs/ScriptPanel'
import Tab1Assets from '../pages/tabs/Tab1Assets'
import Tab2Storyboard from '../pages/tabs/Tab2Storyboard'
import Tab3Assembly from '../pages/tabs/Tab3Assembly'
import Tab4QC from '../pages/tabs/Tab4QC'

interface EpisodeInfo {
  id: number
  number: number
}

export default function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState(0)
  const projectId = Number(window.location.pathname.split('/')[2])

  // Tab3↔Tab4 双向联动状态
  const [revisionShotIds, setRevisionShotIds] = useState<string[]>([])
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null)

  // 处理 Tab4 点击「去修改」跳转到 Tab3
  const handleGoToTab3 = (groupId: string) => {
    setFocusGroupId(groupId)
    setActiveTab(2) // 切换到 Tab 3
    // 清除 focusGroupId 需要在 Tab3 定位后执行（由 Tab3 控制）
  }

  return (
    <WorkbenchLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {(episode: EpisodeInfo | null) => (
        <>
          {/* 剧本预览区域 */}
          {episode && (
            <div className="border-b border-gray-800">
              <ScriptPanel projectId={projectId} episodeId={episode.id} episodeNumber={episode.number} />
            </div>
          )}

          {/* Tab 内容 */}
          {activeTab === 0 ? (
            <Tab1Assets projectId={projectId} episodeId={episode?.id ?? null} />
          ) : activeTab === 1 ? (
            <Tab2Storyboard episodeId={episode?.id ?? null} />
          ) : activeTab === 2 ? (
            episode ? (
              <Tab3Assembly
                episodeId={episode.id}
                projectId={projectId}
                revisionShotIds={revisionShotIds}
                focusGroupId={focusGroupId}
                onFocusHandled={() => setFocusGroupId(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                请先选择集数
              </div>
            )
          ) : (
            episode ? (
              <Tab4QC
                episodeId={episode.id}
                projectId={projectId}
                onGoToTab3={handleGoToTab3}
                onRevisionShotIdsChange={setRevisionShotIds}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                请先选择集数
              </div>
            )
          )}
        </>
      )}
    </WorkbenchLayout>
  )
}