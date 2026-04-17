import { useState } from 'react'
import {
  type Shot,
  type ShotGroup,
  type ShotType,
  type ShotSize,
  type CameraMove,
  type ShotUpdatePayload,
  type SpeechLine,
} from '../../api/shots'

// 枚举选项
const SHOT_TYPES: ShotType[] = ['空境', '对话', '行动冲突', '打斗', '调度']
const SHOT_SIZES: ShotSize[] = ['大远景', '远景', '全景', '中景', '中近景', '近景', '特写']
const CAMERA_MOVES: CameraMove[] = [
  '固定',
  '缓慢推进',
  '快速推进',
  '缓慢拉开',
  '快速拉开',
  '缓慢横移',
  '缓慢左摇',
  '缓慢右摇',
  '跟随',
  '手持跟随',
  '缓慢升起',
  '缓慢下降',
  '缓慢环绕',
  '快速环绕',
  '快速摇摄',
]

interface ShotEditPanelProps {
  shot: Shot
  groups: ShotGroup[]
  onClose: () => void
  onSave: (shotId: string, updates: ShotUpdatePayload) => Promise<void>
  onChangeGroup: (shotId: string, groupId: string) => Promise<void>
}

export default function ShotEditPanel({
  shot,
  groups,
  onClose,
  onSave,
  onChangeGroup,
}: ShotEditPanelProps) {
  const [saving, setSaving] = useState(false)

  // 编辑状态
  const [shotType, setShotType] = useState<ShotType>(shot.shot_type)
  const [shotSize, setShotSize] = useState<ShotSize>(shot.shot_size)
  const [cameraMove, setCameraMove] = useState<CameraMove>(shot.camera_move)
  const [frameAction, setFrameAction] = useState(shot.frame_action)
  const [lighting, setLighting] = useState(shot.lighting ?? '')
  const [screenText, setScreenText] = useState(shot.screen_text ?? '')
  const [speech, setSpeech] = useState<SpeechLine[]>(shot.speech)
  const [groupId, setGroupId] = useState(shot.group_id)
  const [assets, setAssets] = useState<string[]>(shot.assets)
  const [timeOfDay, setTimeOfDay] = useState(shot.time_of_day ?? '')
  const [groupWarning, setGroupWarning] = useState<string | null>(null)

  // 计算新组时长并显示警告
  const calculateNewGroupDuration = (newGroupId: string) => {
    const targetGroup = groups.find(g => g.group_id === newGroupId)
    if (!targetGroup) {
      setGroupWarning(null)
      return
    }
    // 新组时长 = 当前组时长（不含当前镜头）+ 当前镜头时长
    const currentShotInGroup = targetGroup.shots.includes(shot.shot_id)
    const baseDuration = currentShotInGroup ? targetGroup.total_duration - shot.duration : targetGroup.total_duration
    const newDuration = baseDuration + shot.duration

    if (newDuration > 17) {
      setGroupWarning(`⚠️ 新组时长将达到 ${newDuration.toFixed(1)}s，严重超出限制`)
    } else if (newDuration > 15) {
      setGroupWarning(`⚠️ 新组时长将达到 ${newDuration.toFixed(1)}s，接近上限`)
    } else {
      setGroupWarning(null)
    }
  }

  const handleGroupIdChange = (newGroupId: string) => {
    setGroupId(newGroupId)
    calculateNewGroupDuration(newGroupId)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: ShotUpdatePayload = {
        shot_type: shotType,
        shot_size: shotSize,
        camera_move: cameraMove,
        frame_action: frameAction,
        lighting: lighting || undefined,
        screen_text: screenText || undefined,
        speech: speech.length > 0 ? speech : undefined,
        assets: assets.length > 0 ? assets : undefined,
        time_of_day: timeOfDay || undefined,
      }
      await onSave(shot.shot_id, updates)
    } finally {
      setSaving(false)
    }
  }

  const handleGroupChange = async () => {
    if (groupId !== shot.group_id) {
      setSaving(true)
      try {
        await onChangeGroup(shot.shot_id, groupId)
      } finally {
        setSaving(false)
      }
    }
  }

  // 台词管理
  const addSpeechLine = () => {
    setSpeech([...speech, { type: 'dialogue', speaker: '', text: '' }])
  }

  const removeSpeechLine = (index: number) => {
    setSpeech(speech.filter((_, i) => i !== index))
  }

  const updateSpeechLine = (index: number, field: keyof SpeechLine, value: string) => {
    setSpeech(speech.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  return (
    <div className="w-80 border-l bg-white overflow-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <span className="font-medium">编辑镜头 {shot.shot_id}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* 内容 */}
      <div className="p-4 space-y-4">
        {/* 基本信息（只读） */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">编号</span>
            <span>{shot.shot_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">时长</span>
            <span>{shot.duration.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">时段</span>
            <span>
              {shot.time_range.start_sec.toFixed(1)}-{shot.time_range.end_sec.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* 组归属 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">组归属</label>
          <select
            value={groupId}
            onChange={(e) => handleGroupIdChange(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.group_id} ({g.total_duration.toFixed(1)}s)
              </option>
            ))}
          </select>
          {groupId !== shot.group_id && (
            <button
              onClick={handleGroupChange}
              disabled={saving}
              className="w-full px-3 py-1 bg-yellow-500 text-white rounded text-sm disabled:bg-gray-300"
            >
              {saving ? '调整中...' : '调整归组'}
            </button>
          )}
          {groupWarning && (
            <p className="text-xs text-red-500 mt-1">{groupWarning}</p>
          )}
        </div>

        {/* 镜头类型 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">镜头类型</label>
          <select
            value={shotType}
            onChange={(e) => setShotType(e.target.value as ShotType)}
            className="w-full border rounded px-2 py-1"
          >
            {SHOT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 景别 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">景别</label>
          <select
            value={shotSize}
            onChange={(e) => setShotSize(e.target.value as ShotSize)}
            className="w-full border rounded px-2 py-1"
          >
            {SHOT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* 运镜 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">运镜</label>
          <select
            value={cameraMove}
            onChange={(e) => setCameraMove(e.target.value as CameraMove)}
            className="w-full border rounded px-2 py-1"
          >
            {CAMERA_MOVES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* 画面内容 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">画面内容</label>
          <textarea
            value={frameAction}
            onChange={(e) => setFrameAction(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        {/* 光影 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">光影</label>
          <input
            type="text"
            value={lighting}
            onChange={(e) => setLighting(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        {/* 画面内文字 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">画面内文字</label>
          <input
            type="text"
            value={screenText}
            onChange={(e) => setScreenText(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        {/* 资产引用 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">资产引用</label>
          <input
            type="text"
            value={assets.join(', ')}
            onChange={(e) => setAssets(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
            placeholder="逗号分隔的资产ID"
            className="w-full border rounded px-2 py-1"
          />
          <p className="text-xs text-gray-400">如：char_001, scene_001, prop_001</p>
        </div>

        {/* 场景时间氛围 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">场景时间氛围</label>
          <input
            type="text"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            placeholder="如：白天、夜晚、黄昏"
            className="w-full border rounded px-2 py-1"
          />
        </div>

        {/* 台词 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">台词</label>
          <div className="space-y-2">
            {speech.map((s, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={s.speaker}
                  onChange={(e) => updateSpeechLine(index, 'speaker', e.target.value)}
                  placeholder="说话人"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  value={s.text}
                  onChange={(e) => updateSpeechLine(index, 'text', e.target.value)}
                  placeholder="台词内容"
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={() => removeSpeechLine(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addSpeechLine}
              className="w-full px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
            >
              + 添加台词
            </button>
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}