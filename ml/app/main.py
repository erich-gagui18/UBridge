import time

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import AuthError, check_claims
from .config import Settings
from .ratelimit import RateLimiter


class SearchRequest(BaseModel):
    question: str = Field(min_length=2, max_length=300)


def create_app(encoder, index, verifier=None, settings=None, torch_version=None):
    settings = settings or Settings()
    limiter = RateLimiter(settings.rate_limit_per_minute)
    app = FastAPI(title="UBridge AI Guide search", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    def authenticate(authorization):
        if not settings.require_auth:
            return "anonymous"
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="missing token")
        try:
            return check_claims(verifier(authorization[7:].strip()))
        except AuthError as exc:
            raise HTTPException(status_code=exc.status, detail=exc.message) from exc

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "model": index.model_name,
            "chunks": index.size,
            "handbookVersion": index.handbook_version,
            "handbookHash": index.handbook_hash,
            "torch": torch_version,
        }

    @app.post("/search")
    def search(body: SearchRequest, authorization: str | None = Header(default=None)):
        user = authenticate(authorization)
        if not limiter.allow(user):
            raise HTTPException(status_code=429, detail="too many requests")
        started = time.perf_counter()
        vector = encoder.encode_queries([body.question.strip()])[0]
        hits = index.search(vector, settings.top_k, index.config.get("min_score"))
        return {
            "hits": [{"id": i, "score": round(s, 4)} for i, s in hits],
            "model": index.model_name,
            "handbookVersion": index.handbook_version,
            "handbookHash": index.handbook_hash,
            "ms": round((time.perf_counter() - started) * 1000, 1),
        }

    return app
