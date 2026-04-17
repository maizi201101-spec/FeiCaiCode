# 飞彩项目 · Claude 上下文导航

> **每次新对话开始时，告诉 Claude：「读 CLAUDE.md」即可加载项目全貌。**

---

## 项目概述

飞彩（FeiCai）是一个 AI 短剧生成工作平台。
核心流程：剧本分析 → 资产提取/生成 → 分镜规划 → 视频生成 → 剪映草稿导出。

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

## 项目文件树（核心文件，排除 venv/node_modules）

```
feicai/
├── CLAUDE.md                          ← 本文件
├── Product-Spec.md                    ← 产品需求文档（如有）
├── DEV-PLAN.md                        ← 开发计划（如有）
│
├── backend/
│   ├── main.py                        ← FastAPI 入口，注册路由 & CORS
│   ├── database.py                    ← SQLite 初始化 (aiosqlite)
│   ├── requirements.txt               ← Python 依赖
│   ├── README.md                      ← 后端冷启动文档
│   ├── schemas/
│   │   └── project.py                 ← Pydantic 数据模型
│   ├── routers/
│   │   ├── projects.py                ← /api/projects CRUD
│   │   └── episodes.py                ← /api/projects/{id}/episodes CRUD
│   ├── models/
│   │   └── project.py                 ← 备用模型定义
│   ├── services/
│   │   └── project_service.py         ← 项目业务逻辑
│   └── utils/
│       └── project_dirs.py            ← 初始化项目磁盘目录结构
│
└── frontend/
    ├── package.json
    ├── vite.config.ts                 ← Vite 配置（含 /api 代理）
    ├── README.md                      ← 前端文档
    └── src/
        ├── App.tsx                    ← 路由根组件（BrowserRouter）
        ├── main.tsx                   ← React 入口
        ├── api/
        │   └── projects.ts            ← fetch 封装：项目&集数 CRUD
        ├── hooks/
        │   └── useProjects.ts         ← useProjects / useEpisodes hooks
        ├── pages/
        │   ├── HomePage.tsx           ← 项目列表页（/）
        │   └── WorkbenchPage.tsx      ← 工作台页（/project/:projectId/*）
        └── components/
            └── layout/
                ├── WorkbenchLayout.tsx  ← 工作台顶部导航 + 布局框架
                ├── EpisodeSelector.tsx  ← 顶栏集数下拉选择器
                └── EpisodeDrawer.tsx    ← 左侧集数抽屉列表
```

---

## 路由总览

### 前端路由
| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `HomePage` | 项目列表，支持新建项目 |
| `/project/:projectId/*` | `WorkbenchPage` | 工作台（4个Tab：资产库/分镜规划/装配与生成/质检与确认） |

### 后端 API
| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/projects/` | 创建项目 |
| GET | `/api/projects/` | 项目列表 |
| GET | `/api/projects/{id}` | 项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目（级联删除集数） |
| POST | `/api/projects/{id}/episodes` | 创建集数 |
| GET | `/api/projects/{id}/episodes` | 集数列表 |
| PUT | `/api/projects/{id}/episodes/{ep_id}` | 更新集数 |
| DELETE | `/api/projects/{id}/episodes/{ep_id}` | 删除集数 |

---

## 数据库表（SQLite · feicai.db）

| 表名 | 关键字段 | 说明 |
|------|---------|------|
| `projects` | id, name, path, created_at, updated_at | 项目 |
| `episodes` | id, project_id(FK), number, title | 集数（级联删除） |
| `settings` | key(PK), value, updated_at | 全局配置 |
| `tasks` | id, project_id, episode_id, type, status, payload, result, error | 异步任务 |

---

## 当前开发状态

- ✅ 项目 CRUD（后端 API + 前端 HomePage）
- ✅ 集数 CRUD（后端 API + 前端 EpisodeDrawer/EpisodeSelector）
- ✅ 工作台布局骨架（WorkbenchLayout + 4 Tab 框架）
- 🚧 Tab 内容（资产库、分镜规划、装配与生成、质检与确认）均为占位开发中

---

## 如何使用本文件

新对话开始时：
```
读 CLAUDE.md
```
Claude 会加载本文件，立即了解项目结构，无需你再解释文件路径。
