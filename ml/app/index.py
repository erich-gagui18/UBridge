import json
from pathlib import Path

import numpy as np


class VectorIndex:
    def __init__(self, ids, vectors, config):
        vectors = np.asarray(vectors, dtype=np.float32)
        if vectors.ndim != 2 or len(ids) != vectors.shape[0]:
            raise ValueError("ids and vectors must have the same length")
        self.ids = [str(i) for i in ids]
        self.vectors = vectors
        self.config = dict(config)

    @property
    def size(self):
        return len(self.ids)

    @property
    def handbook_version(self):
        return self.config.get("handbook_version", "")

    @property
    def handbook_hash(self):
        return self.config.get("handbook_hash", "")

    @property
    def model_name(self):
        return self.config.get("model", "")

    def scores(self, query_vector):
        query = np.asarray(query_vector, dtype=np.float32).reshape(-1)
        return self.vectors @ query

    def search(self, query_vector, top_k=4, min_score=None):
        scores = self.scores(query_vector)
        order = np.argsort(-scores, kind="stable")[:top_k]
        hits = [(self.ids[i], float(scores[i])) for i in order]
        if min_score is not None:
            hits = [(i, s) for i, s in hits if s >= min_score]
        return hits

    def save(self, directory):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(directory / "index.npz", vectors=self.vectors, ids=np.array(self.ids))
        (directory / "config.json").write_text(
            json.dumps(self.config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    @classmethod
    def load(cls, directory):
        directory = Path(directory)
        config = json.loads((directory / "config.json").read_text(encoding="utf-8"))
        with np.load(directory / "index.npz", allow_pickle=False) as data:
            return cls(data["ids"].tolist(), data["vectors"], config)
