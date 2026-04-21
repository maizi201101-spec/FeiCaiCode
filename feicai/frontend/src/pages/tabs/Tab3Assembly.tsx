import { useState, useEffect, useMemo, useRef } from 'react'
import { usePrompts } from '../../hooks/usePrompts'
import { useShots } from '../../hooks/useShots'
import { useAssets } from '../../hooks/useAssets'
import { useGlobalSettings } from '../../hooks/useGlobalSettings'
import { updateGroupPrompt, resetGroupPrompt } from '../../api/prompts'
import { type Asset, getImageUrl } from '../../api/assets'
import ShotNavPanel from '../../components/assembly/ShotNavPanel'
import GroupCentralWorkArea from '../../components/assembly/GroupCentralWorkArea'
import PreviewDrawer from '../../components/assembly/PreviewDrawer'
import ExportPromptsButton from '../../components/common/ExportPromptsButton'

// 当集资产条目（区分角色不同版本）
export interface EpisodeAssetItem {
  key: string          // 唯一标识：角色含版本 assetId_costume，场景/道具 assetId
  asset: Asset
  displayName: string  // 显示名：角色 "团团(书生装)"，场景/道具直接名称
  imageIndex: number   // 1-based，对应 getImageUrl 的第4参数
}

interface Tab3AssemblyProps {
  episodeId: number
  projectId: number
  revisionShotIds?: string[]
  focusGroupId?: string | null
  onFocusHandled?: () => void
}

export default function Tab3Assembly({
  episodeId,
  projectId,
  revisionShotIds = [],
  focusGroupId = null,
  onFocusHandled
}: Tab3AssemblyProps) {
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<EpisodeAssetItem[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')

  // 锚定声明（可编辑版本）
  const [editableAnchor, setEditableAnchor] = useState('')
  const isAnchorUserEditedRef = useRef(false)

  // 特殊提示词（第2块）
  const [specialPromptContent, setSpecialPromptContent] = useState('')
  const [specialPromptScope, setSpecialPromptScope] = useState<'group' | 'episode'>('group')

  // 生成参数
  const [duration, setDuration] = useState(12)
  const [resolution, setResolution] = useState('1080p')
  const [ratio, setRatio] = useState('9:16')

  // Hooks
  const { prompts, promptsCollection, loading: promptsLoading, generating, generatePrompts, refetch } = usePrompts(episodeId)
  const { shotsCollection, loading: shotsLoading } = useShots(episodeId)
  const { allAssets, loading: assetsLoading } = useAssets(projectId)
  const { settings } = useGlobalSettings(projectId)

  const isLoading = promptsLoading || shotsLoading || assetsLoading

  // 当前组数据
  const groups = shotsCollection?.groups || []
  const currentGroup = groups.find(g => g.group_id === currentGroupId) || null
  const currentGroupShots = useMemo(
    () => currentGroup ? shotsCollection!.shots.filter(s => currentGroup.shots.includes(s.shot_id)) : [],
    [currentGroup, shotsCollection]
  )
  const currentGroupPrompts = useMemo(
    () => prompts.filter(p => p.group_id === currentGroupId),
    [prompts, currentGroupId]
  )
  const savedGroupPrompt = promptsCollection?.group_prompts?.find(gp => gp.group_id === currentGroupId)

  // 当集所有资产条目（从全集 shots 汇总，角色按 costume 区分版本）
  const episodeAssets = useMemo(() => {
    if (!shotsCollection?.shots.length) return []

    const items: EpisodeAssetItem[] = []
    const seen = new Set<string>()

    shotsCollection.shots.forEach(shot => {
      // 优先使用 asset_bindings（已坍缩）
      if (shot.asset_bindings && shot.asset_bindings.length > 0) {
        shot.asset_bindings.forEach(binding => {
          const asset = allAssets.find(a => a.asset_id === binding.asset_id)
          if (!asset) return

          const key = binding.variant_id ? `${binding.asset_id}_${binding.variant_id}` : binding.asset_id
          if (seen.has(key)) return
          seen.add(key)

          let displayName = asset.name
          let imageIndex = 1

          if (binding.variant_id && asset.variants) {
            const variant = asset.variants.find(v => v.variant_id === binding.variant_id)
            if (variant) {
              displayName = `${asset.name}(${variant.variant_name})`
              imageIndex = asset.variants.indexOf(variant) + 1
            }
          }

          items.push({ key, asset, displayName, imageIndex })
        })
        return
      }

      // 降级：从 asset_refs 提取（fuzzy match）
      if (!shot.asset_refs) return

      // 角色：按 (assetId, costume) 区分版本
      shot.asset_refs.characters.forEach(c => {
        const asset = allAssets.find(a => a.name === c.name && a.asset_type === 'character')
        if (!asset) return

        const key = c.costume ? `${asset.asset_id}_${c.costume}` : asset.asset_id
        if (seen.has(key)) return
        seen.add(key)

        let imageIndex = 1
        if (c.costume && asset.variants?.length) {
          const vi = asset.variants.findIndex(
            v => v.variant_name === c.costume || v.variant_name.includes(c.costume) || c.costume.includes(v.variant_name)
          )
          if (vi >= 0) imageIndex = vi + 1
        }

        items.push({
          key,
          asset,
          displayName: c.costume ? `${c.name}(${c.costume})` : c.name,
          imageIndex,
        })
      })

      // 场景
      shot.asset_refs.scenes.forEach(sceneName => {
        const asset = allAssets.find(a => a.name === sceneName && a.asset_type === 'scene')
        if (!asset || seen.has(asset.asset_id)) return
        seen.add(asset.asset_id)
        items.push({ key: asset.asset_id, asset, displayName: sceneName, imageIndex: 1 })
      })

      // 道具
      shot.asset_refs.props.forEach(propName => {
        const asset = allAssets.find(a => a.name === propName && a.asset_type === 'prop')
        if (!asset || seen.has(asset.asset_id)) return
        seen.add(asset.asset_id)
        items.push({ key: asset.asset_id, asset, displayName: propName, imageIndex: 1 })
      })
    })

    return items
  }, [shotsCollection, allAssets])

  // 自动锚定声明（只读，基于选中顺序）
  const anchorDeclaration = useMemo(
    () => selectedItems.map((item, i) => `图${i + 1}是${item.displayName}`).join('，'),
    [selectedItems]
  )

  // 可编辑锚定声明：选中变化时同步（除非用户手动改过）
  useEffect(() => {
    if (!isAnchorUserEditedRef.current) {
      setEditableAnchor(anchorDeclaration)
    }
  }, [anchorDeclaration])

  // 组切换时重置锚定和选中
  useEffect(() => {
    isAnchorUserEditedRef.current = false
    setSelectedItems([])
    setEditableAnchor('')
  }, [currentGroupId])

  // 初始化：选中第一个组
  useEffect(() => {
    if (groups.length > 0 && !currentGroupId) {
      setCurrentGroupId(groups[0].group_id)
    }
  }, [groups, currentGroupId])

  // 焦点处理
  useEffect(() => {
    if (focusGroupId && focusGroupId !== currentGroupId) {
      setCurrentGroupId(focusGroupId)
      if (onFocusHandled) onFocusHandled()
    }
  }, [focusGroupId, currentGroupId, onFocusHandled])

  // 更新时长默认值（最小 4 秒）
  useEffect(() => {
    if (currentGroup) {
      setDuration(Math.max(4, Math.ceil(currentGroup.total_duration)))
    }
  }, [currentGroup])

  // Handlers
  const handleSelectGroup = (groupId: string) => {
    setCurrentGroupId(groupId)
  }

  const handleToggleItem = (item: EpisodeAssetItem) => {
    isAnchorUserEditedRef.current = false  // 点选时重置，让声明重新同步
    setSelectedItems(prev => {
      const exists = prev.some(i => i.key === item.key)
      if (exists) return prev.filter(i => i.key !== item.key)
      if (prev.length >= 6) return prev
      return [...prev, item]
    })
  }

  const handleSaveGroupPrompt = async () => {
    if (!currentGroupId) return

    try {
      await updateGroupPrompt(episodeId, currentGroupId, {
        combined_video_prompt: editingPrompt,
        reference_asset_ids: selectedItems.map(i => i.key),
        anchor_declaration: editableAnchor || undefined,
      })
      await refetch()
      alert('保存成功')
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    }
  }

  const handleResetGroupPrompt = async () => {
    if (!currentGroupId) return
    if (!confirm('确定要重置为自动拼接吗？')) return

    try {
      await resetGroupPrompt(episodeId, currentGroupId)
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : '重置失败')
    }
  }

  const handleConfirmGroupPrompt = async () => {
    if (!currentGroupId) return

    try {
      await updateGroupPrompt(episodeId, currentGroupId, {
        combined_video_prompt: editingPrompt,
        reference_asset_ids: selectedItems.map(i => i.key),
        anchor_declaration: editableAnchor || undefined,
        confirmed: true,
      })
      await refetch()
      alert('确认成功')
    } catch (e) {
      alert(e instanceof Error ? e.message : '确认失败')
    }
  }

  const handleGenerateVideo = async () => {
    alert('视频生成功能待接入 Dreamina CLI')
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>
  }

  if (!shotsCollection?.shots.length) {
    return <div className="flex h-full items-center justify-center text-gray-400">无分镜数据</div>
  }

  if (!prompts.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-gray-400">尚未生成提示词</div>
        <button
          onClick={generatePrompts}
          disabled={generating}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {generating ? '生成中...' : '生成提示词'}
        </button>
      </div>
    )
  }

  if (!currentGroupId) {
    return <div className="flex h-full items-center justify-center text-gray-400">请选择一个组</div>
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800 bg-gray-900">
        <div className="text-sm text-gray-400">组级视频生成</div>
        <ExportPromptsButton episodeId={episodeId} projectId={projectId} />
      </div>

      <div className="flex flex-1 min-h-0 gap-2 p-2">
        {/* 左侧导航 */}
        <div className="w-[18%] min-w-[180px] border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <ShotNavPanel
            shots={shotsCollection?.shots || []}
            prompts={prompts}
            currentShotId={null}
            currentGroupId={currentGroupId}
            onSelectShot={() => {}}
            onSelectGroup={handleSelectGroup}
            revisionShotIds={revisionShotIds}
            focusGroupId={focusGroupId}
            onFocusHandled={onFocusHandled}
          />
        </div>

        {/* 中央工作区 */}
        <GroupCentralWorkArea
          projectId={projectId}
          currentGroupId={currentGroupId}
          groupShots={currentGroupShots}
          groupPrompts={currentGroupPrompts}
          savedGroupPrompt={savedGroupPrompt}
          episodeAssets={episodeAssets}
          selectedItems={selectedItems}
          onToggleItem={handleToggleItem}
          anchorDeclaration={anchorDeclaration}
          editableAnchor={editableAnchor}
          onEditableAnchorChange={(text) => {
            isAnchorUserEditedRef.current = true
            setEditableAnchor(text)
          }}
          specialPromptContent={specialPromptContent}
          specialPromptScope={specialPromptScope}
          onSpecialPromptContentChange={setSpecialPromptContent}
          onSpecialPromptScopeChange={setSpecialPromptScope}
          onEditGroupPrompt={setEditingPrompt}
          onSaveGroupPrompt={handleSaveGroupPrompt}
          onResetGroupPrompt={handleResetGroupPrompt}
          onConfirmGroupPrompt={handleConfirmGroupPrompt}
          duration={duration}
          setDuration={setDuration}
          resolution={resolution}
          setResolution={setResolution}
          ratio={ratio}
          setRatio={setRatio}
          onGenerateVideo={handleGenerateVideo}
          generating={false}
          onShowPreview={() => setShowPreview(true)}
        />
      </div>

      {/* 抽屉预览 */}
      <PreviewDrawer
        open={showPreview}
        onClose={() => setShowPreview(false)}
        combinedPrompt={editingPrompt}
        anchorDeclaration={editableAnchor}
        specialPrompt={specialPromptContent}
        globalPrompt={settings?.global_prompt || ''}
        settings={{
          default_model: settings?.default_model || 'seedance2.0',
          default_duration: duration,
          default_resolution: resolution,
          default_ratio: ratio
        }}
        duration={duration}
        resolution={resolution}
        ratio={ratio}
        onGenerate={handleGenerateVideo}
        generating={false}
        selectedItems={selectedItems}
        projectId={projectId}
      />
    </div>
  )
}
