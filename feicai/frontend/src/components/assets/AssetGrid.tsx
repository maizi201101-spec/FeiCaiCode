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
  const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null)
  const [globalVariantsExpanded, setGlobalVariantsExpanded] = useState<boolean | null>(null)

  const hasVariants = assets.some((a) => a.variants.length > 0)

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <p className="text-lg mb-2">暂无资产</p>
        <p className="text-sm mb-4">点击「从分镜提取」或点击「新增」手动添加</p>
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
      {/* 全局展开/收起控制栏 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-500">
        <span>资产卡片：</span>
        <button
          onClick={() => setGlobalExpanded(true)}
          className="hover:text-gray-300 transition-colors"
        >
          全部展开
        </button>
        <button
          onClick={() => setGlobalExpanded(false)}
          className="hover:text-gray-300 transition-colors"
        >
          全部收起
        </button>
        <button
          onClick={() => setGlobalExpanded(null)}
          className="hover:text-gray-300 transition-colors"
        >
          独立控制
        </button>
        {hasVariants && (
          <>
            <span className="ml-4">变体：</span>
            <button
              onClick={() => setGlobalVariantsExpanded(true)}
              className="hover:text-gray-300 transition-colors"
            >
              全部展开
            </button>
            <button
              onClick={() => setGlobalVariantsExpanded(false)}
              className="hover:text-gray-300 transition-colors"
            >
              全部收起
            </button>
            <button
              onClick={() => setGlobalVariantsExpanded(null)}
              className="hover:text-gray-300 transition-colors"
            >
              独立控制
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-4">
        {assets.map((asset) => (
          <AssetCard
            key={`${asset.asset_type}-${asset.asset_id}`}
            asset={asset}
            projectId={projectId}
            onUpdate={onUpdate}
            onDelete={onDelete}
            forceExpanded={globalExpanded}
            forceVariantsExpanded={globalVariantsExpanded}
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
    </div>
  )
}