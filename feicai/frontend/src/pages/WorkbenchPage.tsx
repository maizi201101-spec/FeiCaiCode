import { useState } from 'react'
import WorkbenchLayout from '../components/layout/WorkbenchLayout'
import ScriptPanel from '../components/tabs/ScriptPanel'
import Tab1Assets from '../pages/tabs/Tab1Assets'
import Tab2Storyboard from '../pages/tabs/Tab2Storyboard'

const TABS = ['资产库', '分镜规划', '装配与生成', '质检与确认'] as const

interface EpisodeInfo {
  id: number
  number: number
}

export default function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState(0)
  const projectId = Number(window.location.pathname.split('/')[2])

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
          ) : (
            <div className="p-6">
              <p className="text-gray-500 text-sm">
                Tab {activeTab + 1}：{TABS[activeTab]}（开发中）
              </p>
            </div>
          )}
        </>
      )}
    </WorkbenchLayout>
  )
}