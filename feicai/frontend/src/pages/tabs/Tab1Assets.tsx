import { useState } from 'react'
import AssetToolbar from '../../components/assets/AssetToolbar'
import AssetGrid from '../../components/assets/AssetGrid'
import { useAssets } from '../../hooks/useAssets'
import type { AssetType } from '../../api/assets'

interface Tab1AssetsProps {
  projectId: number
  episodeId: number | null
}

export default function Tab1Assets({ projectId, episodeId }: Tab1AssetsProps) {
  const {
    assets,
    loading,
    error,
    extracting,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    editAsset,
    deleteAsset,
    extractAssets,
  } = useAssets(projectId)

  const [viewMode, setViewMode] = useState<'all' | 'episode'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [addForm, setAddForm] = useState({
    asset_type: 'character' as AssetType,
    asset_id: '',
    name: '',
    appearance: '',
    description: '',
  })

  const handleExtract = async () => {
    if (!episodeId) {
      alert('请先选择集数')
      return
    }
    try {
      const result = await extractAssets({
        episode_ids: [episodeId],
        merge_mode: true,
      })
      alert(`提取完成：${result.results[0]?.characters_count} 角色，${result.results[0]?.scenes_count} 场景，${result.results[0]?.props_count} 道具`)
    } catch (e) {
      alert(e instanceof Error ? e.message : '提取失败')
    }
  }

  const handleAdd = async () => {
    if (!addForm.asset_id || !addForm.name) {
      alert('请填写资产 ID 和名称')
      return
    }
    try {
      const payload = {
        asset_type: addForm.asset_type,
        asset_id: addForm.asset_id,
        name: addForm.name,
        appearance: addForm.asset_type === 'character' ? addForm.appearance : undefined,
        description: addForm.asset_type !== 'character' ? addForm.description : undefined,
      }
      await import('../../api/assets').then(({ createAsset }) => createAsset(projectId, payload))
      setShowAddModal(false)
      setAddForm({ asset_type: 'character', asset_id: '', name: '', appearance: '', description: '' })
    } catch (e) {
      alert(e instanceof Error ? e.message : '添加失败')
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <AssetToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExtractClick={() => setShowExtractModal(true)}
        onAddClick={() => setShowAddModal(true)}
        extracting={extracting}
      />

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* 资产网格 */}
      <div className="flex-1 overflow-auto">
        <AssetGrid
          assets={assets}
          projectId={projectId}
          onUpdate={editAsset}
          onDelete={deleteAsset}
          onAddClick={() => setShowAddModal(true)}
        />
      </div>

      {/* 新增资产弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">新增资产</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">资产类型</label>
                <select
                  value={addForm.asset_type}
                  onChange={(e) => setAddForm({ ...addForm, asset_type: e.target.value as AssetType })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                >
                  <option value="character">角色</option>
                  <option value="scene">场景</option>
                  <option value="prop">道具</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">资产 ID</label>
                <input
                  type="text"
                  value={addForm.asset_id}
                  onChange={(e) => setAddForm({ ...addForm, asset_id: e.target.value })}
                  placeholder="如：人物1、场景1、道具1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">名称</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="角色/场景/道具的真实名称"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                />
              </div>
              {addForm.asset_type === 'character' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">外貌描述</label>
                  <textarea
                    value={addForm.appearance}
                    onChange={(e) => setAddForm({ ...addForm, appearance: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none"
                    rows={3}
                  />
                </div>
              )}
              {addForm.asset_type !== 'character' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">描述</label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提取资产弹窗 */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">AI 提取资产</h2>

            <p className="text-sm text-gray-400 mb-4">
              从当前选中的集数（EP{episodeId ? '...' : '未选择'}）剧本中提取角色、场景、道具。
              提取结果将自动合并到资产库。
            </p>

            {!episodeId && (
              <p className="text-sm text-red-400 mb-4">
                请先在顶部选择要提取的集数
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtractModal(false)}
                className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowExtractModal(false)
                  handleExtract()
                }}
                disabled={!episodeId || extracting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                开始提取
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}