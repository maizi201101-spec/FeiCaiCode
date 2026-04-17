import { useState, useEffect, useMemo } from 'react'
import { usePrompts } from '../../hooks/usePrompts'
import { useAssembly } from '../../hooks/useAssembly'
import { useShots } from '../../hooks/useShots'
import { useAssets } from '../../hooks/useAssets'
import { useGlobalSettings } from '../../hooks/useGlobalSettings'
import ShotNavPanel from '../../components/assembly/ShotNavPanel'
import CentralWorkArea from '../../components/assembly/CentralWorkArea'
import ParamsPanel from '../../components/assembly/ParamsPanel'
import { type Asset } from '../../api/assets'

interface Tab3AssemblyProps {
  episodeId: number
  projectId: number
}

export default function Tab3Assembly({ episodeId, projectId }: Tab3AssemblyProps) {
  const [globalPrompt, setGlobalPrompt] = useState('')

  // Hooks
  const {
    prompts,
    loading: promptsLoading,
    generating,
    error: promptsError,
    generatePrompts,
    editPrompt,
    confirmPrompt,
  } = usePrompts(episodeId)

  const {
    shotsCollection,
    loading: shotsLoading,
  } = useShots(episodeId)

  const { allAssets, loading: assetsLoading } = useAssets(projectId)

  const { settings } = useGlobalSettings(projectId)

  // Assembly state
  const assembly = useAssembly(prompts, globalPrompt)

  // Sync global prompt from settings
  useEffect(() => {
    if (settings?.global_prompt) {
      setGlobalPrompt(settings.global_prompt)
    }
  }, [settings])

  // 按类型分组资产
  const groupedAssets = useMemo(() => {
    const characters = allAssets.filter(a => a.asset_type === 'character')
    const scenes = allAssets.filter(a => a.asset_type === 'scene')
    const props = allAssets.filter(a => a.asset_type === 'prop')
    return { characters, scenes, props }
  }, [allAssets])

  // Loading state
  const isLoading = promptsLoading || shotsLoading || assetsLoading

  // Generate prompts handler
  const handleGeneratePrompts = async () => {
    try {
      await generatePrompts()
    } catch (e) {
      console.error('生成提示词失败:', e)
    }
  }

  // Edit prompt handler
  const handleEditPrompt = async (shotId: string, imagePrompt?: string, videoPrompt?: string) => {
    try {
      await editPrompt(shotId, {
        image_prompt: imagePrompt,
        video_prompt: videoPrompt,
      })
    } catch (e) {
      console.error('更新提示词失败:', e)
    }
  }

  // Confirm prompt handler
  const handleConfirmPrompt = async (shotId: string) => {
    try {
      await confirmPrompt(shotId)
    } catch (e) {
      console.error('确认提示词失败:', e)
    }
  }

  // Get current prompt data
  const currentPrompt = prompts.find(p => p.shot_id === assembly.currentShotId)
  const currentShot = shotsCollection?.shots.find(s => s.shot_id === assembly.currentShotId)

  // Build final video prompt for display
  const finalVideoPrompt = assembly.currentShotId
    ? assembly.getFinalVideoPrompt(assembly.currentShotId)
    : ''

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  if (!shotsCollection?.shots.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-gray-400">无分镜数据，请先在 Tab 2 完成分镜规划</div>
      </div>
    )
  }

  if (!prompts.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-gray-400">尚未生成提示词</div>
        <button
          onClick={handleGeneratePrompts}
          disabled={generating}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {generating ? '生成中...' : '生成提示词'}
        </button>
        {promptsError && <div className="text-red-500">{promptsError}</div>}
      </div>
    )
  }

  return (
    <div className="flex h-full gap-2 p-2">
      {/* 左列：镜头导航 */}
      <div className="w-[15%] min-w-[180px] border rounded bg-white overflow-hidden">
        <ShotNavPanel
          shots={shotsCollection?.shots || []}
          prompts={prompts}
          currentShotId={assembly.currentShotId}
          onSelectShot={(shotId, groupId) => assembly.selectShot(shotId, groupId)}
        />
      </div>

      {/* 中央：工作区 */}
      <div className="w-[55%] border rounded bg-white overflow-hidden flex flex-col">
        <CentralWorkArea
          mode={assembly.mode}
          onModeChange={assembly.setMode}
          currentShot={currentShot}
          currentPrompt={currentPrompt}
          allAssets={allAssets}
          groupedAssets={groupedAssets}
          onEditPrompt={handleEditPrompt}
          onConfirm={handleConfirmPrompt}
          specialPrompts={assembly.specialPrompts}
          onAddSpecial={assembly.addSpecialPrompt}
          onRemoveSpecial={assembly.removeSpecialPrompt}
          currentGroupId={assembly.currentGroupId}
          shotIds={shotsCollection?.shots.map(s => s.shot_id) || []}
        />
      </div>

      {/* 右列：参数面板 */}
      <div className="w-[30%] min-w-[280px] border rounded bg-white overflow-hidden">
        <ParamsPanel
          settings={settings}
          referenceImages={assembly.referenceImages}
          onSetReferenceImages={assembly.setReferenceImages}
          globalPrompt={globalPrompt}
          finalVideoPrompt={finalVideoPrompt}
          currentShotId={assembly.currentShotId}
          allAssets={allAssets}
          groupedAssets={groupedAssets}
        />
      </div>
    </div>
  )
}