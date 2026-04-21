interface PreviewDrawerProps {
  open: boolean
  onClose: () => void
  combinedPrompt: string
  anchorDeclaration: string
  globalPrompt: string
  settings: {
    default_model: string
    default_duration: number
    default_resolution: string
    default_ratio: string
  }
  duration: number
  resolution: string
  ratio: string
  onGenerate: () => void
  generating: boolean
}

export default function PreviewDrawer({
  open,
  onClose,
  combinedPrompt,
  anchorDeclaration,
  globalPrompt,
  settings,
  duration,
  resolution,
  ratio,
  onGenerate,
  generating
}: PreviewDrawerProps) {
  if (!open) return null

  // 拼接最终提示词
  const finalPrompt = [
    combinedPrompt,
    anchorDeclaration && `\n[锚定声明] ${anchorDeclaration}`,
    globalPrompt && `\n[全局提示词] ${globalPrompt}`
  ].filter(Boolean).join('\n')

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalPrompt)
    alert('已复制到剪贴板')
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-gray-900 z-50 flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-medium">最终提示词预览</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* 1. 组合视频提示词 */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">组合视频提示词</div>
            <div className="p-3 bg-gray-800 rounded text-sm whitespace-pre-wrap border border-gray-700 max-h-48 overflow-auto">
              {combinedPrompt || '未生成'}
            </div>
          </div>

          {/* 2. 锚定声明 */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">锚定声明</div>
            <div className="p-3 bg-gray-800 rounded text-sm border border-gray-700">
              {anchorDeclaration || '未选择参考图'}
            </div>
          </div>

          {/* 3. 全局提示词 */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">全局提示词</div>
            <div className="p-3 bg-gray-800 rounded text-sm border border-gray-700 max-h-32 overflow-auto">
              {globalPrompt || '未配置'}
            </div>
          </div>

          {/* 4. 最终拼接结果 */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">
              最终提示词（传给 CLI）
            </div>
            <div className="p-3 bg-gray-800 rounded text-sm whitespace-pre-wrap border border-blue-500/50 max-h-64 overflow-auto">
              {finalPrompt}
            </div>
          </div>

          {/* 5. 生成参数摘要 */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">生成参数</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-gray-500">模型: </span>
                <span className="text-gray-300">{settings.default_model}</span>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-gray-500">时长: </span>
                <span className="text-gray-300">{duration}秒</span>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-gray-500">分辨率: </span>
                <span className="text-gray-300">{resolution}</span>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <span className="text-gray-500">比例: </span>
                <span className="text-gray-300">{ratio}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            复制提示词
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成视频'}
          </button>
        </div>
      </div>
    </>
  )
}
