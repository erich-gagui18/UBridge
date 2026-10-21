import numpy as np
import pytest

from app.index import VectorIndex


def test_search_orders_by_similarity(index, encoder):
    hits = index.search(encoder.encode_queries(["what is the penalty for vandalism of windows"])[0], top_k=3)
    assert hits[0][0] == "CDB-21"
    assert [s for _, s in hits] == sorted([s for _, s in hits], reverse=True)


def test_min_score_filters_weak_hits(index, encoder):
    query = encoder.encode_queries(["appeal decision"])[0]
    assert index.search(query, top_k=3, min_score=0.99) == []
    assert index.search(query, top_k=3, min_score=0.0)[0][0] == "CDB-40"


def test_save_and_load_round_trip(index, encoder, tmp_path):
    index.save(tmp_path)
    loaded = VectorIndex.load(tmp_path)
    assert loaded.ids == index.ids
    assert loaded.handbook_version == "test-1"
    assert loaded.model_name == "stub-model"
    assert np.allclose(loaded.vectors, index.vectors)


def test_rejects_mismatched_ids_and_vectors():
    with pytest.raises(ValueError):
        VectorIndex(["a"], np.zeros((2, 3)), {})
