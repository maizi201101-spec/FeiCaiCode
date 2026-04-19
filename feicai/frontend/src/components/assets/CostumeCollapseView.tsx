import { useState } from 'react'

interface CharacterCostume {
  name: string
  costumes: string[]
  episodes: string[]
}

interface CostumeCollapseViewProps {
  collapsedData: {
    characters: CharacterCostume[]
    scenes: Array<{ name: string; episodes: string[] }>
    props: Array<{ name: string; episodes: string[] }>
  }
  onConfirm: () => void
  onCancel: () => void
}

export default function CostumeCollapseView({
  collapsedData,
  onConfirm,
  onCancel,
}: CostumeCollapseViewProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const toggleItem = (key: string) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setSelectedItems(newSet)
  }

  const allKeys = collapsedData.characters.flatMap((char) =>
    char.costumes.map((costume) => `${char.name}:${costume}`)
  )

  const toggleAll = () => {
    if (selectedItems.size === allKeys.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(allKeys))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[800px] max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">装扮坍缩确认</h2>
          <p className="text-sm text-gray-400 mt-1">
            从分镜中提取到以下角色装扮组合，确认后将创建对应的 variant
          </p>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 全选 */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedItems.size === allKeys.length && allKeys.length > 0}
              onChange={toggleAll}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-300">全选</span>
          </div>

          {/* 角色列表 */}
          <div className="space-y-4">
            {collapsedData.characters.map((char) => (
              <div key={char.name} className="bg-gray-900 rounded p-4">
                <div className="text-white font-medium mb-2">{char.name}</div>
                <div className="space-y-2">
                  {char.costumes.map((costume) => {
                    const key = `${char.name}:${costume}`
                    const isSelected = selectedItems.has(key)
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(key)}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-300">{costume}</span>
                        <span className="text-gray-500 text-xs">
                          {char.episodes.join(', ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 场景和道具统计 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded p-4">
              <div className="text-gray-400 text-sm mb-2">场景</div>
              <div className="text-white text-2xl font-semibold">
                {collapsedData.scenes.length}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-4">
              <div className="text-gray-400 text-sm mb-2">道具</div>
              <div className="text-white text-2xl font-semibold">
                {collapsedData.props.length}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedItems.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            确认创建 ({selectedItems.size} 个装扮)
          </button>
        </div>
      </div>
    </div>
  )
}
