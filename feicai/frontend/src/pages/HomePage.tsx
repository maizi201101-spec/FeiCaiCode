import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">飞彩</h1>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          新建项目
        </button>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-3 gap-4 max-w-5xl">
          <div className="border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors cursor-pointer">
            <Link to="/project/1">
              <p className="font-medium text-gray-100">示例项目</p>
              <p className="text-sm text-gray-500 mt-1">0 集 · 刚刚创建</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
