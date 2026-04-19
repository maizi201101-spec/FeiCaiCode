import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, loading, createProject } = useProjects()
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPath, setFormPath] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!formName.trim() || !formPath.trim()) return
    setCreating(true)
    setError(null)
    try {
      const project = await createProject({ name: formName.trim(), path: formPath.trim() })
      setShowModal(false)
      setFormName('')
      setFormPath('')
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">飞彩</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + 新建项目
        </button>
      </header>

      {/* 主内容 */}
      <main className="p-6">
        {loading ? (
          <div className="text-gray-500 text-sm">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-24 text-gray-600">
            <p className="text-lg mb-2">暂无项目</p>
            <p className="text-sm">点击右上角「新建项目」开始</p>
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
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">存储路径</label>
                <input
                  type="text"
                  value={formPath}
                  onChange={(e) => { setFormPath(e.target.value); setError(null) }}
                  placeholder="例：/Users/jm02/TongBu/我的项目"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-600 mt-1">项目文件将保存到此目录（会自动创建）</p>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setFormName(''); setFormPath(''); setError(null) }}
                className="flex-1 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!formName.trim() || !formPath.trim() || creating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {creating ? '创建中...' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}