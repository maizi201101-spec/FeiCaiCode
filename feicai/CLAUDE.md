# 飞彩项目 · Claude 上下文导航

> **每次新对话开始时，告诉 Claude：「读 CLAUDE.md」即可加载项目全貌。**

---

## 项目概述

飞彩（FeiCai）是一个 AI 短剧生成工作平台。

**核心工作流（v1.7）**：
剧本导入 → 分镜规划（LLM 生成 asset_refs）→ 装扮注册表积累 → 资产提取（从分镜 refs 坍缩）→ 提示词生成 → 视频生成 → 剪映草稿导出

**技术栈：**
- 后端：Python + FastAPI + aiosqlite（SQLite）
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 代理：Vite dev server 将 `/api` 转发到 `http://localhost:8000`

**启动命令：**
```bash
# 后端
cd /Users/jm02/TongBu/FeiCaiCode/feicai/backend
source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 前端
cd /Users/jm02/TongBu/FeiCaiCode/feicai/frontend
npm run dev
```

---

## 项目文件树（核心文件）

```
feicai/
├── CLAUDE.md                              ← 本文件
│
├── backend/
│   ├── main.py                            ← FastAPI 入口，注册所有路由 & CORS
│   ├── database.py                        ← SQLite 初始化 (aiosqlite)
│   ├── feicai.db                          ← SQLite 数据库文件
│   │
│   ├── schemas/
│   │   ├── shots_schema.py                ← Shot / ShotGroup / AssetRefs / CharacterRef / Variant
│   │   ├── assets_schema.py               ← Character / Scene / Prop / AssetsCollection
│   │   ├── script_management_schema.py    ← 剧本管理相关模型
│   │   ├── preset_schema.py               ← 预设系统模型
│   │   ├── prompts_schema.py              ← 提示词模型
│   │   ├── qc_schema.py                   ← 质检模型
│   │   ├── video_schema.py                ← 视频版本模型
│   │   └── ...
│   │
│   ├── routers/
│   │   ├── projects.py                    ← /api/projects CRUD
│   │   ├── episodes.py                    ← /api/projects/{id}/episodes CRUD
│   │   ├── scripts.py                     ← /api/episodes/{id}/script 读写
│   │   ├── script_management.py           ← /api/projects/{id}/split-detection 等分集流程
│   │   ├── shots.py                       ← /api/episodes/{id}/shots 分镜 CRUD + AI 规划
│   │   ├── assets.py                      ← /api/projects/{id}/assets + 资产提取
│   │   ├── asset_images.py                ← /api/projects/{id}/assets/{type}/{id}/images
│   │   ├── prompts.py                     ← /api/episodes/{id}/shots/{shot}/confirm 提示词
│   │   ├── presets.py                     ← /api/presets 预设管理
│   │   ├── export_prompts.py              ← /api/episodes/{id}/export-prompts CSV/Markdown 导出
│   │   ├── export.py                      ← /api/episodes/{id}/export/capcut 剪映导出
│   │   ├── qc.py                          ← /api/episodes/{id}/qc 质检
│   │   ├── videos.py                      ← /api/episodes/{id}/videos 视频版本
│   │   ├── settings.py                    ← /api/settings 全局设置
│   │   ├── system_settings.py             ← /api/system 项目区管理
│   │   ├── providers.py                   ← /api/providers 视频提供商
│   │   ├── costume_registry.py            ← /api/projects/{id}/costume-registry
│   │   └── tasks.py                       ← /api/projects/{id}/tasks 异步任务
│   │
│   └── services/
│       ├── shot_service.py                ← 分镜读写 + AI 规划 + CRUD（含 asset_refs 解析）
│       ├── asset_service.py               ← assets.json 读写 + CRUD
│       ├── asset_extraction_from_storyboard.py  ← 从分镜 refs 坍缩提取资产（v1.7）
│       ├── script_service.py              ← 集数/项目路径查询
│       ├── script_split_service.py        ← 分集检测
│       ├── prompt_service.py              ← 提示词生成（注入 asset_refs 装扮信息）
│       ├── prompt_export_service.py       ← 提示词导出 CSV/Markdown
│       ├── preset_service.py              ← 预设激活/读取
│       ├── costume_registry_service.py    ← 装扮注册表（costume_registry.json）
│       ├── llm_client.py                  ← LLM 调用封装
│       ├── video_service.py               ← 视频生成
│       ├── jimeng_cli.py                  ← 即梦 CLI 封装（待接入）
│       ├── capcut_service.py              ← 剪映草稿生成
│       └── ...
│
└── frontend/src/
    ├── App.tsx                            ← 路由根组件
    ├── pages/
    │   ├── HomePage.tsx                   ← 项目列表页（/）含项目区设置入口
    │   ├── WorkbenchPage.tsx              ← 工作台（/project/:id/*）5 Tab 框架
    │   ├── SettingsPage.tsx               ← 设置页（/project/:id/settings）
    │   └── tabs/
    │       ├── Tab0ScriptManagement.tsx   ← Tab0: 剧本管理（导入/分集/集数列表）
    │       ├── Tab1Assets.tsx             ← Tab1: 资产库
    │       ├── Tab2Storyboard.tsx         ← Tab2: 分镜规划
    │       ├── Tab3Assembly.tsx           ← Tab3: 装配与生成
    │       └── Tab4QC.tsx                 ← Tab4: 质检与确认
    ├── components/
    │   ├── script/
    │   │   ├── Stage1Import.tsx           ← 剧本导入 + 分集检测（左右各50%布局）
    │   │   ├── Stage2List.tsx             ← 分集确认列表
    │   │   ├── EpisodeScriptPanel.tsx     ← 单集剧本展示
    │   │   └── SplitResultPanel.tsx       ← 分集结果面板
    │   ├── assets/
    │   │   ├── AssetCard.tsx              ← 资产卡片（含变体展开）
    │   │   ├── AssetGrid.tsx              ← 资产网格布局
    │   │   ├── AssetToolbar.tsx           ← 资产操作工具栏
    │   │   ├── AssetVariantRow.tsx        ← 变体行
    │   │   ├── CostumeCollapseView.tsx    ← 装扮坍缩预览
    │   │   └── ClusterLogPanel.tsx        ← 聚类决策审核面板
    │   ├── storyboard/
    │   │   ├── ShotTable.tsx              ← 分镜表格
    │   │   └── GroupView.tsx              ← 分镜组视图
    │   ├── assembly/
    │   │   ├── ShotNavPanel.tsx           ← 左侧组/镜头导航
    │   │   ├── CentralWorkArea.tsx        ← 中央内容区（组内所有镜头）
    │   │   ├── ParamsPanel.tsx            ← 右侧参数区（图片+提示词）
    │   │   └── VideoVersionTabs.tsx       ← 视频版本 Tab
    │   ├── qc/
    │   │   ├── GroupMatrix.tsx            ← 质检矩阵
    │   │   ├── GroupColumn.tsx            ← 质检列
    │   │   ├── TimelineBar.tsx            ← 时长时间轴
    │   │   ├── ExportButton.tsx           ← 导出按钮
    │   │   └── VideoPreviewModal.tsx      ← 视频预览弹窗
    │   ├── settings/
    │   │   ├── LLMConfig.tsx              ← LLM 配置
    │   │   ├── SystemConfig.tsx           ← 系统配置（项目区路径）
    │   │   ├── PresetsConfig.tsx          ← 预设管理
    │   │   ├── GlobalPromptConfig.tsx     ← 全局提示词配置
    │   │   ├── JimengConfig.tsx           ← 即梦配置
    │   │   ├── ProvidersConfig.tsx        ← 视频提供商配置
    │   │   └── VideoParamsConfig.tsx      ← 视频参数配置
    │   ├── layout/
    │   │   ├── WorkbenchLayout.tsx        ← 工作台顶栏 + 布局框架
    │   │   ├── EpisodeSelector.tsx        ← 顶栏集数下拉
    │   │   ├── EpisodeDrawer.tsx          ← 左侧集数抽屉
    │   │   └── TaskIndicator.tsx          ← 异步任务状态指示
    │   └── common/
    │       └── ExportPromptsButton.tsx    ← 提示词导出按钮（CSV/Markdown）
    ├── api/                               ← fetch 封装（按模块）
    │   ├── projects.ts / assets.ts / shots.ts / scripts.ts
    │   ├── prompts.ts / presets.ts / qc.ts / videos.ts
    │   ├── export.ts / providers.ts / systemSettings.ts
    │   └── scriptManagement.ts
    └── hooks/                             ← React hooks（按模块）
        ├── useProjects.ts / useAssets.ts / useShots.ts
        ├── usePrompts.ts / usePresets.ts / useQC.ts
        ├── useVideoGeneration.ts / useAssembly.ts
        ├── useScriptManagement.ts / useSplitDetection.ts
        ├── useGlobalSettings.ts / useProviders.ts
        └── useTaskPolling.ts
```

---

## 关键数据文件（磁盘，非数据库）

```
{project_path}/
├── assets.json                            ← 全局资产库（characters/scenes/props）
├── costume_registry.json                  ← 装扮注册表（从分镜积累）
├── cluster_log.json                       ← 最近一次资产提取聚类决策记录
└── episodes/
    └── EP{nn}/
        ├── script.txt                     ← 单集剧本
        ├── shots.json                     ← 分镜数据（含 asset_refs）
        ├── storyboard.md                  ← Markdown 分镜表
        ├── episode_assets.json            ← 本集资产 ID 索引
        └── exports/                       ← 导出文件
```

---

## 数据库表（SQLite · feicai.db）

| 表名 | 关键字段 | 说明 |
|------|---------|------|
| `projects` | id, name, path, created_at | 项目 |
| `episodes` | id, project_id(FK), number, title | 集数 |
| `settings` | key(PK), value | 全局配置（llm_api_key, llm_base_url, llm_model 等） |
| `tasks` | id, project_id, episode_id, type, status, payload, result | 异步任务 |

---

## 核心 Schema 要点

**Shot（shots_schema.py）**：
```python
asset_refs: Optional[AssetRefs] = None    # 分镜 LLM 写入
asset_bindings: List[AssetBinding] = []   # 资产绑定步骤写入（预留）
```

**AssetRefs**：
```python
characters: List[CharacterRef]   # [{name, costume}]
scenes: List[str]
props: List[str]
shot_annotations: str            # 一次性外观变化标注
```

**Character（assets_schema.py）**：
- `variants` 字段用 `variant_name`（不是旧的 `label`）

---

## 后端 API 路由总览

| 模块 | Prefix | 说明 |
|------|--------|------|
| projects | `/api/projects` | 项目 CRUD |
| episodes | `/api/projects/{id}/episodes` | 集数 CRUD |
| scripts | `/api/episodes/{id}/script` | 剧本读写 |
| script_management | `/api/projects/{id}/...` | 分集检测/确认 |
| shots | `/api/episodes/{id}/shots` | 分镜 CRUD + AI 规划 |
| assets | `/api/projects/{id}/assets` | 资产库 CRUD + 提取 |
| asset_images | `/api/projects/{id}/assets/{type}/{id}/images` | 资产图片 |
| prompts | `/api/episodes/{id}/shots/{shot}/confirm` | 提示词确认 |
| export_prompts | `/api/episodes/{id}/export-prompts` | 提示词导出 |
| export | `/api/episodes/{id}/export` | 剪映导出 |
| qc | `/api/episodes/{id}/qc` | 质检 |
| videos | `/api/episodes/{id}/videos` | 视频版本 |
| presets | `/api/presets` | 预设管理 |
| settings | `/api/settings` | 全局设置 |
| system_settings | `/api/system` | 项目区管理 |
| providers | `/api/providers` | 视频提供商 |
| costume_registry | `/api/projects/{id}/costume-registry` | 装扮注册表 |
| tasks | `/api/projects/{id}/tasks` | 异步任务 |

---

## 当前开发状态

- ✅ 项目 CRUD + 集数 CRUD
- ✅ 工作台 5 Tab 框架（Tab0~Tab4）
- ✅ Tab0 剧本管理：导入 + 分集检测 + 集数切换
- ✅ Tab1 资产库：CRUD + 图片 + 变体 + 装扮坍缩提取
- ✅ Tab2 分镜规划：AI 规划 + 组视图 + 编辑面板
- ✅ Tab3 装配：组导航 + 镜头列表 + 参数面板 + 提示词导出
- ✅ Tab4 质检：矩阵视图 + 时长统计 + 视频预览 + 剪映导出
- ✅ 设置页：LLM / 预设 / 系统提示词 / 即梦 / 提供商 / 视频参数
- ✅ 装扮注册表（costume_registry.json）项目级积累
- 🚧 **#29** 视频生成对接即梦 CLI（待用户提供命令格式）

---

## 如何使用本文件

新对话开始时：
```
读 CLAUDE.md
```
Claude 会加载本文件，立即了解项目结构，无需再解释文件路径。
