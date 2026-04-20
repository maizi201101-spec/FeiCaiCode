import { useState, useEffect, useMemo } from 'react'
import { usePrompts } from '../../hooks/usePrompts'
import { useAssembly } from '../../hooks/useAssembly'
import { useShots } from '../../hooks/useShots'
import { useAssets } from '../../hooks/useAssets'
import { useGlobalSettings } from '../../hooks/useGlobalSettings'
import { useVideoGeneration } from '../../hooks/useVideoGeneration'
import ShotNavPanel from '../../components/assembly/ShotNavPanel'
import CentralWorkArea from '../../components/assembly/CentralWorkArea'
import ParamsPanel from '../../components/assembly/ParamsPanel'
import ExportPromptsButton from '../../components/common/ExportPromptsButton'

interface Tab3AssemblyProps {
  episodeId: number
  projectId: number
  revisionShotIds?: string[]
  focusGroupId?: string | null
  onFocusHandled?: () => void
}

export default function Tab3Assembly({ episodeId, projectId, revisionShotIds = [], focusGroupId = null, onFocusHandled }: Tab3AssemblyProps) {
  const [globalPrompt, setGlobalPrompt] = useState('')

  // Hooks
  const { prompts, loading: promptsLoading, generating, generatePrompts, editPrompt, confirmPrompt } = usePrompts(episodeId)
  const { shotsCollection, loading: shotsLoading } = useShots(episodeId)
  const { allAssets, loading: assetsLoading } = useAssets(projectId)
  const { settings } = useGlobalSettings(projectId)
  const videoGen = useVideoGeneration(episodeId)

  // Assembly state
  const assembly = useAssembly(prompts, globalPrompt)

  // Sync global prompt
  useEffect(() => {
    if (settings?.global_prompt) setGlobalPrompt(settings.global_prompt)
  }, [settings])

  // 切换镜头时加载视频版本
  useEffect(() => {
    if (assembly.currentShotId && assembly.mode === 'video') {
      videoGen.fetchVersions(assembly.currentShotId)
    } else {
      videoGen.clearVersions()
    }
  }, [assembly.currentShotId, assembly.mode])

  // 按类型分组资产
  const groupedAssets = useMemo(() => ({
    characters: allAssets.filter(a => a.asset_type === 'character'),
    scenes: allAssets.filter(a => a.asset_type === 'scene'),
    props: allAssets.filter(a => a.asset_type === 'prop'),
  }), [allAssets])

  // Loading state
  const isLoading = promptsLoading || shotsLoading || assetsLoading

  // Handlers
  const handleEditPrompt = async (shotId: string, imagePrompt?: string, videoPrompt?: string) => {
    try { await editPrompt(shotId, { image_prompt: imagePrompt, video_prompt: videoPrompt }) }
    catch (e) { console.error('更新提示词失败:', e) }
  }

  const handleConfirmPrompt = async (shotId: string) => {
    try { await confirmPrompt(shotId) }
    catch (e) { console.error('确认提示词失败:', e) }
  }

  // 视频生成 handler
  const handleGenerateVideo = async () => {
    if (!assembly.currentShotId || !currentPrompt) return
    try {
      await videoGen.submitGeneration({
        shot_id: assembly.currentShotId,
        video_prompt: finalVideoPrompt,
        reference_images: assembly.referenceImages,
        anchor_declaration: anchorDeclaration,
        model: settings?.default_model || 'seedance2.0',
        duration: settings?.default_duration || 4,
        resolution: settings?.default_resolution || '1080p',
      })
    } catch (e) { console.error('视频生成失败:', e) }
  }

  // Current data
  const currentPrompt = prompts.find(p => p.shot_id === assembly.currentShotId)
  const currentShot = shotsCollection?.shots.find(s => s.shot_id === assembly.currentShotId)
  const groups = shotsCollection?.groups || []
  const currentGroup = groups.find(g => g.group_id === assembly.currentGroupId) || null
  const currentGroupShots = currentGroup
    ? shotsCollection!.shots.filter(s => currentGroup.shots.includes(s.shot_id))
    : []
  const finalVideoPrompt = assembly.currentShotId ? assembly.getFinalVideoPrompt(assembly.currentShotId) : ''
  const anchorDeclaration = assembly.referenceImages.map((img, i) => {
    const asset = allAssets.find(a => a.images?.[0] === img)
    return asset ? `图${i + 1}是${asset.name}` : null
  }).filter(Boolean).join('，')

  if (isLoading) return <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>
  if (!shotsCollection?.shots.length) return <div className="flex h-full items-center justify-center text-gray-400">无分镜数据</div>
  if (!prompts.length) return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="text-gray-400">尚未生成提示词</div>
      <button onClick={generatePrompts} disabled={generating} className="px-4 py-2 bg-blue-500 text-white rounded">{generating ? '生成中...' : '生成提示词'}</button>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800 bg-gray-900">
        <div className="text-sm text-gray-400">
          提示词装配与视频生成
        </div>
        <ExportPromptsButton episodeId={episodeId} projectId={projectId} />
      </div>
      <div className="flex flex-1 min-h-0 gap-2 p-2">
      <div className="w-[15%] min-w-[180px] border border-gray-800 rounded bg-gray-900 overflow-hidden">
        <ShotNavPanel
          shots={shotsCollection?.shots || []}
          prompts={prompts}
          currentShotId={assembly.currentShotId}
          currentGroupId={assembly.currentGroupId}
          onSelectShot={assembly.selectShot}
          onSelectGroup={assembly.selectGroup}
          revisionShotIds={revisionShotIds}
          focusGroupId={focusGroupId}
          onFocusHandled={onFocusHandled}
        />
      </div>
      <div className="w-[55%] border border-gray-800 rounded bg-gray-900 overflow-hidden flex flex-col">
        <CentralWorkArea
          mode={assembly.mode}
          onModeChange={assembly.setMode}
          currentShot={currentShot}
          currentPrompt={currentPrompt}
          allAssets={allAssets}
          groupedAssets={groupedAssets}
          projectId={projectId}
          onEditPrompt={handleEditPrompt}
          onConfirm={handleConfirmPrompt}
          specialPrompts={assembly.specialPrompts}
          onAddSpecial={assembly.addSpecialPrompt}
          onRemoveSpecial={assembly.removeSpecialPrompt}
          currentGroupId={assembly.currentGroupId}
          currentGroupShots={currentGroupShots}
          currentGroup={currentGroup}
          allPrompts={prompts}
          shotIds={shotsCollection?.shots.map(s => s.shot_id) || []}
          videoVersions={videoGen.versions}
          currentVersionId={videoGen.currentVersionId}
          onSelectVersion={videoGen.selectVersion}
          onMarkApproved={videoGen.markApproved}
          onMarkRejected={videoGen.markRejected}
          videoGenerating={videoGen.generating}
        />
      </div>
      <div className="w-[30%] min-w-[280px] border border-gray-800 rounded bg-gray-900 overflow-hidden">
        <ParamsPanel
          projectId={projectId}
          settings={settings}
          referenceImages={assembly.referenceImages}
          onSetReferenceImages={assembly.setReferenceImages}
          globalPrompt={globalPrompt}
          finalVideoPrompt={finalVideoPrompt}
          currentShotId={assembly.currentShotId}
          currentGroup={currentGroup}
          groupedAssets={groupedAssets}
          onGenerateVideo={handleGenerateVideo}
          videoGenerating={videoGen.generating}
        />
      </div>
    </div>
    </div>
  )
}