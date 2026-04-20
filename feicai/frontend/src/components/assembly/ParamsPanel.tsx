import { type GlobalSettings } from '../../api/prompts'
import { type Asset, getImageUrl } from '../../api/assets'
import { type ShotGroup } from '../../api/shots'

interface GroupedAssets {
  characters: Asset[]
  scenes: Asset[]
  props: Asset[]
}

interface ParamsPanelProps {
  projectId: number
  settings: GlobalSettings | null
  referenceImages: string[]
  onSetReferenceImages: (images: string[]) => void
  globalPrompt: string
  finalVideoPrompt: string
  currentShotId: string | null
  currentGroup: ShotGroup | null
  groupedAssets: GroupedAssets
  onGenerateVideo?: () => void
  videoGenerating?: boolean
}

export default function ParamsPanel({
  projectId,
  settings,
  referenceImages,
  onSetReferenceImages,
  globalPrompt,
  finalVideoPrompt,
  currentShotId,
  currentGroup,
  groupedAssets,
  onGenerateVideo,
  videoGenerating = false,
}: ParamsPanelProps) {
  // Build asset image list using proper API URLs (not raw filesystem paths)
  const allAssetImages = [
    ...groupedAssets.characters.map((a) => ({
      asset_id: a.asset_id,
      name: a.name,
      type: '人物' as const,
      asset_type: a.asset_type,
      hasImage: a.images.length > 0,
      imageUrl: a.images.length > 0 ? getImageUrl(projectId, a.asset_type, a.asset_id, 1) : null,
    })),
    ...groupedAssets.scenes.map((a) => ({
      asset_id: a.asset_id,
      name: a.name,
      type: '场景' as const,
      asset_type: a.asset_type,
      hasImage: a.images.length > 0,
      imageUrl: a.images.length > 0 ? getImageUrl(projectId, a.asset_type, a.asset_id, 1) : null,
    })),
    ...groupedAssets.props.map((a) => ({
      asset_id: a.asset_id,
      name: a.name,
      type: '道具' as const,
      asset_type: a.asset_type,
      hasImage: a.images.length > 0,
      imageUrl: a.images.length > 0 ? getImageUrl(projectId, a.asset_type, a.asset_id, 1) : null,
    })),
  ]

  // 生成锚定声明（按人物→场景→道具顺序）
  const generateAnchorDeclaration = () => {
    if (referenceImages.length === 0) return ''
    return referenceImages
      .map((img, i) => {
        const asset = allAssetImages.find((a) => a.imageUrl === img)
        return asset ? `图${i + 1}是${asset.name}` : null
      })
      .filter(Boolean)
      .join('，')
  }

  const anchorDeclaration = generateAnchorDeclaration()

  // 选择/取消选择参考图（保持类型顺序）
  const toggleReferenceImage = (imageUrl: string) => {
    if (referenceImages.includes(imageUrl)) {
      onSetReferenceImages(referenceImages.filter((img) => img !== imageUrl))
    } else if (referenceImages.length < 6) {
      const newImages = [...referenceImages, imageUrl]
      // 按类型排序：人物→场景→道具
      const sorted = newImages.sort((a, b) => {
        const assetA = allAssetImages.find((x) => x.imageUrl === a)
        const assetB = allAssetImages.find((x) => x.imageUrl === b)
        if (!assetA || !assetB) return 0
        const typeOrder: Record<string, number> = { '人物': 0, '场景': 1, '道具': 2 }
        return typeOrder[assetA.type] - typeOrder[assetB.type]
      })
      onSetReferenceImages(sorted)
    }
  }

  // 拖拽排序
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (sourceIndex === targetIndex) return
    const newImages = [...referenceImages]
    const [removed] = newImages.splice(sourceIndex, 1)
    newImages.splice(targetIndex, 0, removed)
    onSetReferenceImages(newImages)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 当前组信息 */}
      {currentGroup && (
        <div className="p-2 border-b border-gray-800 text-xs text-gray-400 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-gray-300">{currentGroup.group_id}</span>
            <span>时长: {currentGroup.total_duration.toFixed(1)}s</span>
          </div>
          {currentGroup.scene_context && (
            <div className="text-gray-500">{currentGroup.scene_context}</div>
          )}
        </div>
      )}

      {/* 模型选择 */}
      <div className="p-2 border-b border-gray-800">
        <label className="text-sm font-medium">生成模型</label>
        <select className="w-full mt-1 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none bg-gray-800 text-gray-200" value={settings?.default_model || 'seedance2.0'}>
          <option value="seedance2.0">Seedance 2.0</option>
          <option value="seedance2.0_fast">Seedance 2.0 Fast</option>
        </select>
      </div>

      {/* 参考图选择 */}
      <div className="p-2 border-b border-gray-800">
        <label className="text-sm font-medium">参考图 ({referenceImages.length}/6)</label>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {allAssetImages.slice(0, 24).map((asset) => (
            <button
              key={asset.asset_id}
              onClick={() => asset.imageUrl && toggleReferenceImage(asset.imageUrl)}
              disabled={!asset.hasImage}
              className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                referenceImages.includes(asset.imageUrl || '') ? 'border-blue-500 bg-blue-900/30' : 'border-transparent hover:border-gray-600'
              } ${!asset.hasImage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">{asset.name.slice(0, 2)}</div>
              )}
            </button>
          ))}
        </div>

        {/* 已选参考图（可拖拽排序） */}
        {referenceImages.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">拖拽调整顺序（人物→场景→道具）</div>
            <div className="flex flex-wrap gap-1">
              {referenceImages.map((img, i) => {
                const asset = allAssetImages.find((a) => a.imageUrl === img)
                return (
                  <div
                    key={img}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, i)}
                    className="relative w-8 h-8 rounded overflow-hidden border cursor-move hover:border-blue-400"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/50 text-white text-xs px-0.5">{i + 1}</span>
                    <span className="absolute top-0 left-0 bg-black/50 text-white text-xs px-0.5 rounded-br">{asset?.type?.slice(0, 1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 锚定声明预览 */}
      <div className="p-2 border-b border-gray-800">
        <label className="text-sm font-medium">锚定声明</label>
        <div className="mt-1 p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 min-h-[40px]">{anchorDeclaration || '未选择参考图'}</div>
      </div>

      {/* 全局提示词预览 */}
      <div className="p-2 border-b border-gray-800">
        <label className="text-sm font-medium">全局提示词</label>
        <div className="mt-1 p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 min-h-[60px] overflow-auto">{globalPrompt || '未配置'}</div>
      </div>

      {/* 最终提示词预览 */}
      <div className="p-2 border-b flex-1 overflow-auto">
        <label className="text-sm font-medium">最终提示词预览</label>
        <div className="mt-1 p-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 min-h-[100px] whitespace-pre-wrap overflow-auto">{finalVideoPrompt || '请选择镜头'}</div>
      </div>

      {/* 生成参数 */}
      <div className="p-2 border-b border-gray-800">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="text-gray-500">时长</label>
            <select className="w-full mt-1 border border-gray-700 rounded px-1 py-1 text-sm focus:outline-none bg-gray-800 text-gray-200">
              <option>{settings?.default_duration || 4}秒</option>
              <option>3秒</option>
              <option>5秒</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400">分辨率</label>
            <select className="w-full mt-1 border border-gray-700 rounded px-1 py-1 text-sm focus:outline-none bg-gray-800 text-gray-200">
              <option>{settings?.default_resolution || '1080p'}</option>
              <option>720p</option>
              <option>4K</option>
            </select>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="p-2">
        <button
          onClick={onGenerateVideo}
          disabled={!currentShotId || videoGenerating}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-700"
        >
          {videoGenerating ? '生成中...' : currentShotId ? `生成镜头 ${currentShotId}` : '请选择镜头'}
        </button>
        <div className="mt-2 flex gap-1">
          <button disabled={!currentShotId} className="flex-1 py-1 text-xs bg-gray-700 text-gray-400 rounded hover:bg-gray-600 disabled:opacity-50">
            批量生成 G01（Phase 8）
          </button>
        </div>
      </div>
    </div>
  )
}