import { type GlobalSettings, type SpecialPrompt } from '../../api/prompts'
import { type Asset } from '../../api/assets'

interface GroupedAssets {
  characters: Asset[]
  scenes: Asset[]
  props: Asset[]
}

interface ParamsPanelProps {
  settings: GlobalSettings | null
  referenceImages: string[]
  onSetReferenceImages: (images: string[]) => void
  globalPrompt: string
  finalVideoPrompt: string
  currentShotId: string | null
  allAssets: Asset[]
  groupedAssets: GroupedAssets
}

export default function ParamsPanel({
  settings,
  referenceImages,
  onSetReferenceImages,
  globalPrompt,
  finalVideoPrompt,
  currentShotId,
  allAssets,
  groupedAssets,
}: ParamsPanelProps) {
  // 按顺序合并资产图（人物→场景→道具）
  const allAssetImages = [
    ...groupedAssets.characters.map((a) => ({ asset_id: a.asset_id, name: a.name, type: '人物', image: a.images?.[0] || null })),
    ...groupedAssets.scenes.map((a) => ({ asset_id: a.asset_id, name: a.name, type: '场景', image: a.images?.[0] || null })),
    ...groupedAssets.props.map((a) => ({ asset_id: a.asset_id, name: a.name, type: '道具', image: a.images?.[0] || null })),
  ]

  // 生成锚定声明（按人物→场景→道具顺序）
  const generateAnchorDeclaration = () => {
    if (referenceImages.length === 0) return ''
    return referenceImages
      .map((img, i) => {
        const asset = allAssetImages.find((a) => a.image === img)
        return asset ? `图${i + 1}是${asset.name}` : null
      })
      .filter(Boolean)
      .join('，')
  }

  const anchorDeclaration = generateAnchorDeclaration()

  // 选择/取消选择参考图（保持类型顺序）
  const toggleReferenceImage = (image: string) => {
    if (referenceImages.includes(image)) {
      onSetReferenceImages(referenceImages.filter((img) => img !== image))
    } else if (referenceImages.length < 6) {
      const newImages = [...referenceImages, image]
      // 按类型排序：人物→场景→道具
      const sorted = newImages.sort((a, b) => {
        const assetA = allAssetImages.find((x) => x.image === a)
        const assetB = allAssetImages.find((x) => x.image === b)
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
      {/* 模型选择 */}
      <div className="p-2 border-b">
        <label className="text-sm font-medium">生成模型</label>
        <select className="w-full mt-1 border rounded px-2 py-1 text-sm focus:outline-none" value={settings?.default_model || 'seedance2.0'}>
          <option value="seedance2.0">Seedance 2.0</option>
          <option value="seedance2.0_fast">Seedance 2.0 Fast</option>
        </select>
      </div>

      {/* 参考图选择 */}
      <div className="p-2 border-b">
        <label className="text-sm font-medium">参考图 ({referenceImages.length}/6)</label>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {allAssetImages.slice(0, 18).map((asset) => (
            <button
              key={asset.asset_id}
              onClick={() => asset.image && toggleReferenceImage(asset.image)}
              disabled={!asset.image}
              className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                referenceImages.includes(asset.image || '') ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-gray-300'
              } ${!asset.image ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {asset.image ? (
                <img src={asset.image} alt={asset.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">{asset.name.slice(0, 2)}</div>
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
                const asset = allAssetImages.find((a) => a.image === img)
                return (
                  <div
                    key={img}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, i)}
                    className="relative w-10 h-10 rounded overflow-hidden border cursor-move hover:border-blue-400"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/50 text-white text-xs px-1">{i + 1}</span>
                    <span className="absolute top-0 left-0 bg-black/50 text-white text-xs px-0.5 rounded-br">{asset?.type?.slice(0, 1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 锚定声明预览 */}
      <div className="p-2 border-b">
        <label className="text-sm font-medium">锚定声明</label>
        <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600 min-h-[40px]">{anchorDeclaration || '未选择参考图'}</div>
      </div>

      {/* 全局提示词预览 */}
      <div className="p-2 border-b">
        <label className="text-sm font-medium">全局提示词</label>
        <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600 min-h-[60px] overflow-auto">{globalPrompt || '未配置'}</div>
      </div>

      {/* 最终提示词预览 */}
      <div className="p-2 border-b flex-1 overflow-auto">
        <label className="text-sm font-medium">最终提示词预览</label>
        <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600 min-h-[100px] whitespace-pre-wrap overflow-auto">{finalVideoPrompt || '请选择镜头'}</div>
      </div>

      {/* 生成参数 */}
      <div className="p-2 border-b">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="text-gray-500">时长</label>
            <select className="w-full mt-1 border rounded px-1 py-1 text-sm focus:outline-none">
              <option>{settings?.default_duration || 4}秒</option>
              <option>3秒</option>
              <option>5秒</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500">分辨率</label>
            <select className="w-full mt-1 border rounded px-1 py-1 text-sm focus:outline-none">
              <option>{settings?.default_resolution || '1080p'}</option>
              <option>720p</option>
              <option>4K</option>
            </select>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="p-2">
        <button disabled={!currentShotId} className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-300">
          {currentShotId ? `生成镜头 ${currentShotId}` : '请选择镜头'}
        </button>
        <div className="mt-2 flex gap-1">
          <button disabled={!currentShotId} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50">
            批量生成 G01（Phase 8）
          </button>
        </div>
      </div>
    </div>
  )
}