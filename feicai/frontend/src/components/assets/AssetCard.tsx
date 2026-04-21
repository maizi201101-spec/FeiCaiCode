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
  displayName?: string
  variantDesc?: string
  onUpdate: (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => Promise<Asset>
  onDelete: (assetType: AssetType, assetId: string) => Promise<void>
  zoomEnabled?: boolean
}

const TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' } as const
const TYPE_COLOR = {
  character: 'bg-blue-900/50 text-blue-300',
  scene: 'bg-amber-900/50 text-amber-300',
  prop: 'bg-emerald-900/50 text-emerald-300',
} as const

export default function AssetCard({
  asset,
  projectId,
  displayName,
  variantDesc,
  onUpdate,
  onDelete,
  zoomEnabled = true,
}: AssetCardProps) {
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState(displayName ?? asset.name)
  const [editedAppearance, setEditedAppearance] = useState(asset.appearance || '')
  const [editedDescription, setEditedDescription] = useState(asset.description || '')
  const [saving, setSaving] = useState(false)

  const [images, setImages] = useState<AssetImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImages = async () => {
    setLoadingImages(true)
    try {
      const result = await getAssetImages(projectId, asset.asset_type, asset.asset_id)
      setImages(result.images)
    } catch {
      // silent
    } finally {
      setLoadingImages(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [projectId, asset.asset_type, asset.asset_id])

  const primaryImageUrl =
    images.length > 0 ? getImageUrl(projectId, asset.asset_type, asset.asset_id, 1) : null

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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratingProgress('创建任务...')
    try {
      const result = await generateAssetImage(projectId, asset.asset_type, asset.asset_id)
      await pollTaskStatus(result.task_id, {
        interval: 2000,
        maxAttempts: 60,
        onProgress: (s) => setGeneratingProgress(`状态: ${s.status}`),
        onComplete: () => setGeneratingProgress('生成完成'),
        onFailed: (err) => setGeneratingProgress(`失败: ${err}`),
      })
      await loadImages()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'AI 生图失败')
    } finally {
      setGenerating(false)
      setGeneratingProgress('')
    }
  }

  const handleSetPrimary = async (index: number) => {
    if (index === 1) return
    try {
      await setPrimaryImage(projectId, asset.asset_type, asset.asset_id, index)
      await loadImages()
      setShowImageModal(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '设置主图失败')
    }
  }

  const handleDeleteImage = async (index: number) => {
    if (!confirm(`确定删除第 ${index} 张图片？`)) return
    try {
      await deleteAssetImage(projectId, asset.asset_type, asset.asset_id, index)
      await loadImages()
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: AssetUpdatePayload = { name: editedName }
      if (asset.asset_type === 'character') payload.appearance = editedAppearance
      else payload.description = editedDescription
      await onUpdate(asset.asset_type, asset.asset_id, payload)
      setEditing(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定删除此资产？')) return
    try {
      await onDelete(asset.asset_type, asset.asset_id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const name = displayName ?? asset.name
  const descText = variantDesc || (asset.asset_type === 'character' ? asset.appearance : asset.description)

  return (
    <>
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        {/* 第1行：名字 + 标签 + ID + 删除 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
          <span className="text-sm font-medium text-white flex-shrink-0">{name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLOR[asset.asset_type]}`}>
            {TYPE_LABEL[asset.asset_type]}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">{asset.asset_id}</span>
          <div className="flex-1" />
          <button
            onClick={handleDelete}
            className="text-xs px-2 py-0.5 bg-red-900/40 text-red-400 rounded hover:bg-red-800/60 flex-shrink-0"
          >
            删除
          </button>
        </div>

        {/* 第2行：图片区（16:9）+ 底部按钮叠加 */}
        <div className="relative bg-gray-900" style={{ aspectRatio: '16/9' }}>
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onMouseEnter={(e) => primaryImageUrl && zoomEnabled && setHoverPos({ x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => primaryImageUrl && zoomEnabled && setHoverPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoverPos(null)}
          >
            {loadingImages ? (
              <span className="text-xs text-gray-600">加载中...</span>
            ) : generating ? (
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-1" />
                <span className="text-xs text-gray-400">{generatingProgress}</span>
              </div>
            ) : primaryImageUrl ? (
              <img src={primaryImageUrl} alt={name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-gray-600">暂无设定图</span>
            )}
          </div>

          {/* 底部按钮叠加层 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || generating}
              className="text-xs px-2 py-1 bg-gray-700/90 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
            >
              {uploading ? '上传中...' : '上传'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || uploading}
              className="text-xs px-2 py-1 bg-emerald-600/90 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
            >
              {generating ? '生成中...' : 'AI生图'}
            </button>
            {images.length > 0 && (
              <button
                onClick={() => setShowImageModal(true)}
                className="text-xs px-2 py-1 bg-indigo-600/90 text-white rounded hover:bg-indigo-500"
              >
                ⊞ 管理图片 ({images.length})
              </button>
            )}
          </div>
        </div>

        {/* 第3行：文字描述（双击编辑） */}
        <div className="p-3 border-t border-gray-700">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                placeholder="名称"
              />
              {asset.asset_type === 'character' ? (
                <textarea
                  value={editedAppearance}
                  onChange={(e) => setEditedAppearance(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white resize-none"
                  rows={4}
                  placeholder="外貌描述"
                />
              ) : (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white resize-none"
                  rows={4}
                  placeholder="描述"
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm rounded"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div
              className="space-y-1 text-sm text-gray-400 cursor-text"
              onDoubleClick={() => setEditing(true)}
              title="双击编辑"
            >
              {asset.asset_type === 'character' && (
                <>
                  {asset.gender && <p><span className="text-gray-500">性别：</span>{asset.gender}{asset.age && ` · ${asset.age}`}</p>}
                  {asset.appearance && <p>{asset.appearance}</p>}
                  {asset.outfit && <p className="text-xs text-gray-500">{asset.outfit}</p>}
                </>
              )}
              {asset.asset_type === 'scene' && (
                <>
                  {asset.description && <p>{asset.description}</p>}
                  {asset.time_of_day && <p><span className="text-gray-500">时间：</span>{asset.time_of_day}{asset.lighting && ` · ${asset.lighting}`}</p>}
                  {asset.visual_elements && asset.visual_elements.length > 0 && (
                    <p className="text-xs text-gray-500">{asset.visual_elements.join('、')}</p>
                  )}
                </>
              )}
              {asset.asset_type === 'prop' && asset.description && (
                <p>{asset.description}</p>
              )}
              {variantDesc && <p className="text-xs text-blue-400">{variantDesc}</p>}
            </div>
          )}
        </div>
      </div>

      {/* 鼠标悬浮大图预览（960×540） */}
      {hoverPos && primaryImageUrl && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: hoverPos.x + 16, top: hoverPos.y - 270 }}
        >
          <img
            src={primaryImageUrl}
            alt={name}
            className="rounded-lg shadow-2xl border border-gray-600 object-contain bg-gray-900"
            style={{ width: 960, height: 540 }}
          />
        </div>
      )}

      {/* 图片管理弹窗 */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998]"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-gray-800 rounded-lg p-4 max-w-4xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">管理图片 - {name}</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img) => {
                const imgUrl = getImageUrl(projectId, asset.asset_type, asset.asset_id, img.index)
                return (
                  <div key={img.index} className="relative group">
                    <div
                      className={`aspect-video rounded border-2 overflow-hidden cursor-pointer ${
                        img.is_primary ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
                      }`}
                      onClick={() => handleSetPrimary(img.index)}
                    >
                      <img src={imgUrl} alt={`v${img.index}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      v{img.index} {img.is_primary && '(主图)'}
                    </div>
                    <button
                      onClick={() => handleDeleteImage(img.index)}
                      className="absolute top-1 right-1 bg-red-900/80 text-red-300 text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      删除
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">点击图片设为主图</p>
          </div>
        </div>
      )}
    </>
  )
}
