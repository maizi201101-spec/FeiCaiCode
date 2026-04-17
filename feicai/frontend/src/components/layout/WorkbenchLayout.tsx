import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const TABS = ['资产库', '分镜规划', '装配与生成', '质检与确认'] as const

interface WorkbenchLayoutProps {
  children?: React.ReactNode
  activeTab: number
  onTabChange: (i: number) => void
}

export default function WorkbenchLayout({
  children,
  activeTab,
  onTabChange,
}: WorkbenchLayoutProps) {
  const { projectId } = useParams()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 px-4 py-2 flex items-center gap-4 shrink-0">
        <Link
          to="/"
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          ← 项目列表
        </Link>
        <span className="text-gray-600">|</span>
        <span className="text-sm font-medium">项目 #{projectId}</span>
        <span className="text-gray-600">|</span>
        <select className="bg-gray-900 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300">
          <option>EP01</option>
        </select>
        <div className="flex gap-1 ml-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => onTabChange(i)}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                activeTab === i
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="text-sm text-gray-400 hover:text-gray-200">
            任务 ●0
          </button>
          <button className="text-sm text-gray-400 hover:text-gray-200">
            ⚙ 设置
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧集数抽屉（占位） */}
        <aside className="w-0 border-r border-gray-800 overflow-hidden transition-all" />

        {/* 主工作区 */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
