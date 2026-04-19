/**
 * 预设库配置组件
 * 管理预设列表、创建、编辑、激活
 */

import { useState } from 'react'
import {
  type Preset,
  type PresetCategory,
  type PresetCreatePayload,
  CATEGORY_LABELS,
} from '../../api/presets'
import { usePresets } from '../../hooks/usePresets'

interface PresetsConfigProps {
  projectId: number
}

export default function PresetsConfig({ projectId }: PresetsConfigProps) {
  const {
    presets,
    loading,
    error,
    create,
    update,
    remove,
    activate,
    deactivate,
    getByCategory,
  } = usePresets(projectId)

  // 避免 presets 未使用警告
  console.log('Presets loaded:', presets?.length ?? 0)

  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>('storyboard_style')
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<PresetCreatePayload>({
    name: '',
    category: 'storyboard_style',
    description: '',
    content: '',
  })

  const categoryPresets = getByCategory(selectedCategory)

  // 处理激活/取消激活
  const handleToggleActive = async (preset: Preset) => {
    try {
      if (preset.is_active) {
        await deactivate(preset.preset_id)
      } else {
        await activate(preset.preset_id, preset.category)
      }
    } catch (e) {
      console.error('操作失败:', e)
    }
  }

  // 处理创建
  const handleCreate = async () => {
    if (!createForm.name || !createForm.content) return
    try {
      await create(createForm)
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        category: selectedCategory,
        description: '',
        content: '',
      })
    } catch (e) {
      console.error('创建失败:', e)
    }
  }

  // 处理删除
  const handleDelete = async (preset: Preset) => {
    if (preset.is_builtin) {
      alert('内置预设不能删除')
      return
    }
    if (!confirm('确定删除此预设？')) return
    try {
      await remove(preset.preset_id)
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  // 处理编辑
  const handleEdit = async () => {
    if (!editingPreset) return
    try {
      await update(editingPreset.preset_id, {
        name: editingPreset.name,
        description: editingPreset.description,
        content: editingPreset.content,
      })
      setEditingPreset(null)
    } catch (e) {
      console.error('更新失败:', e)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 标题 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">系统提示词预设库</h3>
          <p className="text-xs text-gray-500 mt-1">管理分镜规划、视频提示词、特殊效果等预设</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          + 新建预设
        </button>
      </div>

      {/* 分类选择 */}
      <div className="px-4 py-2 border-b flex gap-2">
        {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-sm rounded ${
              selectedCategory === cat
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 预设列表 */}
      <div className="p-4 space-y-2">
        {loading && <div className="text-gray-500 text-sm">加载中...</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}

        {categoryPresets.map(preset => (
          <div
            key={preset.preset_id}
            className={`p-3 rounded border ${
              preset.is_active ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{preset.name}</span>
                  {preset.is_builtin && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                      内置
                    </span>
                  )}
                  {preset.is_active && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                      已激活
                    </span>
                  )}
                </div>
                {preset.description && (
                  <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                {/* 激活按钮 */}
                <button
                  onClick={() => handleToggleActive(preset)}
                  className={`px-2 py-1 text-xs rounded ${
                    preset.is_active
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {preset.is_active ? '取消' : '激活'}
                </button>
                {/* 编辑按钮（非内置） */}
                {!preset.is_builtin && (
                  <button
                    onClick={() => setEditingPreset(preset)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    编辑
                  </button>
                )}
                {/* 删除按钮（非内置） */}
                {!preset.is_builtin && (
                  <button
                    onClick={() => handleDelete(preset)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
            {/* 内容预览 */}
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 line-clamp-2">
              {preset.content}
            </div>
          </div>
        ))}

        {categoryPresets.length === 0 && !loading && (
          <div className="text-gray-400 text-sm text-center py-4">
            此分类暂无预设
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-900 mb-3">新建预设</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">分类</label>
                <select
                  value={createForm.category}
                  onChange={e => setCreateForm(prev => ({
                    ...prev,
                    category: e.target.value as PresetCategory,
                  }))}
                  className="w-full px-3 py-2 border rounded"
                >
                  {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">名称 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="预设名称"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">描述</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="预设描述（可选）"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">内容 *</label>
                <textarea
                  value={createForm.content}
                  onChange={e => setCreateForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 border rounded h-32"
                  placeholder="预设的实际 prompt 内容"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.name || !createForm.content}
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingPreset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-900 mb-3">编辑预设</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">名称</label>
                <input
                  type="text"
                  value={editingPreset.name}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">描述</label>
                <input
                  type="text"
                  value={editingPreset.description}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">内容</label>
                <textarea
                  value={editingPreset.content}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, content: e.target.value } : null)}
                  className="w-full px-3 py-2 border rounded h-32"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingPreset(null)}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}