import { useEffect } from 'react'
import { useEpisodes } from '../../hooks/useProjects'

interface EpisodeSelectorProps {
  projectId: number
  currentEpisodeId: number | null
  onEpisodeChange: (episodeId: number) => void
  refreshToken?: number
}

export default function EpisodeSelector({
  projectId,
  currentEpisodeId,
  onEpisodeChange,
  refreshToken,
}: EpisodeSelectorProps) {
  const { episodes, refetch, createEpisode } = useEpisodes(projectId)

  useEffect(() => {
    refetch()
  }, [projectId, refreshToken])

  const handleAddEpisode = async () => {
    const next = episodes.length + 1
    await createEpisode({ number: next })
    await refetch()
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentEpisodeId ?? ''}
        onChange={(e) => onEpisodeChange(Number(e.target.value))}
        className="bg-gray-900 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300"
      >
        <option value="" disabled>
          选择集数
        </option>
        {episodes.map((ep: { id: number; number: number; title: string | null }) => (
          <option key={ep.id} value={ep.id}>
            EP{String(ep.number).padStart(2, '0')}
            {ep.title ? ` · ${ep.title}` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={handleAddEpisode}
        title="添加集数"
        className="text-gray-400 hover:text-gray-200 text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}
