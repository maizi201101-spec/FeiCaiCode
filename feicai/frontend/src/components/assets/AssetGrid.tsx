import { useState } from 'react'
import type { Asset, AssetType, AssetUpdatePayload } from '../../api/assets'
import AssetCard from './AssetCard'

interface AssetGridProps {
  assets: Asset[]
  projectId: number
  onUpdate: (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => Promise<Asset>
  onDelete: (assetType: AssetType, assetId: string) => Promise<void>
  onAddClick: () => void
}

export default function AssetGrid({ assets, projectId, onUpdate, onDelete, onAddClick }: AssetGridProps) {
  const [zoomEnabled, setZoomEnabled] = useState(true)

  // 将变体展开为同级条目
  const flatItems = assets.flatMap((asset) => {
    const base = [{ asset, displayName: undefined as string | undefined, variantDesc: undefined as string | undefined, key: `${asset.asset_type}-${asset.asset_id}-base` }]
    if (asset.asset_type === 'character' && asset.variants.length > 0) {
      const variants = asset.variants.map((v) => ({
        asset,
        displayName: `${asset.name} · ${v.variant_name}`,
        variantDesc: v.visual_diff || v.trigger_condition || undefined,
        key: `${asset.asset_type}-${asset.asset_id}-${v.variant_id}`,
      }))
      return [...base, ...variants]
    }
    return base
  })

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <p className="text-lg mb-2">暂无资产</p>
        <p className="text-sm mb-4">点击「全集批量提取」或点击「新增」手动添加</p>
        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
        >
          + 新增资产
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* 控制栏 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-500">
        <button
          onClick={() => setZoomEnabled(!zoomEnabled)}
          className={`hover:text-gray-300 ${zoomEnabled ? 'text-indigo-400' : ''}`}
        >
          {zoomEnabled ? '放大显示 ✓' : '放大显示'}
        </button>
        <span className="ml-auto text-gray-600">{flatItems.length} 项</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {flatItems.map((item) => (
          <AssetCard
            key={item.key}
            asset={item.asset}
            projectId={projectId}
            displayName={item.displayName}
            variantDesc={item.variantDesc}
            onUpdate={onUpdate}
            onDelete={onDelete}
            zoomEnabled={zoomEnabled}
          />
        ))}
        {/* 新增资产卡片 */}
        <div
          onClick={onAddClick}
          className="bg-gray-800/50 border border-gray-700/50 rounded-lg min-h-[200px] flex items-center justify-center cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors"
        >
          <div className="text-center text-gray-500">
            <p className="text-2xl mb-1">+</p>
            <p className="text-sm">新增资产</p>
          </div>
        </div>
      </div>
    </div>
  )
}
