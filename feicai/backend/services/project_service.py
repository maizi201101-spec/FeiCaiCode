from pathlib import Path


def init_project_dirs(project_path: str) -> None:
    """初始化项目目录结构：assets/ 和 episodes/ 子目录"""
    base = Path(project_path)
    for sub in ["assets/characters", "assets/scenes", "assets/props", "episodes"]:
        (base / sub).mkdir(parents=True, exist_ok=True)
