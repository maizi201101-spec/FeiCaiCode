from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import projects, scripts, script_management, assets, asset_images, tasks, shots, prompts, settings, videos, qc, export, presets, export_prompts, providers, system_settings, costume_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="飞彩 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(scripts.router, prefix="/api")
app.include_router(script_management.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(asset_images.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(shots.router)
app.include_router(prompts.router)
app.include_router(settings.router)
app.include_router(videos.router)
app.include_router(qc.router)
app.include_router(export.router)
app.include_router(presets.router)
app.include_router(export_prompts.router)
app.include_router(providers.router)
app.include_router(system_settings.router)
app.include_router(costume_registry.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
