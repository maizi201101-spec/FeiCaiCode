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
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <p className="text-lg mb-2">暂无资产</p>
        <p className="text-sm mb-4">点击「提取资产」从剧本自动提取，或点击「新增」手动添加</p>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-4">
      {assets.map((asset) => (
        <AssetCard
          key={`${asset.asset_type}-${asset.asset_id}`}
          asset={asset}
          projectId={projectId}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
      {/* 新增资产卡片 */}
      <div
        onClick={onAddClick}
        className="bg-gray-800/50 border border-gray-700/50 rounded-lg h-[112px] flex items-center justify-center cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-colors"
      >
        <div className="text-center text-gray-500">
          <p className="text-2xl mb-1">+</p>
          <p className="text-sm">新增资产</p>
        </div>
      </div>
    </div>
  )
}