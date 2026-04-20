---
type: feedback
description: Tab3 右侧资产缩略图部分无法预览，显示文字名称但无图片
created: 2026-04-20
updated: 2026-04-20
occurrences: 2
graduated: false
source_skill: dev-builder
---

# Tab3 资产缩略图显示异常

**问题描述**：
Tab3 装配与生成页面，右侧资产缩略图有些预览不出来，显示文字名称但无图片。可能是图片 URL 路径问题或该资产未生成图片时的显示处理问题。

**触发场景**：
用户在 Tab3 页面查看右侧资产面板时，部分资产缩略图无法正常渲染，只显示文字名称。

**教训/建议**：
1. 图片加载应有 fallback 处理：URL 无效或资产无图片时，显示占位图或图标而非空白
2. **根因已确认**：asset.images[] 存的是相对路径字符串，直接用作 img src 无法加载。正确做法是用 getImageUrl(projectId, assetType, assetId, index) 构造 API URL
3. dev-builder 在实现图片展示时，应始终添加 onError fallback 和 loading 状态
4. **通用规则**：后端存储的文件路径不能直接当前端 img src。涉及文件访问的 URL 必须通过 API 端点构造
5. 未生成图片的资产应有明确的视觉提示（如灰色占位 + "暂无图片" 文字），而非让用户困惑
