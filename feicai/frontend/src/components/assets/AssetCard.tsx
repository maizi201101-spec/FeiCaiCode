import { useState, useEffect, useRef } from 'react'
import type { Asset, AssetType, AssetUpdatePayload } from '../../api/assets'
import {
  uploadAssetImage,
  generateAssetImage,
  getAssetImages,
  deleteAssetImage,
  setPrimaryImage,
  getImageUrl,
  type AssetImage,
} from '../../api/assets'
import { pollTaskStatus } from '../../hooks/useTaskPolling'

interface AssetCardProps {
  asset: Asset
  projectId: number
  onUpdate: (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => Promise<Asset>
  onDelete: (assetType: AssetType, assetId: string) => Promise<void>
}

export default function AssetCard({
  asset,
  projectId,
  onUpdate,
  onDelete,
}: AssetCardProps) {
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState(asset.name)
  const [editedAppearance, setEditedAppearance] = useState(asset.appearance || '')
  const [editedDescription, setEditedDescription] = useState(asset.description || '')
  const [saving, setSaving] = useState(false)

  // 图片状态
  const [images, setImages] = useState<AssetImage[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(1)
  const [loadingImages, setLoadingImages] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载图片列表
  const loadImages = async () => {
    setLoadingImages(true)
    try {
      const result = await getAssetImages(projectId, asset.asset_type, asset.asset_id)
      setImages(result.images)
      if (result.images.length > 0) {
        setCurrentImageIndex(1) // 默认显示主图
      }
    } catch (e) {
      console.error('加载图片失败', e)
    } finally {
      setLoadingImages(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [projectId, asset.asset_type, asset.asset_id])

  // 上传图片
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await uploadAssetImage(projectId, asset.asset_type, asset.asset_id, file)
      await loadImages()
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // AI 生图
  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratingProgress('创建任务...')

    try {
      const result = await generateAssetImage(projectId, asset.asset_type, asset.asset_id)
      const taskId = result.task_id

      // 开始轮询
      await pollTaskStatus(taskId, {
        interval: 2000,
        maxAttempts: 60,
        onProgress: (status) => {
          setGeneratingProgress(`状态: ${status.status}`)
        },
        onComplete: () => {
          setGeneratingProgress('生成完成')
        },
        onFailed: (error) => {
          setGeneratingProgress(`失败: ${error}`)
        },
      })

      // 重新加载图片
      await loadImages()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI 生图失败')
    } finally {
      setGenerating(false)
      setGeneratingProgress('')
    }
  }

  // 删除图片
  const handleDeleteImage = async () => {
    if (!confirm(`确定删除第 ${currentImageIndex} 张图片？`)) return

    try {
      await deleteAssetImage(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      await loadImages()
      // 如果删除的是当前图片，切换到第一张
      if (images.length > 1) {
        setCurrentImageIndex(1)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  // 设为主图
  const handleSetPrimary = async () => {
    if (currentImageIndex === 1) return // 已经是主图

    try {
      await setPrimaryImage(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      await loadImages()
      setCurrentImageIndex(1) // 切换到主图
    } catch (e) {
      alert(e instanceof Error ? e.message : '设置主图失败')
    }
  }

  // 保存描述
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: AssetUpdatePayload = {
        name: editedName,
      }
      if (asset.asset_type === 'character') {
        payload.appearance = editedAppearance
      } else {
        payload.description = editedDescription
      }
      await onUpdate(asset.asset_type, asset.asset_id, payload)
      setEditing(false)
    } catch (e) {
      console.error('保存失败', e)
    } finally {
      setSaving(false)
    }
  }

  // 删除资产
  const handleDelete = async () => {
    if (!confirm('确定删除此资产？')) return
    await onDelete(asset.asset_type, asset.asset_id)
  }

  const typeLabel = {
    character: '角色',
    scene: '场景',
    prop: '道具',
  }

  const typeColor = {
    character: 'bg-blue-900/50 text-blue-300',
    scene: 'bg-amber-900/50 text-amber-300',
    prop: 'bg-emerald-900/50 text-emerald-300',
  }

  // 获取当前图片 URL
  const currentImageUrl =
    images.length > 0
      ? getImageUrl(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      : null

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* 设定图区域 */}
      <div className="h-40 bg-gray-900 flex items-center justify-center relative">
        {loadingImages ? (
          <span className="text-sm text-gray-500">加载中...</span>
        ) : generating ? (
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
            <span className="text-xs text-gray-400">{generatingProgress}</span>
          </div>
        ) : currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm text-gray-600">暂无设定图</span>
        )}

        {/* 版本切换下拉 */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2">
            <select
              value={currentImageIndex}
              onChange={(e) => setCurrentImageIndex(Number(e.target.value))}
              className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
            >
              {images.map((img) => (
                <option key={img.index} value={img.index}>
                  v{img.index} {img.is_primary ? '(主图)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 上传按钮 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {/* 资产信息 */}
      <div className="p-4">
        {/* 类型标签 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded ${typeColor[asset.asset_type]}`}>
            {typeLabel[asset.asset_type]}
          </span>
          <span className="text-xs text-gray-500">{asset.asset_id}</span>
          {images.length > 0 && (
            <span className="text-xs text-gray-600">{images.length} 张图</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              placeholder="名称"
            />
            {asset.asset_type === 'character' && (
              <textarea
                value={editedAppearance}
                onChange={(e) => setEditedAppearance(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white resize-none"
                rows={3}
                placeholder="外貌描述"
              />
            )}
            {asset.asset_type !== 'character' && (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white resize-none"
                rows={3}
                placeholder="描述"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-medium text-white mb-1">{asset.name}</p>

            {asset.asset_type === 'character' && (
              <div className="space-y-1 text-sm text-gray-400">
                {asset.gender && (
                  <p>
                    <span className="text-gray-500">性别：</span>
                    {asset.gender}
                    {asset.age && ` · ${asset.age}`}
                  </p>
                )}
                {asset.appearance && (
                  <p className="text-gray-400">{asset.appearance}</p>
                )}
                {asset.outfit && (
                  <p className="text-gray-400">{asset.outfit}</p>
                )}
              </div>
            )}

            {asset.asset_type === 'scene' && (
              <div className="space-y-1 text-sm text-gray-400">
                {asset.description && <p>{asset.description}</p>}
                {asset.time_of_day && (
                  <p>
                    <span className="text-gray-500">时间：</span>
                    {asset.time_of_day}
                    {asset.lighting && ` · ${asset.lighting}`}
                  </p>
                )}
              </div>
            )}

            {asset.asset_type === 'prop' && (
              <div className="text-sm text-gray-400">
                {asset.description && <p>{asset.description}</p>}
              </div>
            )}

            {/* 变体标签 */}
            {asset.variants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {asset.variants.map((v) => (
                  <span
                    key={v.variant_id}
                    className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300"
                  >
                    {v.variant_name}
                  </span>
                ))}
              </div>
            )}

            {/* 图片操作按钮 */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || generating}
                className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {uploading ? '上传中...' : '上传'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || uploading}
                className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {generating ? '生成中...' : 'AI生图'}
              </button>
              {images.length > 0 && (
                <>
                  {currentImageIndex !== 1 && (
                    <button
                      onClick={handleSetPrimary}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
                    >
                      设为主图
                    </button>
                  )}
                  <button
                    onClick={handleDeleteImage}
                    className="text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-800 transition-colors"
                  >
                    删除图
                  </button>
                </>
              )}
            </div>

            {/* 资产操作按钮 */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                编辑描述
              </button>
              <button
                onClick={handleDelete}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                删除资产
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}