import { type Shot, type ShotGroup, getDurationColor } from '../../api/shots'

interface ShotTableProps {
  shots: Shot[]
  groups: ShotGroup[]
  onEditShot?: (shotId: string) => void
}

export default function ShotTable({ shots, groups, onEditShot }: ShotTableProps) {
  // 获取组的颜色
  const getGroupColor = (groupId: string) => {
    const group = groups.find((g) => g.group_id === groupId)
    if (!group) return 'gray'
    return getDurationColor(group.total_duration)
  }

  // 台词摘要
  const getSpeechSummary = (speech: Shot['speech']) => {
    if (!speech || speech.length === 0) return '-'
    return speech.map((s) => `${s.speaker}: ${s.text}`).join('; ')
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-gray-800 sticky top-0">
        <tr>
          <th className="border border-gray-700 px-2 py-1 text-left w-12 text-gray-300">编号</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-16 text-gray-300">时段</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-16 text-gray-300">组</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-12 text-gray-300">类型</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-12 text-gray-300">景别</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-16 text-gray-300">运镜</th>
          <th className="border border-gray-700 px-2 py-1 text-left text-gray-300">画面内容</th>
          <th className="border border-gray-700 px-2 py-1 text-left text-gray-300">台词</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-12 text-gray-300">状态</th>
          <th className="border border-gray-700 px-2 py-1 text-left w-12 text-gray-300">操作</th>
        </tr>
      </thead>
      <tbody>
        {shots.map((shot) => {
          const groupColor = getGroupColor(shot.group_id)
          const timeStr = `${shot.time_range.start_sec.toFixed(1)}-${shot.time_range.end_sec.toFixed(1)}s`
          const speechSummary = getSpeechSummary(shot.speech)

          return (
            <tr
              key={shot.shot_id}
              className={`border-b border-gray-800 ${onEditShot ? 'hover:bg-gray-800 cursor-pointer' : ''}`}
              onClick={() => onEditShot?.(shot.shot_id)}
            >
              <td className="border border-gray-800 px-2 py-1">{shot.shot_id}</td>
              <td className="border border-gray-800 px-2 py-1">{timeStr}</td>
              <td className="border border-gray-800 px-2 py-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    groupColor === 'green'
                      ? 'bg-green-900/50 text-green-400'
                      : groupColor === 'yellow'
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}
                >
                  {shot.group_id}
                </span>
              </td>
              <td className="border border-gray-800 px-2 py-1">{shot.shot_type}</td>
              <td className="border border-gray-800 px-2 py-1">{shot.shot_size}</td>
              <td className="border border-gray-800 px-2 py-1">{shot.camera_move}</td>
              <td className="border border-gray-800 px-2 py-1 truncate max-w-xs">{shot.frame_action}</td>
              <td className="border border-gray-800 px-2 py-1 truncate max-w-xs">{speechSummary}</td>
              <td className="border border-gray-800 px-2 py-1">
                <span className="text-gray-400">待生成</span>
              </td>
              <td className="border border-gray-800 px-2 py-1">
                {onEditShot && (
                  <button
                    className="text-blue-400 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditShot(shot.shot_id)
                    }}
                  >
                    编辑
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}