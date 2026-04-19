---
type: feedback
description: 多个页面布局设计不合理，未使用左右布局，集数展示位置设计问题
created: 2026-04-19
updated: 2026-04-19
occurrences: 1
graduated: false
source_skill: N/A
---

# 页面布局设计问题

**问题描述**：
1. 集数展示位置设计不合理
2. 增加集数后没有合理的 UI 显示新增集数
3. 导入剧本的 UI 显示不合理
4. 设置页 UI 规划不合理
5. 页面没有使用左右布局来合理化布局
6. 功能已有但显示不合理，UI 设计与功能不匹配

**触发场景**：
用户测试第一轮，发现多个页面的布局和展示方式不符合预期

**涉及功能模块**：
- 模块一：项目管理（集数管理）
- 模块二：剧本管理
- 模块九：全局设置页

**相关 Spec 条目**：
- Product-Spec.md UI 布局：左侧抽屉集数导航、顶部导航栏集数选择器
- Product-Spec.md UI 布局 Tab 3：三栏布局（左列导航 + 中央主区 + 右列参数面板）

**教训/建议**：
1. Tab 3 应使用左右布局（Product-Spec 已定义三栏布局），其他 Tab 也应考虑信息密度和操作流程
2. 集数管理应该有清晰的展示位置（左侧抽屉 + 顶部选择器）
3. 新增集数后应有明确的 UI 反馈和入口
4. design-brief-builder 在确定设计方向时，应明确各页面布局骨架
5. dev-builder Skill 在实现页面时，应严格遵循 Product-Spec UI 布局定义
6. code-review Skill 在审查时，应检查 UI 实现是否符合 Spec 布局描述