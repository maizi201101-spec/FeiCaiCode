import { useRef } from 'react'
import { type Shot } from '../../api/shots'
import { type Prompt, type SpecialPrompt } from '../../api/prompts'
import { type Asset, getImageUrl } from '../../api/assets'
import { type VideoVersion } from '../../api/videos'
import VideoVersionTabs from './VideoVersionTabs'

interface GroupedAssets {
  characters: Asset[]
  scenes: Asset[]
  props: Asset[]
}

interface CentralWorkAreaProps {
  mode: 'image' | 'video'
  onModeChange: (mode: 'image' | 'video') => void
  currentShot: Shot | undefined
  currentPrompt: Prompt | undefined
  allAssets: Asset[]
  groupedAssets: GroupedAssets
  projectId: number
  onEditPrompt: (shotId: string, imagePrompt?: string, videoPrompt?: string) => void
  onConfirm: (shotId: string) => void
  specialPrompts: SpecialPrompt[]
  onAddSpecial: (content: string, scope: SpecialPrompt['scope'], targetIds: string[]) => void
  onRemoveSpecial: (id: string) => void
  currentGroupId: string | null
  shotIds: string[]
  videoVersions?: VideoVersion[]
  currentVersionId?: number | null | undefined
  onSelectVersion?: (versionId: number) => void
  onMarkApproved?: (versionId: number) => void
  onMarkRejected?: (versionId: number) => void
  videoGenerating?: boolean
}

export default function CentralWorkArea({
  mode,
  onModeChange,
  currentShot,
  currentPrompt,
  allAssets,
  groupedAssets,
  projectId,
  onEditPrompt,
  onConfirm,
  specialPrompts,
  onAddSpecial,
  onRemoveSpecial,
  currentGroupId,
  shotIds,
  videoVersions = [],
  currentVersionId,
  onSelectVersion,
  onMarkApproved,
  onMarkRejected,
  videoGenerating = false,
}: CentralWorkAreaProps) {
  const scopeRef = useRef<HTMLSelectElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!currentShot) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        请从左侧选择一个镜头
      </div>
    )
  }

  // 当前镜头引用的资产 ID
  const referencedAssetIds = currentShot.assets || []
  // 判断是否被引用（使用 referencedAssetIds）
  const isReferenced = (assetId: string) => referencedAssetIds.includes(assetId)

  // 生成 asset_refs 锚定声明行
  const buildAnchorLine = (): string => {
    const refs = currentShot.asset_refs
    if (!refs) return ''
    const parts: string[] = []
    for (const c of refs.characters) {
      parts.push(`@${c.name}是${c.costume || c.name}`)
    }
    for (const s of refs.scenes) {
      parts.push(`@${s}`)
    }
    for (const p of refs.props) {
      parts.push(`@${p}`)
    }
    if (refs.shot_annotations) parts.push(refs.shot_annotations)
    return parts.join('；')
  }

  const handlePrefillAnchor = () => {
    const anchor = buildAnchorLine()
    if (!anchor) return
    const existing = currentPrompt?.image_prompt || ''
    const newVal = existing ? `${anchor}；${existing}` : `${anchor}；`
    onEditPrompt(currentShot.shot_id, newVal, undefined)
  }

  // 获取作用范围的目标 IDs
  const getScopeTargetIds = (scope: SpecialPrompt['scope']): string[] => {
    switch (scope) {
      case 'shot':
        return [currentShot.shot_id]
      case 'group':
        return currentGroupId ? [currentGroupId] : []
      case 'episode':
        return shotIds
      case 'selected':
        return [currentShot.shot_id]
      default:
        return []
    }
  }

  // 添加特殊提示词
  const handleAddSpecial = () => {
    const content = inputRef.current?.value.trim()
    if (!content) return
    const scope = (scopeRef.current?.value || 'shot') as SpecialPrompt['scope']
    const targetIds = getScopeTargetIds(scope)
    onAddSpecial(content, scope, targetIds)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 模式切换 */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-900">
        <button
          onClick={() => onModeChange('image')}
          className={`px-3 py-1 text-sm rounded ${
            mode === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          图片模式
        </button>
        <button
          onClick={() => onModeChange('video')}
          className={`px-3 py-1 text-sm rounded ${
            mode === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          视频模式
        </button>

        {/* 镜头信息 */}
        <div className="ml-4 text-sm text-gray-400">
          <span className="font-mono">{currentShot.shot_id}</span>
          <span className="mx-2">|</span>
          <span>{currentShot.shot_size}</span>
          <span className="mx-1">/</span>
          <span>{currentShot.camera_move}</span>
        </div>

        {/* 状态标记 */}
        <div className="ml-auto">
          {currentPrompt?.confirmed ? (
            <span className="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">已确认</span>
          ) : currentPrompt ? (
            <span className="px-2 py-1 text-xs bg-orange-900/50 text-orange-400 rounded">待审</span>
          ) : (
            <span className="px-2 py-1 text-xs bg-gray-800 text-gray-500 rounded">未生成</span>
          )}
        </div>
      </div>

      {/* 本集全部资产缩略图（高亮引用资产） */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-800 overflow-x-auto bg-gray-900 max-h-[70px]">
        {/* 人物 */}
        {groupedAssets.characters.slice(0, 6).map((asset) => {
          const ref = isReferenced(asset.asset_id)
          const imgUrl = asset.images.length > 0 ? getImageUrl(projectId, asset.asset_type, asset.asset_id, 1) : null
          return (
            <div
              key={asset.asset_id}
              className={`flex flex-col items-center gap-0.5 rounded p-0.5 ${
                ref ? 'ring-2 ring-blue-500 bg-blue-900/30' : 'opacity-60'
              }`}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={asset.name} className="w-8 h-8 rounded object-cover" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                  {asset.name.slice(0, 2)}
                </div>
              )}
              <span className={`text-xs truncate max-w-[50px] ${ref ? 'text-gray-200' : 'text-gray-500'}`}>
                {asset.name}
              </span>
            </div>
          )
        })}
        {/* 场景 */}
        {groupedAssets.scenes.slice(0, 4).map((asset) => {
          const ref = isReferenced(asset.asset_id)
          const imgUrl = asset.images.length > 0 ? getImageUrl(projectId, asset.asset_type, asset.asset_id, 1) : null
          return (
            <div
              key={asset.asset_id}
              className={`flex flex-col items-center gap-0.5 rounded p-0.5 ${
                ref ? 'ring-2 ring-blue-500 bg-blue-900/30' : 'opacity-60'
              }`}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={asset.name} className="w-8 h-8 rounded object-cover" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                  {asset.name.slice(0, 2)}
                </div>
              )}
              <span className={`text-xs truncate max-w-[50px] ${ref ? 'text-gray-200' : 'text-gray-500'}`}>
                {asset.name}
              </span>
            </div>
          )
        })}
        {/* 道具 */}
        {groupedAssets.props.slice(0, 4).map((asset) => {
          const ref = isReferenced(asset.asset_id)
          const imgUrl = asset.images.length > 0 ? getImageUrl(projectId, asset.asset_type, asset.asset_id, 1) : null
          return (
            <div
              key={asset.asset_id}
              className={`flex flex-col items-center gap-0.5 rounded p-0.5 ${
                ref ? 'ring-2 ring-blue-500 bg-blue-900/30' : 'opacity-60'
              }`}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={asset.name} className="w-8 h-8 rounded object-cover" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                  {asset.name.slice(0, 2)}
                </div>
              )}
              <span className={`text-xs truncate max-w-[50px] ${ref ? 'text-gray-200' : 'text-gray-500'}`}>
                {asset.name}
              </span>
            </div>
          )
        })}
        {allAssets.length === 0 && (
          <span className="text-xs text-gray-400">无资产数据</span>
        )}
      </div>

      {/* 预览区（视频模式显示视频播放器 + 版本标签） */}
      <div className="h-24 border-b border-gray-800 bg-gray-800 flex items-center justify-center">
        {mode === 'video' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1">
            {/* 视频播放器 */}
            {videoVersions.length > 0 && currentVersionId ? (
              <video
                src={videoVersions.find(v => v.id === currentVersionId)?.video_path}
                className="max-h-16 rounded"
                controls
              />
            ) : (
              <div className="text-xs text-gray-400">无视频，点击右列「生成此镜头」</div>
            )}
            {/* 版本标签 */}
            <VideoVersionTabs
              versions={videoVersions}
              currentVersionId={currentVersionId ?? null}
              onSelectVersion={onSelectVersion || (() => {})}
              onMarkApproved={onMarkApproved || (() => {})}
              onMarkRejected={onMarkRejected || (() => {})}
              generating={videoGenerating}
            />
          </div>
        ) : (
          <div className="text-xs text-gray-400">分镜图预览区（Phase 8）</div>
        )}
      </div>

      {/* 提示词编辑区域 */}
      <div className="flex-1 overflow-auto p-2">
        {mode === 'image' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">图片提示词</label>
              {currentShot.asset_refs && (
                <button
                  onClick={handlePrefillAnchor}
                  className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  title="将 asset_refs 装扮信息预填为锚定声明行"
                >
                  预填锚定声明
                </button>
              )}
            </div>
            <textarea
              className="w-full h-32 border border-gray-700 rounded p-2 text-sm resize-none focus:border-blue-500 focus:outline-none bg-gray-800 text-gray-200 placeholder-gray-600"
              value={currentPrompt?.image_prompt || ''}
              onChange={(e) => onEditPrompt(currentShot.shot_id, e.target.value, undefined)}
              placeholder="格式: @资产引用；景别构图；人物状态；光影；风格；负面提示"
            />
            <div className="text-xs text-gray-400">
              提示词格式：分号分隔，资产引用顺序：人物 → 场景 → 道具
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">视频提示词</label>
            <textarea
              className="w-full h-48 border border-gray-700 rounded p-2 text-sm resize-none focus:border-blue-500 focus:outline-none bg-gray-800 text-gray-200 placeholder-gray-600"
              value={currentPrompt?.video_prompt || ''}
              onChange={(e) => onEditPrompt(currentShot.shot_id, undefined, e.target.value)}
              placeholder="格式: 【景别】...【运镜】...【画面描述】...【台词】..."
            />
            <div className="text-xs text-gray-400">
              提示词格式：【字段】格式，台词锁定不可改写
            </div>

            {/* 台词显示（只读） */}
            {currentShot.speech?.length > 0 && (
              <div className="border border-gray-700 rounded p-2 bg-gray-800">
                <div className="text-xs font-medium text-gray-400 mb-1">台词（锁定）</div>
                {currentShot.speech.map((sp, i) => (
                  <div key={i} className="text-sm">
                    {sp.type === 'dialogue' ? (
                      <span>
                        <span className="font-medium">{sp.speaker}:</span> "{sp.text}"
                      </span>
                    ) : (
                      <span className="text-gray-500">OS: "{sp.text}"</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 特殊提示词配置 */}
      <div className="border-t border-gray-800 p-2">
        <div className="text-sm font-medium mb-2">特殊效果提示词</div>
        <div className="flex flex-wrap gap-1">
          {specialPrompts.map((sp) => (
            <div key={sp.id} className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-sm">
              <span className="truncate max-w-[80px]">{sp.content}</span>
              <span className="text-xs text-gray-400">
                [{sp.scope === 'shot' ? '此镜头' : sp.scope === 'group' ? '本组' : sp.scope === 'episode' ? '本集' : '选定'}]
              </span>
              <button onClick={() => onRemoveSpecial(sp.id)} className="text-gray-400 hover:text-red-500 ml-1">×</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="添加特殊效果..."
            className="flex-1 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 bg-gray-800 text-gray-200 placeholder-gray-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSpecial()
            }}
          />
          <select ref={scopeRef} className="border border-gray-700 rounded px-2 py-1 text-sm bg-gray-800 text-gray-200">
            <option value="shot">仅此镜头</option>
            <option value="group">本组</option>
            <option value="episode">本集</option>
          </select>
          <button onClick={handleAddSpecial} className="px-2 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600">添加</button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 p-2 border-t border-gray-800 bg-gray-900">
        <button
          onClick={() => onConfirm(currentShot.shot_id)}
          disabled={currentPrompt?.confirmed}
          className={`px-3 py-1 text-sm rounded ${
            currentPrompt?.confirmed
              ? 'bg-green-900/50 text-green-400 border border-green-700'
              : 'bg-green-600 text-white hover:bg-green-500'
          }`}
        >
          {currentPrompt?.confirmed ? '✓ 已确认' : '确认提示词'}
        </button>
        {currentPrompt?.edited && <span className="text-xs text-gray-500">已编辑</span>}
      </div>
    </div>
  )
}