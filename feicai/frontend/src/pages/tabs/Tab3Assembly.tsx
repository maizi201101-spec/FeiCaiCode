import { useState, useEffect, useMemo } from 'react'
import { usePrompts } from '../../hooks/usePrompts'
import { useShots } from '../../hooks/useShots'
import { useAssets } from '../../hooks/useAssets'
import { useGlobalSettings } from '../../hooks/useGlobalSettings'
import { updateGroupPrompt, resetGroupPrompt } from '../../api/prompts'
import { getImageUrl } from '../../api/assets'
import ShotNavPanel from '../../components/assembly/ShotNavPanel'
import GroupCentralWorkArea from '../../components/assembly/GroupCentralWorkArea'
import PreviewDrawer from '../../components/assembly/PreviewDrawer'
import ExportPromptsButton from '../../components/common/ExportPromptsButton'

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
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')

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

  // 提取本组用到的资产
  const groupAssets = useMemo(() => {
    if (!currentGroupShots.length) return []

    const assetIds = new Set<string>()
    currentGroupShots.forEach(shot => {
      if (shot.asset_refs) {
        // 从角色名找 asset_id
        shot.asset_refs.characters.forEach(c => {
          const asset = allAssets.find(a => a.name === c.name && a.asset_type === 'character')
          if (asset) assetIds.add(asset.asset_id)
        })
        // 从场景名找 asset_id
        shot.asset_refs.scenes.forEach(sceneName => {
          const asset = allAssets.find(a => a.name === sceneName && a.asset_type === 'scene')
          if (asset) assetIds.add(asset.asset_id)
        })
        // 从道具名找 asset_id
        shot.asset_refs.props.forEach(propName => {
          const asset = allAssets.find(a => a.name === propName && a.asset_type === 'prop')
          if (asset) assetIds.add(asset.asset_id)
        })
      }
    })

    return allAssets.filter(a => assetIds.has(a.asset_id))
  }, [currentGroupShots, allAssets])

  // 生成锚定声明
  const anchorDeclaration = useMemo(() => {
    if (selectedReferenceImages.length === 0) return ''

    return selectedReferenceImages.map((imgUrl, i) => {
      const asset = allAssets.find(a => {
        const url = a.images[0] ? getImageUrl(projectId, a.asset_type, a.asset_id, 1) : null
        return url === imgUrl
      })
      return asset ? `图${i + 1}是${asset.name}` : null
    }).filter(Boolean).join('，')
  }, [selectedReferenceImages, allAssets, projectId])

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

  // 更新时长默认值
  useEffect(() => {
    if (currentGroup) {
      setDuration(Math.ceil(currentGroup.total_duration))
    }
  }, [currentGroup])

  // Handlers
  const handleSelectGroup = (groupId: string) => {
    setCurrentGroupId(groupId)
    setSelectedReferenceImages([])
  }

  const handleToggleReference = (imageUrl: string) => {
    if (selectedReferenceImages.includes(imageUrl)) {
      setSelectedReferenceImages(prev => prev.filter(img => img !== imageUrl))
    } else if (selectedReferenceImages.length < 6) {
      setSelectedReferenceImages(prev => [...prev, imageUrl])
    }
  }

  const handleSaveGroupPrompt = async () => {
    if (!currentGroupId) return

    try {
      const referenceAssetIds = selectedReferenceImages.map(imgUrl => {
        const asset = allAssets.find(a => {
          const url = a.images[0] ? getImageUrl(projectId, a.asset_type, a.asset_id, 1) : null
          return url === imgUrl
        })
        return asset?.asset_id
      }).filter(Boolean) as string[]

      await updateGroupPrompt(episodeId, currentGroupId, {
        combined_video_prompt: editingPrompt,
        reference_asset_ids: referenceAssetIds
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
        confirmed: true
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
        <div className="text-sm text-gray-400">
          组级视频生成
        </div>
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
          episodeId={episodeId}
          currentGroupId={currentGroupId}
          groupShots={currentGroupShots}
          groupPrompts={currentGroupPrompts}
          savedGroupPrompt={savedGroupPrompt}
          groupAssets={groupAssets}
          onEditGroupPrompt={setEditingPrompt}
          onSaveGroupPrompt={handleSaveGroupPrompt}
          onResetGroupPrompt={handleResetGroupPrompt}
          onConfirmGroupPrompt={handleConfirmGroupPrompt}
          selectedReferenceImages={selectedReferenceImages}
          onToggleReference={handleToggleReference}
          anchorDeclaration={anchorDeclaration}
          settings={settings}
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
        anchorDeclaration={anchorDeclaration}
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
      />
    </div>
  )
}
