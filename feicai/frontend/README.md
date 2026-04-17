# 飞彩前端 · 冷启动文档

## 项目结构

```
frontend/
├── src/
│   ├── App.tsx                          # 路由根组件（React Router）
│   ├── main.tsx                         # Vite 入口，挂载 React 应用
│   ├── index.css                        # 全局样式（Tailwind 指令）
│   ├── App.css                          # 根组件样式（备用）
│   ├── pages/
│   │   ├── HomePage.tsx                 # 项目列表页（/ 路由）
│   │   └── WorkbenchPage.tsx            # 工作台页面（/project/:projectId/*）
│   ├── components/
│   │   └── layout/
│   │       ├── WorkbenchLayout.tsx      # 工作台通用布局（顶部导航 + 抽屉 + 主区）
│   │       ├── EpisodeSelector.tsx      # 集数下拉选择器
│   │       └── EpisodeDrawer.tsx        # 左侧集数抽屉面板
│   ├── hooks/
│   │   └── useProjects.ts              # useProjects / useEpisodes 数据钩子
│   ├── api/
│   │   └── projects.ts                 # 项目 & 集数 API 封装（fetch）
│   └── assets/
│       ├── hero.png
│       ├── vite.svg
│       └── react.svg
├── index.html                           # HTML 模板
├── vite.config.ts                       # Vite 配置（含后端代理）
├── tailwind.config.js                   # Tailwind 配置
├── tsconfig.app.json                    # TypeScript 编译配置
├── package.json                         # 依赖 & 脚本
└── .gitignore
```

---

## 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5 | 类型安全 |
| Vite | 6 | 构建 & 开发服务器 |
| Tailwind CSS | 3 | 原子化样式 |
| React Router | 6 | 客户端路由 |

---

## 首次冷启动

```bash
# 1. 进入前端目录
cd /Users/jm02/TongBu/FeiCaiCode/feicai/frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

> 默认在 http://localhost:5173 启动，API 请求代理到 http://localhost:8000。

> ⚠️ 前端依赖后端服务，启动前请先运行后端（见 `../backend/README.md`）。

---

## 路由结构

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | `HomePage` | 项目列表，支持新建项目 |
| `/project/:projectId/*` | `WorkbenchPage` | 指定项目的工作台 |

---

## 页面说明

### HomePage（项目列表页）
- 展示所有项目卡片（名称、集数、更新时间、路径）
- 右上角「+ 新建项目」打开弹窗，填写项目名称和存储路径
- 点击项目卡片进入工作台

### WorkbenchPage（工作台页）
- 顶部导航栏：返回按钮、项目编号、集数选择器、Tab 切换
- 左侧可展开集数抽屉（点击项目编号切换）
- 四个工作 Tab：资产库 / 分镜规划 / 装配与生成 / 质检与确认（功能开发中）

---

## 组件说明

### WorkbenchLayout
工作台通用布局壳，接受 `activeTab` 和 `onTabChange` props：
- 顶部 Header：返回链接、项目标题、集数选择、Tab 导航、任务/设置按钮
- 左侧 `EpisodeDrawer`：集数列表，可展开/收起
- 主区 `children`：各 Tab 的内容区

### EpisodeSelector
顶部集数下拉选择器，从 `useEpisodes` hook 获取数据，支持快速切换集数。

### EpisodeDrawer
左侧抽屉式集数面板，支持 Esc 键关闭，点击集数高亮选中。

---

## API 层（`src/api/projects.ts`）

所有请求统一指向 `/api`（由 Vite proxy 转发到 `localhost:8000`）。

| 函数 | 方法 | 路径 | 说明 |
|------|------|------|------|
| `getProjects()` | GET | `/api/projects` | 获取项目列表 |
| `createProject(payload)` | POST | `/api/projects` | 创建项目 |
| `getProject(id)` | GET | `/api/projects/:id` | 获取单个项目 |
| `getEpisodes(projectId)` | GET | `/api/projects/:id/episodes` | 获取集数列表 |
| `createEpisode(projectId, payload)` | POST | `/api/projects/:id/episodes` | 创建集数 |
| `deleteEpisode(projectId, episodeId)` | DELETE | `/api/projects/:id/episodes/:epId` | 删除集数 |

---

## Hooks（`src/hooks/useProjects.ts`）

### `useProjects()`
管理项目列表状态，自动加载，提供：
- `projects` — 项目数组
- `loading` / `error` — 加载状态
- `refetch()` — 手动刷新
- `createProject(payload)` — 创建并追加到列表

### `useEpisodes(projectId)`
管理指定项目的集数状态，提供：
- `episodes` — 集数数组
- `loading` / `error` — 加载状态
- `refetch()` — 手动刷新
- `createEpisode(payload)` — 创建集数
- `deleteEpisode(episodeId)` — 删除集数

---

## Vite 代理配置

`vite.config.ts` 中已配置 `/api` 代理，开发时所有 `/api/*` 请求自动转发到后端：

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

---

## 构建生产版本

```bash
npm run build
# 产物输出到 dist/ 目录
```

---

## 常见问题

**Q: 页面空白或接口报错**  
A: 确认后端已启动（`uvicorn main:app --port 8000`），且 vite.config.ts 代理指向正确地址。

**Q: 集数列表不显示**  
A: 检查 `/api/projects/:id/episodes` 接口是否返回正常，后端数据库是否已初始化。

**Q: 样式丢失**  
A: 确认 Tailwind 配置的 `content` 路径包含 `src/**/*.{ts,tsx}`，重启 `npm run dev`。
