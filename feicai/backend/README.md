# 飞彩后端 · 冷启动文档

## 项目结构

```
backend/
├── main.py                  # FastAPI 入口，注册路由 & CORS
├── database.py              # SQLite 初始化 (aiosqlite)
├── schemas/
│   └── project.py           # Pydantic 数据模型（ProjectCreate/Update/Response + Episode 系列）
├── routers/
│   └── projects.py          # /api/projects 及其子路由 /episodes
├── models/
│   └── project.py           # 备用模型（EpisodeCreate / EpisodeResponse）
├── utils/
│   └── project_dirs.py      # 初始化项目磁盘目录结构
├── feicai.db                # SQLite 数据库（运行后自动生成）
├── requirements.txt         # Python 依赖
└── venv/                    # 虚拟环境（本地，不提交）
```

---

## 环境要求

| 依赖 | 版本 |
|------|------|
| Python | 3.11+ |
| uvicorn | ≥ 0.29 |
| fastapi | ≥ 0.110 |
| aiosqlite | ≥ 0.20 |
| pydantic | v2 |

---

## 首次冷启动

```bash
# 1. 进入后端目录
cd /Users/jm02/TongBu/FeiCaiCode/feicai/backend

# 2. 创建虚拟环境（仅首次）
python3 -m venv venv

# 3. 激活虚拟环境
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 启动服务（会自动初始化 SQLite 数据库）
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> 首次启动时 `lifespan` 钩子会自动执行 `init_db()`，在项目目录下生成 `feicai.db` 并建好所有表。

---

## 数据库表结构

### projects
| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT NOT NULL | 项目名称 |
| path | TEXT UNIQUE | 项目磁盘路径 |
| created_at | TEXT | UTC 时间字符串 |
| updated_at | TEXT | UTC 时间字符串 |

### episodes
| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PK | 自增主键 |
| project_id | INTEGER FK → projects.id | 所属项目（级联删除） |
| number | INTEGER | 集数编号 |
| title | TEXT | 集标题（可为空） |
| created_at / updated_at | TEXT | UTC 时间字符串 |

### settings
| 列 | 类型 | 说明 |
|----|------|------|
| key | TEXT PK | 配置键 |
| value | TEXT | 配置值 |
| updated_at | TEXT | UTC 时间字符串 |

### tasks
| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PK | 自增主键 |
| project_id | INTEGER FK | 所属项目（可为空） |
| episode_id | INTEGER FK | 所属集数（可为空） |
| type | TEXT | 任务类型 |
| status | TEXT | pending / running / done / failed |
| payload / result / error | TEXT | JSON 序列化内容 |
| created_at / updated_at | TEXT | UTC 时间字符串 |

---

## API 接口速查

### 项目 `/api/projects`

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/projects/` | 创建项目（body: `{name, path}`） |
| GET | `/api/projects/` | 列出所有项目 |
| GET | `/api/projects/{id}` | 获取单个项目 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目（级联删除集数） |

### 集数 `/api/projects/{project_id}/episodes`

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/projects/{id}/episodes` | 创建集数（body: `{number, title?}`） |
| GET | `/api/projects/{id}/episodes` | 列出所有集数 |
| PUT | `/api/projects/{id}/episodes/{ep_id}` | 更新集数 |
| DELETE | `/api/projects/{id}/episodes/{ep_id}` | 删除集数 |

### 健康检查

```
GET /api/health  →  {"status": "ok"}
```

---

## 项目磁盘目录初始化

创建项目后，可调用工具函数自动生成标准子目录：

```python
from utils.project_dirs import init_project_dirs
init_project_dirs("/path/to/your/project")
# 生成: assets/characters, assets/scenes, assets/props, episodes
```

---

## CORS 配置

当前仅允许前端开发服务器：

```
http://localhost:5173
```

如需修改，编辑 `main.py` 中 `allow_origins` 列表。

---

## 常见问题

**Q: 启动报 `ModuleNotFoundError`**  
A: 确认已激活 venv：`source venv/bin/activate`，再 `pip install -r requirements.txt`。

**Q: 端口被占用**  
A: `lsof -i :8000` 找到 PID 后 `kill -9 <PID>`，或换端口 `--port 8001`。

**Q: 数据库字段不匹配**  
A: 删除 `feicai.db` 重启服务，`init_db()` 会重建所有表（**会丢失数据**）。
