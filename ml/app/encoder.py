import numpy as np


def prefixes_for(model_name):
    if "e5" in str(model_name).lower():
        return "query: ", "passage: "
    return "", ""


class SentenceEncoder:
    def __init__(self, model, query_prefix="", passage_prefix="", batch_size=16):
        self.model = model
        self.query_prefix = query_prefix
        self.passage_prefix = passage_prefix
        self.batch_size = batch_size

    @classmethod
    def from_name(cls, model_name, query_prefix=None, passage_prefix=None, device="cpu"):
        from sentence_transformers import SentenceTransformer

        default_query, default_passage = prefixes_for(model_name)
        model = SentenceTransformer(model_name, device=device)
        return cls(
            model,
            default_query if query_prefix is None else query_prefix,
            default_passage if passage_prefix is None else passage_prefix,
        )

    def _encode(self, texts):
        vectors = self.model.encode(
            list(texts),
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)

    def encode_queries(self, texts):
        return self._encode([self.query_prefix + t for t in texts])

    def encode_passages(self, texts):
        return self._encode([self.passage_prefix + t for t in texts])
