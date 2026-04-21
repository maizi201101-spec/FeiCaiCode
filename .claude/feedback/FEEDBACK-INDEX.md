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
- [资产卡片审核按钮位置不合理](asset-card-review-button-placement.md) — 高频操作按钮不应藏在展开区，应放到 hover 操作列
- [Tab3 资产锚定声明应自动预填](tab3-asset-refs-auto-prefill.md) — 应根据 shot.asset_refs 自动预填角色+装扮+场景，减少手动操作
- [Tab3 右侧面板高度超出视口](tab3-right-panel-height-overflow.md) — 右侧参考图/资产图区域太高，需约束在视口内
- [Tab3 资产缩略图显示异常](tab3-asset-thumbnail-not-rendering.md) — 部分资产缩略图无法预览，显示文字但无图片
- [Tailwind CSS 类冲突与布局约束遗漏](tailwind-css-class-conflicts.md) — block/flex 混用导致布局异常，高度约束链断裂
- [React State 依赖与全局控制模式](react-state-dependency-patterns.md) — useEffect 依赖遗漏 + force prop 全局控制模式
- [数据显示格式化缺失](data-display-formatting.md) — 浮点数未格式化直接渲染，需统一 toFixed 处理
- [用户确认的指令被静默打折执行](silent-discount-on-confirmed-instructions.md) — AI 自行裁量"已覆盖"跳过部分内容，未完整执行用户确认的指令
- [detect-feedback-signal Hook 死循环](detect-feedback-hook-infinite-loop.md) — Hook 无法感知 session 内 code review 状态，review 通过后仍反复触发
- [Tab3 生成参数位置和参考图锚定区布局重新设计](tab3-layout-redesign-params-and-anchor.md) — 生成参数应移至顶部工具栏，参考图锚定区需左右分区重新设计