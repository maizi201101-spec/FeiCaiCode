import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import {
  getProjectZones,
  addProjectZone,
  removeProjectZone,
  setActiveZone,
  type ProjectZone,
} from '../api/systemSettings'

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, loading, createProject, refetch: refresh } = useProjects()
  const [showModal, setShowModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 项目区状态
  const [zones, setZones] = useState<ProjectZone[]>([])
  const [activeZone, setActiveZoneState] = useState('')
  const [showZoneDropdown, setShowZoneDropdown] = useState(false)
  const [newZonePath, setNewZonePath] = useState('')
  const [addingZone, setAddingZone] = useState(false)
  const [zoneError, setZoneError] = useState<string | null>(null)

  const loadZones = useCallback(async () => {
    try {
      const data = await getProjectZones()
      setZones(data.zones)
      setActiveZoneState(data.active_zone)
    } catch {
      // 忽略加载失败
    }
  }, [])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  async function handleSwitchZone(path: string) {
    try {
      await setActiveZone(path)
      setActiveZoneState(path)
      setShowZoneDropdown(false)
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '切换失败')
    }
  }

  async function handleAddZone() {
    const path = newZonePath.trim()
    if (!path) return
    setAddingZone(true)
    setZoneError(null)
    try {
      const data = await addProjectZone(path)
      setZones(data.zones)
      setNewZonePath('')
      // 如果是第一个项目区，自动激活
      if (data.zones.length === 1) {
        setActiveZoneState(path)
        refresh()
      }
    } catch (e) {
      setZoneError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setAddingZone(false)
    }
  }

  async function handleRemoveZone(path: string) {
    try {
      const data = await removeProjectZone(path)
      setZones(data.zones)
      // 重新加载激活区（后端可能自动切换了）
      await loadZones()
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '移除失败')
    }
  }

  async function handleCreate() {
    if (!formName.trim()) return
    if (!activeZone) {
      setError('请先点击右上角「设置」配置项目区')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const project = await createProject({ name: formName.trim(), path: formName.trim() })
      setShowModal(false)
      setFormName('')
      navigate(`/project/${project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const activeZoneName = zones.find(z => z.path === activeZone)?.name || (activeZone ? activeZone.split('/').pop() : '')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" onClick={() => setShowZoneDropdown(false)}>
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">飞彩</h1>
        <div className="flex items-center gap-3">
          {/* 项目区选择器 */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowZoneDropdown(v => !v)}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-gray-100 px-3 py-1.5 rounded border border-gray-700 hover:border-gray-600"
            >
              <span className="max-w-[200px] truncate">
                {activeZoneName || '未配置项目区'}
              </span>
              <span className="text-gray-500">▾</span>
            </button>
            {showZoneDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                {zones.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">暂无项目区，请在设置中添加</div>
                ) : (
                  zones.map(zone => (
                    <button
                      key={zone.path}
                      onClick={() => handleSwitchZone(zone.path)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center gap-2 ${
                        zone.path === activeZone ? 'text-indigo-400' : 'text-gray-300'
                      }`}
                    >
                      {zone.path === activeZone && <span>✓</span>}
                      <span className="truncate">{zone.name || zone.path}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded border border-gray-700 hover:border-gray-600"
          >
            ⚙ 设置
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + 新建项目
          </button>
        </div>
      </header>

      {/* 未配置项目区提示 */}
      {zones.length === 0 && (
        <div className="px-6 py-3 bg-yellow-900/20 border-b border-yellow-900/30">
          <span className="text-yellow-400 text-sm">
            ⚠ 请先点击右上角「设置」添加项目区路径
          </span>
        </div>
      )}

      {/* 主内容 */}
      <main className="p-6">
        {loading ? (
          <div className="text-gray-500 text-sm">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-24 text-gray-600">
            <p className="text-lg mb-2">暂无项目</p>
            <p className="text-sm">{activeZone ? '点击右上角「新建项目」开始' : '请先配置项目区'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="border border-gray-800 rounded-xl p-5 hover:border-gray-600 hover:bg-gray-900 transition-colors cursor-pointer"
              >
                <p className="font-medium text-gray-100 truncate">{project.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {project.episode_count ?? 0} 集 · {formatDate(project.updated_at)}
                </p>
                <p className="text-xs text-gray-700 mt-2 truncate">{project.path}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 新建项目弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">新建项目</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">项目名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => { setFormName(e.target.value); setError(null) }}
                  placeholder="例：都市短剧01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                {activeZone && (
                  <p className="text-xs text-gray-500 mt-1">
                    保存到: {activeZone}/{formName || '项目名'}
                  </p>
                )}
              </div>
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">{error}</div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setFormName(''); setError(null) }}
                className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!formName.trim() || creating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {creating ? '创建中...' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 项目区管理弹窗 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-semibold mb-4">项目区管理</h2>

            {/* 已有项目区列表 */}
            <div className="space-y-2 mb-4">
              {zones.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">暂无项目区，请添加</p>
              ) : (
                zones.map(zone => (
                  <div
                    key={zone.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                      zone.path === activeZone
                        ? 'border-indigo-500/50 bg-indigo-900/20'
                        : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{zone.name}</p>
                      <p className="text-xs text-gray-500 truncate">{zone.path}</p>
                    </div>
                    {zone.path === activeZone ? (
                      <span className="text-xs text-indigo-400 shrink-0">当前激活</span>
                    ) : (
                      <button
                        onClick={() => handleSwitchZone(zone.path)}
                        className="text-xs text-gray-400 hover:text-indigo-400 shrink-0"
                      >
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveZone(zone.path)}
                      className="text-xs text-gray-600 hover:text-red-400 shrink-0"
                    >
                      移除
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 添加新项目区 */}
            <div className="border-t border-gray-700 pt-4">
              <label className="text-sm text-gray-400 mb-2 block">添加项目区</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newZonePath}
                  onChange={e => { setNewZonePath(e.target.value); setZoneError(null) }}
                  placeholder="输入目录路径，如 /Users/jm02/项目区"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  onKeyDown={e => e.key === 'Enter' && handleAddZone()}
                />
                <button
                  onClick={handleAddZone}
                  disabled={!newZonePath.trim() || addingZone}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors shrink-0"
                >
                  {addingZone ? '添加中...' : '添加'}
                </button>
              </div>
              {zoneError && (
                <p className="text-xs text-red-400 mt-1">{zoneError}</p>
              )}
              <p className="text-xs text-gray-600 mt-1">路径必须已存在于本地文件系统</p>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
