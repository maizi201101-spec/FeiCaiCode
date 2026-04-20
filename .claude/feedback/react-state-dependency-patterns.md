---
type: feedback
description: useEffect 依赖数组遗漏 prop 导致数据不刷新 + 组件全局控制用 force prop 模式
created: 2026-04-20
updated: 2026-04-20
occurrences: 2
graduated: false
source_skill: dev-builder
---

# React State 依赖与全局控制模式

**问题描述**：
两类相关问题反复出现：
1. A3: EpisodeSelector 确认分集后不自动更新 — useEffect 只依赖 projectId，缺少 refreshToken prop 作为额外依赖。确认分集操作改变了数据，但组件不知道要重新 fetch。
2. A7: 资产库全局展开/收起 — AssetCard 只有局部 expanded 状态，无法被外部全局控制。需要 forceExpanded / forceVariantsExpanded 覆盖 prop（非 null 时覆盖内部 state，null 时独立控制）+ AssetGrid 全局控制栏。

**触发场景**：
- A3: 用户在 Stage1Import 确认分集后，切换到 EpisodeSelector 发现数据未更新
- A7: 用户在资产库页面想要一键展开/收起所有资产卡片，但只能逐个操作

**教训/建议**：
1. **useEffect 依赖数组必须包含所有影响数据获取的 prop**。常见遗漏：refreshToken、version、triggerKey 等触发刷新的 prop。写 useEffect 时逐一检查 prop 列表。
2. **force prop 模式优于直接 lift state**：当组件内部有独立状态但偶尔需要外部覆盖时，用 `forceXxx` prop（非 null 时覆盖，null 时独立控制）比完全提升状态更灵活，保留了组件的独立性。
3. dev-builder 在实现列表/卡片类组件时，应预留全局控制接口（全选、全展开、全收起等），避免后期改造。
4. code-review 应检查 useEffect 依赖数组是否完整，特别是涉及数据 fetch 的 effect。
