---
type: feedback
description: Tab3 锚定声明应根据 shot.asset_refs 自动预填角色+装扮+场景，减少手动操作
created: 2026-04-20
updated: 2026-04-20
occurrences: 1
graduated: false
source_skill: dev-builder
---

# Tab3 资产锚定声明应自动预填

**问题描述**：
Tab3 装配与生成页面，右侧资产面板（参考图区域）的锚定声明默认为空，需要用户手动点击右侧资产才能添加。应该根据 shot.asset_refs 自动预填当前镜头涉及的角色+装扮+场景，减少手动操作。

**触发场景**：
用户在 Tab3 装配页面操作时，每次都需要手动逐个添加锚定资产，而数据中已有 shot.asset_refs 记录了当前镜头涉及的资产引用。

**涉及文件**：
- feicai/frontend/src/pages/tabs/Tab3Assembly.tsx 或类似文件

**教训/建议**：
1. 当镜头数据中已有 asset_refs 时，应自动将关联的角色、装扮、场景预填到锚定声明区域
2. dev-builder 在实现类似"引用关联"功能时，应优先考虑自动预填，减少用户手动操作
3. 数据模型中已有关联关系时，UI 应利用这些关系提供智能默认值
