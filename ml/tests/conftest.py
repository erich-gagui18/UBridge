import zlib

import numpy as np
import pytest

from app.index import VectorIndex


class StubEncoder:
    dim = 512

    def _vec(self, text):
        v = np.zeros(self.dim, dtype=np.float32)
        for word in text.lower().replace("?", " ").replace(".", " ").split():
            v[zlib.crc32(word.encode('utf-8')) % self.dim] += 1.0
        norm = np.linalg.norm(v)
        return v / norm if norm else v

    def encode_queries(self, texts):
        return np.stack([self._vec(t) for t in texts])

    def encode_passages(self, texts):
        return np.stack([self._vec(t) for t in texts])


CHUNKS = [
    ("CDB-21", "vandalism destroying school property windows desks"),
    ("CDB-25", "university censure probation suspension days"),
    ("CDB-40", "appeal decision president in writing"),
]


@pytest.fixture
def encoder():
    return StubEncoder()


@pytest.fixture
def index(encoder):
    vectors = encoder.encode_passages([text for _, text in CHUNKS])
    config = {"model": "stub-model", "handbook_version": "test-1", "handbook_hash": "hash-1", "min_score": None}
    return VectorIndex([i for i, _ in CHUNKS], vectors, config)
