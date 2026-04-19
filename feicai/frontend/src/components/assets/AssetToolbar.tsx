import type { AssetType } from '../../api/assets'

interface AssetToolbarProps {
  viewMode: 'all' | 'episode'
  onViewModeChange: (mode: 'all' | 'episode') => void
  filterType: AssetType | null
  onFilterTypeChange: (type: AssetType | null) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onExtractClick: () => void
  onBatchExtractClick: () => void
  onExtractFromStoryboardClick: () => void
  onAddClick: () => void
  onOpenClusterLog: () => void
  hasClusterLog: boolean
  extracting: boolean
  batchExtracting: boolean
  extractingFromStoryboard: boolean
}

export default function AssetToolbar({
  viewMode,
  onViewModeChange,
  filterType,
  onFilterTypeChange,
  searchQuery,
  onSearchChange,
  onExtractClick,
  onBatchExtractClick,
  onExtractFromStoryboardClick,
  onAddClick,
  onOpenClusterLog,
  hasClusterLog,
  extracting,
  batchExtracting,
  extractingFromStoryboard,
}: AssetToolbarProps) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-800 bg-gray-950">
      {/* 视图切换 */}
      <div className="flex gap-1">
        <button
          onClick={() => onViewModeChange('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            viewMode === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          全集资产库
        </button>
        <button
          onClick={() => onViewModeChange('episode')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            viewMode === 'episode'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          分集资产
        </button>
      </div>

      {/* 类型筛选 */}
      <div className="flex gap-1">
        <button
          onClick={() => onFilterTypeChange(null)}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            filterType === null
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => onFilterTypeChange('character')}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            filterType === 'character'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          角色
        </button>
        <button
          onClick={() => onFilterTypeChange('scene')}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            filterType === 'scene'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          场景
        </button>
        <button
          onClick={() => onFilterTypeChange('prop')}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            filterType === 'prop'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          道具
        </button>
      </div>

      {/* 搜索框 */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="搜索资产..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />

      {/* 操作按钮 */}
      <button
        onClick={onOpenClusterLog}
        disabled={!hasClusterLog}
        title={hasClusterLog ? '查看聚类审核日志' : '暂无聚类日志，请先提取资产'}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-300 text-sm rounded-lg transition-colors whitespace-nowrap"
      >
        聚类日志
      </button>
      <button
        onClick={onBatchExtractClick}
        disabled={batchExtracting || extracting}
        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
      >
        {batchExtracting ? '批量提取中...' : '全集批量提取'}
      </button>
      <button
        onClick={onExtractFromStoryboardClick}
        disabled={extractingFromStoryboard || extracting || batchExtracting}
        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
      >
        {extractingFromStoryboard ? '提取中...' : '从分镜提取'}
      </button>
      <button
        onClick={onExtractClick}
        disabled={extracting || batchExtracting}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
      >
        {extracting ? '提取中...' : '提取资产'}
      </button>
      <button
        onClick={onAddClick}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
      >
        + 新增
      </button>
    </div>
  )
}