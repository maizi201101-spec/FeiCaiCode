---
type: feedback
description: 资产卡片「标记已审核」按钮藏在展开区底部，应放到 hover 操作列
created: 2026-04-20
updated: 2026-04-20
occurrences: 1
graduated: false
source_skill: dev-builder
---

# 资产卡片审核按钮位置不合理

**问题描述**：
资产卡片的「标记已审核」按钮放在卡片展开区底部，用户必须先展开卡片才能点到，操作路径过长。已修复为将「✓ 审核」按钮移到卡片右侧 hover 操作列，hover 卡片即可直接点击。

**触发场景**：
用户在资产管理页面逐一审核资产卡片时，发现需要反复展开卡片才能点到审核按钮，批量审核时操作繁琐。

**涉及文件**：
- feicai/frontend/src/components/assets/AssetCard.tsx

**教训/建议**：
1. 高频操作按钮（如审核、删除、编辑）不应藏在需要额外交互才能看到的区域，应放在卡片表面可快速访问的位置（如 hover 操作列）
2. dev-builder Skill 在实现卡片类组件时，应区分操作频率：高频操作放在卡片表面或 hover 区，低频操作可放在展开区或更多菜单中
3. code-review Skill 应检查交互设计的合理性，不仅检查功能是否实现，还要检查操作路径是否合理
