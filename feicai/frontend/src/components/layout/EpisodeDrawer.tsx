import { useEffect, useState, useCallback } from 'react'
import type { Episode } from '../../api/projects'
import { getEpisodeAssets } from '../../api/assets'
import type { Asset } from '../../api/assets'

interface EpisodeDrawerProps {
  projectId: number
  episodes: Episode[]
  currentEpisodeId: number | null
  pinned: boolean
  onPin: (pinned: boolean) => void
  onSelect: (episode: Episode) => void
  onClose: () => void
}

const TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' } as const

function EpisodeAssets({ projectId, episodeId }: { projectId: number; episodeId: number }) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getEpisodeAssets(projectId, episodeId)
      .then((list) => { if (!cancelled) setAssets(list) })
      .catch(() => { if (!cancelled) setAssets([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, episodeId])

  if (loading) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5">
        <div className="animate-spin w-3 h-3 border border-indigo-400 border-t-transparent rounded-full" />
        <span className="text-xs text-gray-600">加载中…</span>
      </div>
    )
  }

  if (!assets || assets.length === 0) {
    return <p className="text-xs text-gray-600 px-3 py-1.5">暂未提取</p>
  }

  const grouped = {
    character: assets.filter((a) => a.asset_type === 'character'),
    scene: assets.filter((a) => a.asset_type === 'scene'),
    prop: assets.filter((a) => a.asset_type === 'prop'),
  }

  return (
    <div className="px-3 py-1.5 space-y-1">
      {(['character', 'scene', 'prop'] as const).map((type) => {
        const list = grouped[type]
        if (list.length === 0) return null
        return (
          <div key={type} className="flex gap-1 text-xs">
            <span className="shrink-0 text-gray-500">{TYPE_LABEL[type]}：</span>
            <span className="text-gray-400 leading-relaxed">{list.map((a) => a.name).join('、')}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function EpisodeDrawer({
  projectId,
  episodes,
  currentEpisodeId,
  pinned,
  onPin,
  onSelect,
  onClose,
}: EpisodeDrawerProps) {
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pinned) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, pinned])

  const toggleExpand = useCallback((id: number) => {
    setExpandedEpisodeId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="w-[220px] h-full bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400">集数列表</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPin(!pinned)}
            title={pinned ? '取消固定' : '固定抽屉'}
            className={`text-sm px-1 rounded transition-colors ${
              pinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            📌
          </button>
          {!pinned && (
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-400 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {episodes.length === 0 ? (
          <p className="text-xs text-gray-600 px-3 py-4 text-center">暂无集数</p>
        ) : (
          episodes.map((ep) => (
            <div key={ep.id}>
              <div
                className={`flex items-center w-full text-left transition-colors ${
                  currentEpisodeId === ep.id
                    ? 'bg-indigo-600/20'
                    : 'hover:bg-gray-800'
                }`}
              >
                <button
                  onClick={() => onSelect(ep)}
                  className={`flex-1 px-3 py-2 text-sm text-left ${
                    currentEpisodeId === ep.id ? 'text-indigo-300' : 'text-gray-300'
                  }`}
                >
                  <span className="font-medium">EP{String(ep.number).padStart(2, '0')}</span>
                  {ep.title && (
                    <span className="ml-2 text-xs text-gray-400 truncate">{ep.title}</span>
                  )}
                </button>
                <button
                  onClick={() => toggleExpand(ep.id)}
                  className="px-2 py-2 text-gray-600 hover:text-gray-400 text-xs"
                  title="展开资产列表"
                >
                  {expandedEpisodeId === ep.id ? '▾' : '▸'}
                </button>
              </div>
              {expandedEpisodeId === ep.id && (
                <div className="bg-gray-800/50 border-l-2 border-indigo-700/40 ml-2">
                  <EpisodeAssets projectId={projectId} episodeId={ep.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
