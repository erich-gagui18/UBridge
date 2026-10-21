import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ORIGINS = (
    "https://ubridge-76eee.web.app,https://ubridge-76eee.firebaseapp.com,http://localhost:5005,http://127.0.0.1:5005"
)


@dataclass(frozen=True)
class Settings:
    project_id: str = "ubridge-76eee"
    allowed_origins: tuple = tuple(DEFAULT_ORIGINS.split(","))
    require_auth: bool = True
    rate_limit_per_minute: int = 20
    top_k: int = 4
    artifacts_dir: Path = ROOT / "artifacts"


def load_settings(env=None):
    env = os.environ if env is None else env
    origins = env.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    return Settings(
        project_id=env.get("FIREBASE_PROJECT_ID", "ubridge-76eee"),
        allowed_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        require_auth=env.get("REQUIRE_AUTH", "true").lower() != "false",
        rate_limit_per_minute=int(env.get("RATE_LIMIT_PER_MINUTE", "20")),
        top_k=int(env.get("TOP_K", "4")),
        artifacts_dir=Path(env.get("ARTIFACTS_DIR", ROOT / "artifacts")),
    )
