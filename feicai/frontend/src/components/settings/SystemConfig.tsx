/**
 * 系统配置组件
 * 项目区管理：列表 + 激活切换 + 添加/移除
 */

import { useState, useEffect } from 'react'
import {
  getProjectZones,
  addProjectZone,
  removeProjectZone,
  setActiveZone,
  type ProjectZone,
} from '../../api/systemSettings'

interface SystemConfigProps {
  projectId: number
}

export default function SystemConfig({ projectId: _ }: SystemConfigProps) {
  const [zones, setZones] = useState<ProjectZone[]>([])
  const [activeZone, setActiveZoneState] = useState('')
  const [newPath, setNewPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadZones = () => {
    setLoading(true)
    getProjectZones()
      .then(data => {
        setZones(data.zones)
        setActiveZoneState(data.active_zone)
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadZones() }, [])

  const handleAdd = async () => {
    if (!newPath.trim()) return
    setSaving(true)
    setError('')
    try {
      const data = await addProjectZone(newPath.trim())
      setZones(data.zones)
      setActiveZoneState(data.active_zone)
      setNewPath('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (path: string) => {
    if (path === activeZone) return
    setSaving(true)
    setError('')
    try {
      await setActiveZone(path)
      setActiveZoneState(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : '切换失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (path: string) => {
    if (zones.length <= 1) { setError('至少保留一个项目区'); return }
    setSaving(true)
    setError('')
    try {
      const data = await removeProjectZone(path)
      setZones(data.zones)
      setActiveZoneState(data.active_zone)
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">系统配置</h2>
        <p className="text-sm text-gray-400 mb-6">配置全局系统设置，所有项目共享</p>
      </div>

      {/* 项目区列表 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">项目区管理</h3>
        <p className="text-xs text-gray-500 mb-4">
          新建项目时，项目文件夹会在激活的项目区目录下自动创建。
        </p>

        <div className="space-y-2 mb-4">
          {zones.length === 0 && (
            <p className="text-sm text-gray-500">暂无项目区，请添加</p>
          )}
          {zones.map(zone => (
            <div
              key={zone.path}
              className={`flex items-center justify-between px-3 py-2 rounded border ${
                zone.path === activeZone
                  ? 'border-indigo-500 bg-indigo-900/20'
                  : 'border-gray-700 bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {zone.path === activeZone && (
                  <span className="text-indigo-400 text-xs shrink-0">✓ 激活</span>
                )}
                <span className="text-sm text-gray-200 truncate">{zone.path}</span>
              </div>
              <div className="flex gap-2 shrink-0 ml-2">
                {zone.path !== activeZone && (
                  <button
                    onClick={() => handleActivate(zone.path)}
                    disabled={saving}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    激活
                  </button>
                )}
                <button
                  onClick={() => handleRemove(zone.path)}
                  disabled={saving || zones.length <= 1}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 添加新项目区 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="例：/Users/name/Projects"
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newPath.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500 disabled:opacity-50 shrink-0"
          >
            添加
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  )
}
