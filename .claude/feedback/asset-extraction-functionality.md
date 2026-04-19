---
type: feedback
description: Tab 1 提取资产按钮点击无响应，资产卡片图片显示不全
created: 2026-04-19
updated: 2026-04-19
occurrences: 1
graduated: false
source_skill: N/A
---

# 资产提取功能问题

**问题描述**：
1. Tab 1 的「提取资产」按钮点击后没有反应，功能未正常工作
2. 资产卡片内的设定图显示不全，图片尺寸/布局有问题

**触发场景**：
用户测试第一轮，点击提取资产按钮后无响应，资产卡片图片显示异常

**涉及功能模块**：
- 模块三：资产管理（AI 资产提取、资产图管理）

**相关 Spec 条目**：
- Product-Spec.md 模块三：AI 资产提取 - 用户选择集数 → 点击「提取资产」→ 调用 LLM 分析
- Product-Spec.md UI 布局 Tab 1：大图卡片，设定图大图显示

**教训/建议**：
1. 前端按钮点击事件绑定需检查，确保 API 调用正确触发
2. 资产卡片图片布局需调整，确保设定图完整显示
3. bug-fixer Skill 修复此类问题时，需同时检查 UI 和 API 层
4. dev-builder Skill 在实现资产卡片时，应明确图片显示规格和 CSS 样式