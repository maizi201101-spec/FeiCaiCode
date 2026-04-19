/**
 * 系统配置组件
 * 项目区路径等全局设置
 */

import { useState, useEffect } from 'react'
import { getSystemSettings, updateSystemSettings } from '../../api/systemSettings'

interface SystemConfigProps {
  projectId: number
}

export default function SystemConfig({ projectId }: SystemConfigProps) {
  const [projectsRootPath, setProjectsRootPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getSystemSettings()
      .then(settings => {
        setProjectsRootPath(settings.projects_root_path || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSystemSettings({ projects_root_path })
      alert('保存成功')
    } catch (e) {
      alert('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">系统配置</h2>
        <p className="text-sm text-gray-400 mb-6">
          配置全局系统设置，所有项目共享
        </p>
      </div>

      {/* 项目区路径 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">项目区路径</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={projectsRootPath}
            onChange={(e) => setProjectsRootPath(e.target.value)}
            placeholder="例：/Users/jm02/TongBu/项目区"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100"
          />
          <p className="text-xs text-gray-500">
            新建项目时，项目文件夹会在此目录下自动创建。无需每次输入完整路径。
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}