import { useState, useEffect } from 'react'
import AssetToolbar from '../../components/assets/AssetToolbar'
import AssetGrid from '../../components/assets/AssetGrid'
import ClusterLogPanel from '../../components/assets/ClusterLogPanel'
import CostumeCollapseView from '../../components/assets/CostumeCollapseView'
import { useAssets } from '../../hooks/useAssets'
import { getClusterLog, extractFromStoryboard, batchCollapsePreview } from '../../api/assets'
import type { AssetType, BatchCollapsePreviewResult } from '../../api/assets'

interface Tab1AssetsProps {
  projectId: number
  episodeId: number | null
  onGoToTab0?: () => void
}

export default function Tab1Assets({ projectId, episodeId, onGoToTab0 }: Tab1AssetsProps) {
  const [viewMode, setViewMode] = useState<'all' | 'episode'>('all')

  const {
    assets,
    loading,
    error,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    editAsset,
    deleteAsset,
    refetch,
  } = useAssets(projectId, episodeId, viewMode)
  const [showAddModal, setShowAddModal] = useState(false)
  const [batchExtracting, setBatchExtracting] = useState(false)
  const [batchCollapseViewData, setBatchCollapseViewData] = useState<BatchCollapsePreviewResult | null>(null)
  const [clusterLogOpen, setClusterLogOpen] = useState(false)
  const [hasClusterLog, setHasClusterLog] = useState(false)
  const [addForm, setAddForm] = useState({
    asset_type: 'character' as AssetType,
    asset_id: '',
    name: '',
    appearance: '',
    description: '',
  })

  const handleBatchExtractFromStoryboard = async () => {
    setBatchExtracting(true)
    try {
      const preview = await batchCollapsePreview(projectId)
      setBatchCollapseViewData(preview)
    } catch (e) {
      alert(e instanceof Error ? e.message : '全集批量预览失败')
    } finally {
      setBatchExtracting(false)
    }
  }

  const handleBatchCollapseConfirm = async (selectedKeys: string[]) => {
    if (!batchCollapseViewData) return
    const episodeIds = batchCollapseViewData.episode_ids
    setBatchExtracting(true)
    try {
      for (const epId of episodeIds) {
        await extractFromStoryboard(epId, selectedKeys)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '批量写入失败')
    } finally {
      setBatchExtracting(false)
    }
    setBatchCollapseViewData(null)
    refetch()
  }

  useEffect(() => {
    getClusterLog(projectId)
      .then((log) => setHasClusterLog((log.clusters?.length ?? 0) > 0))
      .catch(() => {})
  }, [projectId, assets])

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
    return <div className="p-6 text-center text-gray-500">加载中...</div>
  }

  return (
    <div className="flex flex-col h-full relative">
      <AssetToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onBatchExtractClick={handleBatchExtractFromStoryboard}
        onAddClick={() => setShowAddModal(true)}
        onOpenClusterLog={() => setClusterLogOpen(true)}
        hasClusterLog={hasClusterLog}
        batchExtracting={batchExtracting}
      />

      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {assets.length === 0 && !batchExtracting ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-gray-400">暂无资产数据</div>
            <div className="text-sm text-gray-500">
              先完成分镜规划，再点击「全集批量提取」生成资产
            </div>
            {onGoToTab0 && (
              <button
                onClick={onGoToTab0}
                className="text-xs text-gray-600 hover:text-gray-400 mt-1"
              >
                还没导入剧本？前往「剧本管理」
              </button>
            )}
          </div>
        ) : (
          <AssetGrid
            assets={assets}
            projectId={projectId}
            onUpdate={editAsset}
            onDelete={deleteAsset}
            onAddClick={() => setShowAddModal(true)}
          />
          )}
        </div>
        {clusterLogOpen && (
          <ClusterLogPanel projectId={projectId} onClose={() => setClusterLogOpen(false)} />
        )}
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

      {/* 全集批量提取 - 装扮坍缩确认弹窗 */}
      {batchCollapseViewData && (
        <CostumeCollapseView
          collapsedData={batchCollapseViewData}
          onConfirm={handleBatchCollapseConfirm}
          onCancel={() => setBatchCollapseViewData(null)}
        />
      )}
    </div>
  )
}
