import { useState, useEffect } from 'react'
import AssetToolbar from '../../components/assets/AssetToolbar'
import AssetGrid from '../../components/assets/AssetGrid'
import ClusterLogPanel from '../../components/assets/ClusterLogPanel'
import CostumeCollapseView from '../../components/assets/CostumeCollapseView'
import { useAssets } from '../../hooks/useAssets'
import { useEpisodes } from '../../hooks/useProjects'
import { getClusterLog, collapsePreview, extractFromStoryboard } from '../../api/assets'
import type { AssetType, CollapsePreviewResult } from '../../api/assets'

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
    extracting,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    editAsset,
    deleteAsset,
    extractAssets,
    refetch,
  } = useAssets(projectId, episodeId, viewMode)
  const { episodes } = useEpisodes(projectId)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [batchExtracting, setBatchExtracting] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')
  const [extractingFromStoryboard, setExtractingFromStoryboard] = useState(false)
  const [collapseViewData, setCollapseViewData] = useState<CollapsePreviewResult | null>(null)
  const [clusterLogOpen, setClusterLogOpen] = useState(false)
  const [hasClusterLog, setHasClusterLog] = useState(false)
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

  const handleBatchExtract = async () => {
    if (episodes.length === 0) {
      alert('当前项目暂无集数')
      return
    }
    if (!confirm(`将对全部 ${episodes.length} 集依次提取资产并合并，可能需要较长时间，确定开始？`)) return

    setBatchExtracting(true)
    let totalChars = 0, totalScenes = 0, totalProps = 0
    try {
      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i]
        setBatchProgress(`EP${String(ep.number).padStart(2, '0')} (${i + 1}/${episodes.length}) 提取中...`)
        try {
          const result = await extractAssets({ episode_ids: [ep.id], merge_mode: true })
          const r = result.results[0]
          if (r) {
            totalChars += r.characters_count
            totalScenes += r.scenes_count
            totalProps += r.props_count
          }
        } catch {
          // 单集失败不中断，继续下一集
        }
      }
      setBatchProgress('')
      alert(`批量提取完成：${totalChars} 角色，${totalScenes} 场景，${totalProps} 道具`)
    } catch (e) {
      alert(e instanceof Error ? e.message : '批量提取失败')
    } finally {
      setBatchExtracting(false)
      setBatchProgress('')
    }
  }

  const handleExtractFromStoryboard = async () => {
    if (!episodeId) {
      alert('请先选择集数')
      return
    }
    setExtractingFromStoryboard(true)
    try {
      const preview = await collapsePreview(episodeId)
      setCollapseViewData(preview)
    } catch (e) {
      alert(e instanceof Error ? e.message : '从分镜提取失败')
    } finally {
      setExtractingFromStoryboard(false)
    }
  }

  const handleCollapseConfirm = async () => {
    if (!episodeId) return
    try {
      await extractFromStoryboard(episodeId)
    } catch (e) {
      alert(e instanceof Error ? e.message : '资产写入失败')
    }
    setCollapseViewData(null)
    refetch()
  }

  // 检测是否有聚类日志  useEffect(() => {
    getClusterLog(projectId)
      .then((log) => setHasClusterLog((log.clusters?.length ?? 0) > 0))
      .catch(() => {})
  }, [projectId, assets]) // assets 变化时重新检测（提取后刷新）

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
        onExtractClick={() => setShowExtractModal(true)}
        onBatchExtractClick={handleBatchExtract}
        onExtractFromStoryboardClick={handleExtractFromStoryboard}
        onAddClick={() => setShowAddModal(true)}
        onOpenClusterLog={() => setClusterLogOpen(true)}
        hasClusterLog={hasClusterLog}
        extracting={extracting}
        batchExtracting={batchExtracting}
        extractingFromStoryboard={extractingFromStoryboard}
      />

      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm">{error}</div>
      )}

      {batchProgress && (
        <div className="px-4 py-2 bg-orange-900/30 text-orange-300 text-sm flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin shrink-0" />
          {batchProgress}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {assets.length === 0 && !extracting && !batchExtracting ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-gray-400">暂无资产数据</div>
            <div className="text-sm text-gray-500">
              点击「全集批量提取」自动提取所有集的角色、场景、道具
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

      {/* 提取资产弹窗 */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">AI 提取资产</h2>
            <p className="text-sm text-gray-400 mb-4">
              从当前选中集数的剧本中提取角色、场景、道具，结果合并到资产库。
            </p>
            {!episodeId && (
              <p className="text-sm text-red-400 mb-4">请先在顶部选择集数</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowExtractModal(false)}
                className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { setShowExtractModal(false); handleExtract() }}
                disabled={!episodeId || extracting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                开始提取
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 从分镜提取 - 装扮坍缩确认弹窗 */}
      {collapseViewData && (
        <CostumeCollapseView
          collapsedData={collapseViewData}
          onConfirm={handleCollapseConfirm}
          onCancel={() => setCollapseViewData(null)}
        />
      )}
    </div>
  )
}
