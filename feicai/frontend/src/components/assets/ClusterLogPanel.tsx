import { useEffect, useState } from 'react'
import { getClusterLog } from '../../api/assets'
import type { ClusterLog, ClusterEntry } from '../../api/assets'

interface ClusterLogPanelProps {
  projectId: number
  onClose: () => void
}

const TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' } as const

function ClusterRow({ entry }: { entry: ClusterEntry }) {
  return (
    <div className="border border-gray-700/50 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
          {TYPE_LABEL[entry.type]}
        </span>
        <span className="text-sm font-medium text-white">{entry.canonical_name}</span>
        <span className="text-xs text-gray-500">{entry.asset_id}</span>
        {entry.has_inconsistent_names && (
          <span className="text-xs text-yellow-400">⚠ 名称不一致</span>
        )}
      </div>
      {entry.aliases.length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="text-gray-600">别名：</span>
          {entry.aliases.join('、')}
        </p>
      )}
      {entry.source_episodes.length > 0 && (
        <p className="text-xs text-gray-600">
          来源：{entry.source_episodes.join(' ')}
        </p>
      )}
    </div>
  )
}

export default function ClusterLogPanel({ projectId, onClose }: ClusterLogPanelProps) {
  const [log, setLog] = useState<ClusterLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClusterLog(projectId)
      .then(setLog)
      .catch(() => setLog({ extracted_at: null, clusters: [] }))
      .finally(() => setLoading(false))
  }, [projectId])

  const inconsistentCount = log?.clusters.filter((c) => c.has_inconsistent_names).length ?? 0

  return (
    <div className="w-[280px] shrink-0 h-full bg-gray-900 border-l border-gray-700 flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
        <div>
          <span className="text-sm font-medium text-gray-200">聚类审核日志</span>
          {inconsistentCount > 0 && (
            <span className="ml-2 text-xs text-yellow-400">⚠ {inconsistentCount} 项不一致</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-sm px-1"
        >
          ✕
        </button>
      </div>

      {/* 时间戳 */}
      {log?.extracted_at && (
        <div className="px-3 py-1.5 border-b border-gray-800">
          <span className="text-xs text-gray-600">
            提取时间：{new Date(log.extracted_at).toLocaleString('zh-CN')}
          </span>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">加载中…</span>
          </div>
        ) : !log || log.clusters.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-600">
            暂无聚类记录，请先提取资产
          </div>
        ) : (
          log.clusters.map((entry) => (
            <ClusterRow key={entry.asset_id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}
