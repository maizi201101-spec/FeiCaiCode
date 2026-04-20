---
type: feedback
description: Tailwind 中 block/flex 冲突、高度约束遗漏等 CSS 类混用导致布局异常
created: 2026-04-20
updated: 2026-04-20
occurrences: 2
graduated: false
source_skill: dev-builder
---

# Tailwind CSS 类冲突与布局约束遗漏

**问题描述**：
多处页面出现 Tailwind CSS 类混用导致的布局问题：
1. A2: Stage1Import 分集指示线 — block 和 flex 同时使用在同一元素上，flex 覆盖 block 导致子元素布局异常。需要 w-full 保证撑满，且 flex-1 需要父元素显式是 flex 容器。
2. A1: 剧本区高度固定 — overflow-y-auto + flex-1 不够，需要明确 h-screen 或 h-full 配合父级 overflow-hidden 才能约束内容在视口内。

**触发场景**：
用户在 Stage1Import 页面操作时，分集指示线显示错位、剧本区高度超出视口无法滚动。

**涉及文件**：
- feicai/frontend/src/pages/tabs/Stage1Import.tsx

**教训/建议**：
1. **Tailwind 中 block 和 flex 绝不能混用在同一元素上** — flex 会覆盖 block，导致意外行为
2. flex-1 只有在父元素是 flex 容器时才生效，需要检查父子关系
3. 视口高度约束需要从最外层 overflow-hidden 一路传递到内层 overflow-y-auto，中间不能断
4. dev-builder 在写 Tailwind 布局时应遵循：先确定父容器 display 类型，再给子元素加尺寸类
5. code-review 应增加检查项：同一元素是否混用了 block/flex/grid 等互斥的 display 类
