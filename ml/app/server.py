from .auth import FirebaseVerifier
from .config import load_settings
from .encoder import SentenceEncoder
from .index import VectorIndex
from .main import create_app


def build():
    import torch

    settings = load_settings()
    index = VectorIndex.load(settings.artifacts_dir)
    encoder = SentenceEncoder.from_name(
        index.model_name,
        index.config.get("query_prefix"),
        index.config.get("passage_prefix"),
    )
    encoder.encode_queries(["warm up"])
    verifier = FirebaseVerifier(settings.project_id) if settings.require_auth else None
    return create_app(encoder, index, verifier, settings, torch_version=torch.__version__)


app = build()
