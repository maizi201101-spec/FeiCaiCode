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

const TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' } as const
const TYPE_COLOR = {
  character: 'bg-blue-900/50 text-blue-300',
  scene: 'bg-amber-900/50 text-amber-300',
  prop: 'bg-emerald-900/50 text-emerald-300',
} as const

export default function AssetCard({ asset, projectId, onUpdate, onDelete }: AssetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState(asset.name)
  const [editedAppearance, setEditedAppearance] = useState(asset.appearance || '')
  const [editedDescription, setEditedDescription] = useState(asset.description || '')
  const [saving, setSaving] = useState(false)

  const [images, setImages] = useState<AssetImage[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(1)
  const [loadingImages, setLoadingImages] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState('')

  // 鼠标跟随浮动预览
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

  const currentImageUrl =
    images.length > 0
      ? getImageUrl(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      : null

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

  const handleDeleteImage = async () => {
    if (!confirm(`确定删除第 ${currentImageIndex} 张图片？`)) return
    try {
      await deleteAssetImage(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      await loadImages()
      setCurrentImageIndex(1)
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleSetPrimary = async () => {
    if (currentImageIndex === 1) return
    try {
      await setPrimaryImage(projectId, asset.asset_type, asset.asset_id, currentImageIndex)
      await loadImages()
      setCurrentImageIndex(1)
    } catch (e) {
      alert(e instanceof Error ? e.message : '设置主图失败')
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
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定删除此资产？')) return
    await onDelete(asset.asset_type, asset.asset_id)
  }

  const descText = asset.asset_type === 'character'
    ? asset.appearance
    : asset.description

  // ── 紧凑卡片：左缩略图 + 右文字 ──────────────────────
  return (
    <>
      <div
        className={`bg-gray-800 rounded-lg overflow-hidden flex gap-0 cursor-pointer transition-colors ${
          asset.needs_review
            ? 'border border-yellow-500/70 hover:border-yellow-400'
            : 'border border-gray-700 hover:border-gray-500'
        }`}
        onClick={() => setExpanded(true)}
      >
        {/* 左：16:9 缩略图，最长边完整显示 */}
        <div
          className="relative shrink-0 bg-gray-900 flex items-center justify-center overflow-hidden"
          style={{ width: 80, height: 56 }}
          onMouseEnter={(e) => primaryImageUrl && setHoverPos({ x: e.clientX, y: e.clientY })}
          onMouseMove={(e) => primaryImageUrl && setHoverPos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHoverPos(null)}
          onClick={(e) => e.stopPropagation()} // 悬停区不触发详情弹窗
        >
          {loadingImages ? (
            <span className="text-xs text-gray-600">...</span>
          ) : primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt={asset.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-gray-600">无图</span>
          )}
        </div>

        {/* 右：文字 */}
        <div className="flex-1 min-w-0 px-2 py-1.5">
          <div className="flex items-center gap-1 mb-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLOR[asset.asset_type]}`}>
              {TYPE_LABEL[asset.asset_type]}
            </span>
            <span className="text-xs text-gray-500 truncate">{asset.asset_id}</span>
          </div>
          <p className="text-sm font-medium text-white truncate">{asset.name}</p>
          {descText && (
            <p className="text-xs text-gray-500 line-clamp-2">{descText}</p>
          )}
        </div>
      </div>

      {/* 鼠标跟随浮动大图 */}
      {hoverPos && primaryImageUrl && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: hoverPos.x + 16,
            top: hoverPos.y - 90,
          }}
        >
          <img
            src={primaryImageUrl}
            alt={asset.name}
            className="rounded-lg shadow-2xl border border-gray-600 object-contain bg-gray-900"
            style={{ width: 240, height: 135 }}
          />
        </div>
      )}

      {/* ── 详情弹窗 ────────────────────────────────────── */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => { if (!editing) setExpanded(false) }}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 图片区 */}
            <div className="relative bg-gray-950 flex items-center justify-center" style={{ paddingTop: '56.25%' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                {generating ? (
                  <div className="text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <span className="text-xs text-gray-400">{generatingProgress}</span>
                  </div>
                ) : currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={asset.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-gray-600">暂无设定图</span>
                )}
              </div>

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

              <button
                onClick={() => { setEditing(false); setExpanded(false) }}
                className="absolute top-2 right-2 text-gray-400 hover:text-white bg-gray-800/80 rounded-full w-6 h-6 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
            />

            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLOR[asset.asset_type]}`}>
                  {TYPE_LABEL[asset.asset_type]}
                </span>
                <span className="text-xs text-gray-500">{asset.asset_id}</span>
                {asset.needs_review && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">待审核</span>
                )}
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
                    <button onClick={handleSave} disabled={saving}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm rounded">
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600">
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium text-white mb-2">{asset.name}</p>

                  {asset.asset_type === 'character' && (
                    <div className="space-y-1 text-sm text-gray-400">
                      {asset.gender && <p><span className="text-gray-500">性别：</span>{asset.gender}{asset.age && ` · ${asset.age}`}</p>}
                      {asset.appearance && <p>{asset.appearance}</p>}
                      {asset.outfit && <p>{asset.outfit}</p>}
                    </div>
                  )}
                  {asset.asset_type === 'scene' && (
                    <div className="space-y-1 text-sm text-gray-400">
                      {asset.description && <p>{asset.description}</p>}
                      {asset.time_of_day && <p><span className="text-gray-500">时间：</span>{asset.time_of_day}{asset.lighting && ` · ${asset.lighting}`}</p>}
                    </div>
                  )}
                  {asset.asset_type === 'prop' && (
                    <div className="text-sm text-gray-400">
                      {asset.description && <p>{asset.description}</p>}
                    </div>
                  )}

                  {asset.variants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {asset.variants.map((v) => (
                        <span key={v.variant_id} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                          {v.variant_name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading || generating}
                      className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50">
                      {uploading ? '上传中...' : '上传'}
                    </button>
                    <button onClick={handleGenerate} disabled={generating || uploading}
                      className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50">
                      {generating ? '生成中...' : 'AI生图'}
                    </button>
                    {images.length > 0 && (
                      <>
                        {currentImageIndex !== 1 && (
                          <button onClick={handleSetPrimary}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500">
                            设为主图
                          </button>
                        )}
                        <button onClick={handleDeleteImage}
                          className="text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-800">
                          删除图
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-3 border-t border-gray-700 pt-3">
                    <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-200">编辑描述</button>
                    {asset.needs_review && (
                      <button
                        onClick={() => onUpdate(asset.asset_type, asset.asset_id, { needs_review: false })}
                        className="text-xs text-yellow-400 hover:text-yellow-300"
                      >
                        标记已审核
                      </button>
                    )}
                    <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300">删除资产</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
