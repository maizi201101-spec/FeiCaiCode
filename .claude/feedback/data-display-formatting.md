---
type: feedback
description: 数值显示未格式化（如时长显示多位小数），需统一 toFixed 处理
created: 2026-04-20
updated: 2026-04-20
occurrences: 1
graduated: false
source_skill: dev-builder
---

# 数据显示格式化缺失

**问题描述**：
A6: 质检页面视频时长显示为 "4.000000s"，浮点数未经格式化直接渲染。应使用 toFixed(1) 或类似方法控制小数位数。

**触发场景**：
用户在质检页面查看分镜列表时，时长列显示冗长的小数位，影响阅读体验。

**教训/建议**：
1. 所有面向用户显示的浮点数都应经过格式化：时长用 toFixed(1)，百分比用 toFixed(0) 或 toFixed(1)，价格用 toFixed(2)
2. dev-builder 在渲染数值时应默认添加格式化，而非直接 `{value}`
3. 建议项目建立统一的格式化工具函数（如 formatDuration、formatPercent），避免各处各自 toFixed
4. code-review 应将"浮点数是否格式化"作为检查项
