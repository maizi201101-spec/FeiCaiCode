---
type: feedback
description: detect-feedback-signal hook 无法感知 session 内 code review 状态，导致 review 完成后仍反复触发
created: 2026-04-21
updated: 2026-04-21
occurrences: 1
graduated: false
source_skill: code-review
---

# detect-feedback-signal Hook 缺少 Session 状态感知导致死循环

**问题描述**：stop hook "detect-feedback-signal" 在 code review 已完成后仍然反复触发，要求再次派发 code-reviewer。Hook 只检查 git 是否有提交，无法感知 code review 是否已在当前 session 执行过，导致死循环。

**触发场景**：
1. 完成 Tab3 代码修改并提交（4 个 commit）
2. 派发 code-reviewer 两阶段审查，两阶段均通过
3. Hook 继续触发，要求再次审查
4. 解释无新修改后，Hook 仍连续触发 3 次

**教训/建议**：
- detect-feedback-signal hook 需要能感知"本 session 是否已执行过 code review"，否则每次对话结束都会误判为需要 review
- 可能的解决方案：hook 应检查 .claude/.needs-review 标记文件的状态（code review 通过后会写入 "clean"），而非仅依赖 git commit 历史
- 或者 hook 应维护一个 session 级别的状态标记，记录已执行过的操作，避免重复触发
- 这属于 hook 设计层面的缺陷，不是 Skill 本身的问题，但直接影响 code-review Skill 的使用体验
