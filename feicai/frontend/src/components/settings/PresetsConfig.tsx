/**
 * 预设库配置组件
 * 管理预设列表、创建、编辑、激活
 * 暗色主题版本
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
    loading,
    error,
    create,
    update,
    remove,
    activate,
    deactivate,
    getByCategory,
  } = usePresets(projectId)

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
    <div className="max-w-2xl">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">系统提示词预设库</h2>
        <p className="text-sm text-gray-400">
          管理分镜规划、视频提示词、特殊效果等预设
        </p>
      </div>

      {/* 分类选择 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded border text-sm ${
                selectedCategory === cat
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* 预设列表 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="space-y-3">
          {loading && <div className="text-gray-500 text-sm">加载中...</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}

          {categoryPresets.map(preset => (
            <div
              key={preset.preset_id}
              className={`p-4 rounded-lg border ${
                preset.is_active ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">{preset.name}</span>
                    {preset.is_builtin && (
                      <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                        内置
                      </span>
                    )}
                    {preset.is_active && (
                      <span className="px-1.5 py-0.5 bg-indigo-600 text-indigo-200 text-xs rounded">
                        已激活
                      </span>
                    )}
                  </div>
                  {preset.description && (
                    <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(preset)}
                    className={`px-3 py-1 text-xs rounded ${
                      preset.is_active
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500'
                    }`}
                  >
                    {preset.is_active ? '取消' : '激活'}
                  </button>
                  {!preset.is_builtin && (
                    <>
                      <button
                        onClick={() => setEditingPreset(preset)}
                        className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(preset)}
                        className="px-3 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* 内容预览 */}
              <div className="mt-3 p-2 bg-gray-800/50 rounded text-xs text-gray-500 line-clamp-2">
                {preset.content}
              </div>
            </div>
          ))}

          {categoryPresets.length === 0 && !loading && (
            <div className="text-gray-500 text-sm text-center py-8">
              此分类暂无预设，点击下方按钮新建
            </div>
          )}
        </div>
      </div>

      {/* 新建按钮 */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500"
      >
        + 新建预设
      </button>

      {/* 创建弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-200 mb-4">新建预设</h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">分类</label>
                <select
                  value={createForm.category}
                  onChange={e => setCreateForm(prev => ({
                    ...prev,
                    category: e.target.value as PresetCategory,
                  }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">名称 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  placeholder="预设名称"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">描述</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  placeholder="预设描述（可选）"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">内容 *</label>
                <textarea
                  value={createForm.content}
                  onChange={e => setCreateForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 h-32 resize-none"
                  placeholder="预设的实际 prompt 内容"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.name || !createForm.content}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingPreset && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-200 mb-4">编辑预设</h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">名称</label>
                <input
                  type="text"
                  value={editingPreset.name}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">描述</label>
                <input
                  type="text"
                  value={editingPreset.description}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">内容</label>
                <textarea
                  value={editingPreset.content}
                  onChange={e => setEditingPreset(prev => prev ? { ...prev, content: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 h-32 resize-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingPreset(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500"
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