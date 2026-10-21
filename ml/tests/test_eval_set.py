import json
from pathlib import Path

from retrieval_eval import DEFAULT_HANDBOOK, DEFAULT_QUESTIONS, ROOT, load_handbook, load_questions

QUESTIONS = load_questions(DEFAULT_QUESTIONS)
VERSION, CHUNKS = load_handbook(DEFAULT_HANDBOOK)
CHUNK_IDS = {c["id"] for c in CHUNKS}


def test_question_ids_are_unique_and_fields_valid():
    assert len({q["id"] for q in QUESTIONS}) == len(QUESTIONS)
    for q in QUESTIONS:
        assert q["kind"] in {"in_scope", "out_of_scope"}
        assert q["split"] in {"dev", "test"}
        assert q["lang"] in {"en", "tl"}
        assert q["q"].strip()


def test_gold_chunks_exist_and_match_the_kind():
    for q in QUESTIONS:
        if q["kind"] == "in_scope":
            assert q["gold"], q["id"]
            assert set(q["gold"]) <= CHUNK_IDS, q["id"]
        else:
            assert q["gold"] == [], q["id"]


def test_both_splits_have_both_kinds_and_both_languages():
    for split in ("dev", "test"):
        rows = [q for q in QUESTIONS if q["split"] == split]
        assert {q["kind"] for q in rows} == {"in_scope", "out_of_scope"}
    assert {q["lang"] for q in QUESTIONS if q["kind"] == "in_scope"} == {"en", "tl"}


def test_the_bm25_baseline_is_current():
    path = ROOT / "artifacts" / "bm25_results.json"
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    assert data["handbookVersion"] == VERSION
    assert {q["id"] for q in QUESTIONS} <= set(data["results"])
