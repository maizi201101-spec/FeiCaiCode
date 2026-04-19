/**
 * 提供商配置组件
 * 管理 LLM、图片模型、视频模型三类提供商
 * 暗色主题版本
 */

import { useState } from 'react'
import {
  type Provider,
  type ProviderType,
  type ProviderCreatePayload,
  PROVIDER_TYPE_LABELS,
  IMPLEMENTATION_TYPE_LABELS,
  USAGE_TAG_LABELS,
} from '../../api/providers'
import { useProviders } from '../../hooks/useProviders'

interface ProvidersConfigProps {
  projectId: number
  providerType?: ProviderType // 可选，由父组件指定类型
}

export default function ProvidersConfig({ projectId, providerType }: ProvidersConfigProps) {
  const {
    loading,
    error,
    create,
    update,
    remove,
    setDefault,
    getByType,
    getDefaultByType,
  } = useProviders(projectId)

  const [selectedType, setSelectedType] = useState<ProviderType>(
    providerType || 'llm'
  )
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<ProviderCreatePayload>({
    name: '',
    provider_type: providerType || 'llm',
    impl_type: 'http_api',
    api_key: '',
    base_url: '',
    model_name: '',
    usage_tags: [],
  })

  const typeProviders = getByType(selectedType)

  const handleSetDefault = async (provider: Provider) => {
    try {
      await setDefault(provider.provider_type, provider.provider_id)
    } catch (e) {
      console.error('设置默认失败:', e)
    }
  }

  const handleCreate = async () => {
    if (!createForm.name) return
    try {
      await create(createForm)
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        provider_type: providerType || selectedType,
        impl_type: 'http_api',
        api_key: '',
        base_url: '',
        model_name: '',
        usage_tags: [],
      })
    } catch (e) {
      console.error('创建失败:', e)
    }
  }

  const handleDelete = async (provider: Provider) => {
    if (provider.is_builtin) {
      alert('内置提供商不能删除')
      return
    }
    if (!confirm('确定删除此提供商？')) return
    try {
      await remove(provider.provider_id)
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  const handleEdit = async () => {
    if (!editingProvider) return
    try {
      await update(editingProvider.provider_id, {
        name: editingProvider.name,
        api_key: editingProvider.api_key,
        base_url: editingProvider.base_url,
        model_name: editingProvider.model_name,
        cli_path: editingProvider.cli_path,
        usage_tags: editingProvider.usage_tags,
      })
      setEditingProvider(null)
    } catch (e) {
      console.error('更新失败:', e)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-200 mb-2">
          {providerType ? `${PROVIDER_TYPE_LABELS[providerType]}提供商` : 'API 提供商配置'}
        </h2>
        <p className="text-sm text-gray-400">
          {providerType ? `管理${PROVIDER_TYPE_LABELS[providerType]}相关提供商` : '管理 LLM、图片模型、视频模型提供商'}
        </p>
      </div>

      {/* 类型选择 - 父组件指定类型时隐藏 */}
      {!providerType && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
          <div className="flex gap-2">
            {(['llm', 'image', 'video'] as ProviderType[]).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-2 rounded border text-sm ${
                  selectedType === type
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {PROVIDER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 提供商列表 */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 mb-4">
        <div className="space-y-3">
          {loading && <div className="text-gray-500 text-sm">加载中...</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}

          {typeProviders.map(provider => {
            const isDefault = getDefaultByType(provider.provider_type)?.provider_id === provider.provider_id
            return (
              <div
                key={provider.provider_id}
                className={`p-4 rounded-lg border ${
                  isDefault ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">{provider.name}</span>
                      {provider.is_builtin && (
                        <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                          内置
                        </span>
                      )}
                      {isDefault && (
                        <span className="px-1.5 py-0.5 bg-indigo-600 text-indigo-200 text-xs rounded">
                          默认
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                        {IMPLEMENTATION_TYPE_LABELS[provider.impl_type]}
                      </span>
                    </div>
                    {provider.provider_type === 'llm' && provider.usage_tags.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1 flex gap-1">
                        用途：{provider.usage_tags.map(t => USAGE_TAG_LABELS[t]).join('、')}
                      </div>
                    )}
                    {provider.impl_type === 'http_api' && provider.base_url && (
                      <div className="text-xs text-gray-500 mt-1">
                        Base URL: {provider.base_url}
                      </div>
                    )}
                    {provider.impl_type === 'jimeng_cli' && provider.cli_path && (
                      <div className="text-xs text-gray-500 mt-1">
                        CLI 路径: {provider.cli_path}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefault(provider)}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => setEditingProvider(provider)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                    >
                      编辑
                    </button>
                    {!provider.is_builtin && (
                      <button
                        onClick={() => handleDelete(provider)}
                        className="px-3 py-1 text-xs bg-red-900 text-red-300 rounded hover:bg-red-800"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {typeProviders.length === 0 && !loading && (
            <div className="text-gray-500 text-sm text-center py-8">
              此类型暂无提供商，点击下方按钮新建
            </div>
          )}
        </div>
      </div>

      {/* 新建按钮 */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500"
      >
        + 新建提供商
      </button>

      {/* 创建弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-200 mb-4">新建提供商</h4>
            <div className="space-y-4">
              {/* 类型选择 - 父组件指定类型时隐藏 */}
              {!providerType && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">类型</label>
                  <select
                    value={createForm.provider_type}
                    onChange={e => setCreateForm(prev => ({
                      ...prev,
                      provider_type: e.target.value as ProviderType,
                    }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    {(['llm', 'image', 'video'] as ProviderType[]).map(type => (
                      <option key={type} value={type}>{PROVIDER_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 block mb-1">名称 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  placeholder="提供商名称"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">实现类型</label>
                <select
                  value={createForm.impl_type || 'http_api'}
                  onChange={e => setCreateForm(prev => ({
                    ...prev,
                    impl_type: e.target.value as 'http_api' | 'jimeng_cli',
                  }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="http_api">HTTP API</option>
                  <option value="jimeng_cli">即梦 CLI</option>
                </select>
              </div>
              {createForm.impl_type === 'http_api' && (
                <>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">API Key</label>
                    <input
                      type="password"
                      value={createForm.api_key || ''}
                      onChange={e => setCreateForm(prev => ({ ...prev, api_key: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                      placeholder="API Key"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Base URL</label>
                    <input
                      type="text"
                      value={createForm.base_url || ''}
                      onChange={e => setCreateForm(prev => ({ ...prev, base_url: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                      placeholder="https://api.example.com/v1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">模型名称</label>
                    <input
                      type="text"
                      value={createForm.model_name || ''}
                      onChange={e => setCreateForm(prev => ({ ...prev, model_name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                      placeholder="gpt-4"
                    />
                  </div>
                </>
              )}
              {createForm.impl_type === 'jimeng_cli' && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">CLI 路径</label>
                  <input
                    type="text"
                    value={createForm.cli_path || ''}
                    onChange={e => setCreateForm(prev => ({ ...prev, cli_path: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                    placeholder="/path/to/jimeng-cli"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.name}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-[500px] max-w-full">
            <h4 className="font-medium text-gray-200 mb-4">编辑提供商</h4>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">名称</label>
                <input
                  type="text"
                  value={editingProvider.name}
                  onChange={e => setEditingProvider(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {editingProvider.impl_type === 'http_api' && (
                <>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">API Key</label>
                    <input
                      type="password"
                      value={editingProvider.api_key || ''}
                      onChange={e => setEditingProvider(prev => prev ? { ...prev, api_key: e.target.value } : null)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Base URL</label>
                    <input
                      type="text"
                      value={editingProvider.base_url || ''}
                      onChange={e => setEditingProvider(prev => prev ? { ...prev, base_url: e.target.value } : null)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">模型名称</label>
                    <input
                      type="text"
                      value={editingProvider.model_name || ''}
                      onChange={e => setEditingProvider(prev => prev ? { ...prev, model_name: e.target.value } : null)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}
              {editingProvider.impl_type === 'jimeng_cli' && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">CLI 路径</label>
                  <input
                    type="text"
                    value={editingProvider.cli_path || ''}
                    onChange={e => setEditingProvider(prev => prev ? { ...prev, cli_path: e.target.value } : null)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}