# Feedback Index

> 经验教训索引。新建或更新 feedback 文件后，同步更新此索引。
> 格式：每条一行，`- [标题](文件名.md) — 一句话描述`
> 模板：templates/feedback-topic-template.md

- [剧本管理页面设计缺失](script-management-page-design.md) — 导入全集剧本缺少分集处理页面，剧本位置不合理
- [资产提取功能问题](asset-extraction-functionality.md) — 提取资产按钮无响应，资产卡片图片显示不全
- [页面布局设计问题](page-layout-design.md) — 多页面布局不合理，未使用左右布局，集数展示位置问题
- [测试阻塞问题](test-blocking-issue.md) — 后续页面因缺少数据无法测试
- [剧本管理 UI 优化](script-management-ui-optimization.md) — 第一阶段建议改为左右布局，完整剧本显示 + 快速定位功能
- [项目创建与数据管理问题](project-creation-data-management.md) — 项目创建流程与数据管理存在多项问题，需改进
- [资产提取架构理解错误](asset-extraction-architecture-misunderstanding.md) — 逐集提取应为每集独立 LLM 调用+程序预筛选，非批量提交
- [多分支 continue 导致数据丢失](data-loss-from-continue-in-branch.md) — new_variant 分支 continue 跳过后变体数据完全丢失（HIGH）
- [改版时未清理旧代码](leftover-old-code-cleanup.md) — 重写逻辑后遗留旧代码死代码，需每次主动清理