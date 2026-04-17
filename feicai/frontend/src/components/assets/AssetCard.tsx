import { useState } from 'react'
import type { Asset, AssetType, AssetUpdatePayload } from '../../api/assets'

interface AssetCardProps {
  asset: Asset
  onUpdate: (assetType: AssetType, assetId: string, payload: AssetUpdatePayload) => Promise<Asset>
  onDelete: (assetType: AssetType, assetId: string) => Promise<void>
}

export default function AssetCard({ asset, onUpdate, onDelete }: AssetCardProps) {
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState(asset.name)
  const [editedAppearance, setEditedAppearance] = useState(asset.appearance || '')
  const [editedDescription, setEditedDescription] = useState(asset.description || '')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* 设定图区域（占位） */}
      <div className="h-40 bg-gray-900 flex items-center justify-center text-gray-600">
        {asset.images.length > 0 ? (
          <span className="text-sm">已有 {asset.images.length} 张设定图</span>
        ) : (
          <span className="text-sm">暂无设定图</span>
        )}
      </div>

      {/* 资产信息 */}
      <div className="p-4">
        {/* 类型标签 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded ${typeColor[asset.asset_type]}`}>
            {typeLabel[asset.asset_type]}
          </span>
          <span className="text-xs text-gray-500">{asset.asset_id}</span>
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

            {/* 操作按钮 */}
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
                删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}