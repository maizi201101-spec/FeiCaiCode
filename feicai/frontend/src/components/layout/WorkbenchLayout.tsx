import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import EpisodeDrawer from './EpisodeDrawer'
import EpisodeSelector from './EpisodeSelector'
import TaskIndicator from './TaskIndicator'
import { useEpisodes } from '../../hooks/useProjects'
import { getProject } from '../../api/projects'

const TABS = ['剧本管理', '分镜规划', '资产库', '装配与生成', '质检与确认'] as const

interface EpisodeInfo {
  id: number
  number: number
}

interface WorkbenchLayoutProps {
  children: (episode: EpisodeInfo | null, onEpisodesRefresh: () => void) => React.ReactNode
  activeTab: number
  onTabChange: (i: number) => void
}

export default function WorkbenchLayout({
  children,
  activeTab,
  onTabChange,
}: WorkbenchLayoutProps) {
  const { projectId } = useParams()
  const projectIdNum = Number(projectId)
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeInfo | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPinned, setDrawerPinned] = useState(() => {
    try { return localStorage.getItem('episode-drawer-pinned') === 'true' } catch { return false }
  })
  const { episodes, refetch: refetchEpisodes } = useEpisodes(projectIdNum)
  const [projectName, setProjectName] = useState<string>('')
  const [episodeRefreshToken, setEpisodeRefreshToken] = useState(0)

  const handleEpisodesRefresh = () => {
    refetchEpisodes()
    setEpisodeRefreshToken((t) => t + 1)
  }

  useEffect(() => {
    if (!projectIdNum) return
    getProject(projectIdNum).then(p => setProjectName(p.name)).catch(() => {})
  }, [projectIdNum])

  // 从 episodes 列表中找到当前 episode 的 number
  const handleEpisodeIdChange = (episodeId: number) => {
    const ep = episodes.find((e) => e.id === episodeId)
    if (ep) {
      setCurrentEpisode({ id: ep.id, number: ep.number })
    }
  }

  const handlePinChange = (pinned: boolean) => {
    setDrawerPinned(pinned)
    try { localStorage.setItem('episode-drawer-pinned', String(pinned)) } catch {}
    if (pinned) setDrawerOpen(true)
  }

  const handleSelectEpisode = (ep: EpisodeInfo) => {
    setCurrentEpisode(ep)
    if (!drawerPinned) setDrawerOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 px-4 py-2 flex items-center gap-4 shrink-0">
        <Link
          to="/"
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          ← 项目列表
        </Link>
        <span className="text-gray-600">|</span>
        <button
          onClick={() => setDrawerOpen((o) => !o)}
          className="text-sm font-medium hover:text-gray-300 transition-colors"
        >
          {projectName || `项目 #${projectId}`}
        </button>
        <span className="text-gray-600">|</span>
        {projectIdNum ? (
          <EpisodeSelector
            projectId={projectIdNum}
            currentEpisodeId={currentEpisode?.id ?? null}
            onEpisodeChange={handleEpisodeIdChange}
            refreshToken={episodeRefreshToken}
          />
        ) : (
          <select className="bg-gray-900 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300">
            <option>EP01</option>
          </select>
        )}
        <div className="flex gap-1 ml-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => onTabChange(i)}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                activeTab === i
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {projectIdNum && <TaskIndicator projectId={projectIdNum} />}
          <Link
            to={`/settings?projectId=${projectIdNum}`}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            ⚙ 设置
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden transition-all duration-200">
        {/* 左侧集数抽屉 */}
        {(drawerOpen || drawerPinned) && (
          <EpisodeDrawer
            projectId={projectIdNum}
            episodes={episodes}
            currentEpisodeId={currentEpisode?.id ?? null}
            pinned={drawerPinned}
            onPin={handlePinChange}
            onSelect={handleSelectEpisode}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {/* 主工作区 */}
        <main className="flex-1 overflow-hidden min-w-0">{children(currentEpisode, handleEpisodesRefresh)}</main>
      </div>
    </div>
  )
}