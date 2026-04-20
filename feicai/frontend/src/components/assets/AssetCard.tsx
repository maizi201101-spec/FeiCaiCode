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
import AssetVariantRow from './AssetVariantRow'

interface AssetCardProps {
  asset: Asset
  projectId: number
  onUpdate: (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => Promise<Asset>
  onDelete: (assetType: AssetType, assetId: string) => Promise<void>
  forceExpanded?: boolean | null
  forceVariantsExpanded?: boolean | null
}

const TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' } as const
const TYPE_COLOR = {
  character: 'bg-blue-900/50 text-blue-300',
  scene: 'bg-amber-900/50 text-amber-300',
  prop: 'bg-emerald-900/50 text-emerald-300',
} as const

export default function AssetCard({ asset, projectId, onUpdate, onDelete, forceExpanded, forceVariantsExpanded }: AssetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState(asset.name)
  const [editedAppearance, setEditedAppearance] = useState(asset.appearance || '')
  const [editedDescription, setEditedDescription] = useState(asset.description || '')
  const [saving, setSaving] = useState(false)
  const [variantsExpanded, setVariantsExpanded] = useState(false)

  const isExpanded = forceExpanded != null ? forceExpanded : expanded
  const isVariantsExpanded = forceVariantsExpanded != null ? forceVariantsExpanded : variantsExpanded

  const [images, setImages] = useState<AssetImage[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(1)
  const [loadingImages, setLoadingImages] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState('')

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

  const descText = asset.asset_type === 'character' ? asset.appearance : asset.description

  return (
    <div className="flex flex-col">
      {/* ── 父卡片（横向布局）─────────────────────────────── */}
      <div
        className={`bg-gray-800 rounded-lg overflow-hidden border group ${
          asset.needs_review
            ? 'border-yellow-500/70'
            : 'border-gray-700'
        }`}
      >
        <div className="flex gap-0">
          {/* 左：16:9 缩略图 */}
          <div
            className="relative shrink-0 bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer"
            style={{ width: 80, height: 56 }}
            onMouseEnter={(e) => primaryImageUrl && setHoverPos({ x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => primaryImageUrl && setHoverPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoverPos(null)}
          >
            {loadingImages ? (
              <span className="text-xs text-gray-600">...</span>
            ) : primaryImageUrl ? (
              <img src={primaryImageUrl} alt={asset.name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-gray-600">无图</span>
            )}
          </div>

          {/* 右：文字 + 操作 */}
          <div className="flex-1 min-w-0 px-2 py-1.5">
            <p className="text-sm font-medium text-white break-all">{asset.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLOR[asset.asset_type]}`}>
                {TYPE_LABEL[asset.asset_type]}
              </span>
              <span className="text-xs text-gray-500 break-all">{asset.asset_id}</span>
              {asset.needs_review && (
                <span className="text-xs px-1 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 shrink-0">
                  待审核
                </span>
              )}
            </div>
            {descText && !editing && (
              <p className="text-xs text-gray-500 mt-0.5">{descText}</p>
            )}
          </div>

          {/* 右侧操作列（hover 显示） */}
          <div className="shrink-0 flex flex-col justify-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setExpanded(!isExpanded)}
              className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              {isExpanded ? '收起' : '展开'}
            </button>
            {asset.needs_review && (
              <button
                onClick={() => onUpdate(asset.asset_type, asset.asset_id, { needs_review: false })}
                className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded hover:bg-yellow-800/60"
              >
                ✓ 审核
              </button>
            )}
            <button
              onClick={handleDelete}
              className="text-xs px-2 py-0.5 bg-red-900/40 text-red-400 rounded hover:bg-red-800/60"
            >
              删除
            </button>
          </div>
        </div>

        {/* 展开区：图片管理 + 内联编辑 */}
        {isExpanded && (
          <div className="border-t border-gray-700 p-3 space-y-3">
            {/* 图片管理区 */}
            <div className="flex gap-3 items-start">
              {/* 图片预览 */}
              <div
                className="relative bg-gray-900 rounded flex items-center justify-center overflow-hidden shrink-0"
                style={{ width: 160, height: 90 }}
              >
                {generating ? (
                  <div className="text-center">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-1" />
                    <span className="text-xs text-gray-400">{generatingProgress}</span>
                  </div>
                ) : currentImageUrl ? (
                  <img src={currentImageUrl} alt={asset.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-600">暂无设定图</span>
                )}
              </div>

              {/* 图片操作 */}
              <div className="flex-1 space-y-2">
                {images.length > 1 && (
                  <select
                    value={currentImageIndex}
                    onChange={(e) => setCurrentImageIndex(Number(e.target.value))}
                    className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
                  >
                    {images.map((img) => (
                      <option key={img.index} value={img.index}>
                        v{img.index} {img.is_primary ? '(主图)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex flex-wrap gap-1">
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
                    className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
                  >
                    {uploading ? '上传中...' : '上传'}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || uploading}
                    className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {generating ? '生成中...' : 'AI生图'}
                  </button>
                  {images.length > 0 && currentImageIndex !== 1 && (
                    <button
                      onClick={handleSetPrimary}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500"
                    >
                      设主图
                    </button>
                  )}
                  {images.length > 0 && (
                    <button
                      onClick={handleDeleteImage}
                      className="text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-800"
                    >
                      删图
                    </button>
                  )}
                </div>
                {images.length > 0 && (
                  <span className="text-xs text-gray-600">{images.length} 张图</span>
                )}
              </div>
            </div>

            {/* 内联编辑区 */}
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
                    rows={3}
                    placeholder="外貌描述"
                  />
                ) : (
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
              <div className="space-y-1 text-sm text-gray-400">
                {asset.asset_type === 'character' && (
                  <>
                    {asset.gender && <p><span className="text-gray-500">性别：</span>{asset.gender}{asset.age && ` · ${asset.age}`}</p>}
                    {asset.appearance && <p className="line-clamp-3">{asset.appearance}</p>}
                    {asset.outfit && <p className="text-xs text-gray-500">{asset.outfit}</p>}
                  </>
                )}
                {asset.asset_type === 'scene' && (
                  <>
                    {asset.description && <p className="line-clamp-3">{asset.description}</p>}
                    {asset.time_of_day && <p><span className="text-gray-500">时间：</span>{asset.time_of_day}{asset.lighting && ` · ${asset.lighting}`}</p>}
                  </>
                )}
                {asset.asset_type === 'prop' && asset.description && (
                  <p className="line-clamp-3">{asset.description}</p>
                )}
              </div>
            )}

            {/* 底部操作行 */}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-700/50">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  编辑描述
                </button>
              )}
              {asset.needs_review && (
                <button
                  onClick={() => onUpdate(asset.asset_type, asset.asset_id, { needs_review: false })}
                  className="text-xs text-yellow-400 hover:text-yellow-300"
                >
                  标记已审核
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Variant 子卡片 ──────────────────────────────── */}
      {asset.variants.length > 0 && (
        <div className="mt-0.5">
          {isVariantsExpanded ? (
            <>
              {asset.variants.map((v) => (
                <AssetVariantRow
                  key={v.variant_id}
                  variant={v}
                  projectId={projectId}
                  assetType={asset.asset_type}
                  assetId={asset.asset_id}
                />
              ))}
              <button
                onClick={() => setVariantsExpanded(false)}
                className="ml-4 pl-3 text-xs text-gray-600 hover:text-gray-400 py-0.5"
              >
                收起变体
              </button>
            </>
          ) : (
            <button
              onClick={() => setVariantsExpanded(true)}
              className="ml-4 pl-3 text-xs text-gray-600 hover:text-gray-400 py-0.5 border-l border-gray-700"
            >
              展开 {asset.variants.length} 个变体 ▾
            </button>
          )}
        </div>
      )}

      {/* 鼠标悬浮大图预览 */}
      {hoverPos && primaryImageUrl && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: hoverPos.x + 16, top: hoverPos.y - 90 }}
        >
          <img
            src={primaryImageUrl}
            alt={asset.name}
            className="rounded-lg shadow-2xl border border-gray-600 object-contain bg-gray-900"
            style={{ width: 240, height: 135 }}
          />
        </div>
      )}
    </div>
  )
}
