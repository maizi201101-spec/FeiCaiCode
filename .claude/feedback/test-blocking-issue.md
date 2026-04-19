---
type: feedback
description: 后续页面因缺少数据或无法访问导致无法测试
created: 2026-04-19
updated: 2026-04-19
occurrences: 1
graduated: false
source_skill: N/A
---

# 测试阻塞问题

**问题描述**：
后续的页面因为没有数据或无法访问，导致暂时无法测试功能完整性

**触发场景**：
用户测试第一轮，完成 Tab 1 测试后，后续 Tab 无法进入或缺少数据支撑

**涉及功能模块**：
- Tab 2：分镜规划
- Tab 3：装配与生成
- Tab 4：质检与确认

**相关 Spec 条目**：
- Product-Spec.md 用户使用流程：先提取资产 → 再规划分镜 → 再生成提示词 → 再视频生成

**教训/建议**：
1. 前端应设计合理的流程引导，在数据未就绪时提示用户或禁用入口
2. 应提供测试数据或 Mock 数据支持端到端测试
3. dev-builder Skill 在实现时，应考虑数据依赖关系和前置条件提示
4. release-builder Skill 打包前，应进行完整流程测试