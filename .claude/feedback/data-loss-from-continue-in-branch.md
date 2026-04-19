---
name: 多分支处理中 continue 导致数据丢失
description: new_variant 分支用 continue 跳过后变体数据未被收集，merge_assets 也从未处理此类资产
type: feedback
---

在资产提取的关系判断分支中，`new_variant` 类型用 `continue` 跳过了后续处理逻辑，导致 LLM 识别出的变体信息（variant_name、variant_id 等）被完全丢弃，既没有收集到 `pending_variants`，`merge_assets` 也没有处理此路径。Code Review 发现为 HIGH issue。

**Why:** `continue` 跳过了数据收集语句，而 `merge_assets` 只处理 `new_chars/new_scenes/new_props` 列表，`new_variant` 资产从未进入该列表。两处遗漏叠加，结果是该功能虽然有 LLM 输出，但提取结果完全不生效。

**How to apply:** 实现多分支处理逻辑时，对每个分支显式检查：
- 此分支产生的数据是否被完整收集？
- `continue`/`break`/`return` 是否会提前跳过数据写入？
- 该分支的数据在下游（如 merge 函数）是否有对应处理路径？
不能只测 happy path，每个分支都要追踪数据流向。
