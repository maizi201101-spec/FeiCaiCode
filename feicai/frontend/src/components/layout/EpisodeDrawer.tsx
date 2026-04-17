import { useEffect } from 'react'
import type { Episode } from '../../api/projects'

interface EpisodeDrawerProps {
  episodes: Episode[]
  currentEpisodeId: number | null
  onSelect: (episode: Episode) => void
  onClose: () => void
}

export default function EpisodeDrawer({
  episodes,
  currentEpisodeId,
  onSelect,
  onClose,
}: EpisodeDrawerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="w-48 h-full bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400">集数列表</span>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-400 text-xs"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {episodes.length === 0 ? (
          <p className="text-xs text-gray-600 px-3 py-4 text-center">暂无集数</p>
        ) : (
          episodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => onSelect(ep)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                currentEpisodeId === ep.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="font-medium">EP{String(ep.number).padStart(2, '0')}</span>
              {ep.title && (
                <span className="ml-2 text-xs text-gray-400 truncate">{ep.title}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
