import { useState } from 'react'
import WorkbenchLayout from '../components/layout/WorkbenchLayout'

const TABS = ['资产库', '分镜规划', '装配与生成', '质检与确认'] as const

export default function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <WorkbenchLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-6">
        <p className="text-gray-500 text-sm">
          Tab {activeTab + 1}：{TABS[activeTab]}（开发中）
        </p>
      </div>
    </WorkbenchLayout>
  )
}
