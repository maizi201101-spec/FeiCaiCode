import { useState, useRef } from 'react'
import type { Variant, AssetType } from '../../api/assets'
import {
  uploadAssetImage,
  generateAssetImage,
  getImageUrl,
  getAssetImages,
  type AssetImage,
} from '../../api/assets'
import { pollTaskStatus } from '../../hooks/useTaskPolling'

interface AssetVariantRowProps {
  variant: Variant
  projectId: number
  assetType: AssetType
  assetId: string
}

export default function AssetVariantRow({ variant, projectId, assetType, assetId }: AssetVariantRowProps) {
  const [images, setImages] = useState<AssetImage[]>([])
  const [loadedImages, setLoadedImages] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // variant 使用 assetId 作为图片容器（variant 的图存在同一资产目录下，用 variant_id 区分暂不支持）
  // 简化处理：variant 行显示触发条件和视觉差异，提供上传入口（上传到父资产）
  const loadImages = async () => {
    if (loadedImages) return
    try {
      const result = await getAssetImages(projectId, assetType, assetId)
      setImages(result.images)
      setLoadedImages(true)
    } catch {
      // silent
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadAssetImage(projectId, assetType, assetId, file)
      const result = await getAssetImages(projectId, assetType, assetId)
      setImages(result.images)
      setLoadedImages(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await generateAssetImage(projectId, assetType, assetId)
      await pollTaskStatus(result.task_id, {
        interval: 2000,
        maxAttempts: 60,
        onProgress: () => {},
        onComplete: () => {},
        onFailed: () => {},
      })
      const imgs = await getAssetImages(projectId, assetType, assetId)
      setImages(imgs.images)
      setLoadedImages(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI 生图失败')
    } finally {
      setGenerating(false)
    }
  }

  const latestImageUrl = images.length > 0
    ? getImageUrl(projectId, assetType, assetId, images[images.length - 1].index)
    : null

  return (
    <div
      className="ml-4 pl-3 border-l border-gray-700 py-2 flex gap-3 items-start group"
      onMouseEnter={loadImages}
    >
      {/* 左：图片（尺寸与主卡片一致）*/}
      <div
        className="shrink-0 bg-gray-900 rounded flex items-center justify-center overflow-hidden"
        style={{ width: 80, height: 56 }}
      >
        {latestImageUrl ? (
          <img src={latestImageUrl} alt={variant.variant_name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-gray-700">无图</span>
        )}
      </div>

      {/* 右：文字 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-300">{variant.variant_name}</p>
        {variant.visual_diff && (
          <p className="text-xs text-gray-500">{variant.visual_diff}</p>
        )}
        {variant.trigger_condition && (
          <p className="text-xs text-gray-600">触发：{variant.trigger_condition}</p>
        )}
      </div>

      {/* 操作按钮（hover 显示） */}
      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {uploading ? '…' : '上传'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs px-1.5 py-0.5 bg-emerald-900/60 text-emerald-400 rounded hover:bg-emerald-800 disabled:opacity-50"
        >
          {generating ? '…' : 'AI'}
        </button>
      </div>
    </div>
  )
}
