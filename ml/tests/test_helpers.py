import json
import random

from app.auth import AuthError, check_claims
from app.ratelimit import RateLimiter
from batching import make_batches
from make_pairs import build_pairs, without_eval_questions
from retrieval_eval import calibrate_threshold, metrics, rejection_rate


def test_batches_never_repeat_a_chunk_inside_one_batch():
    pairs = [{"q": f"q{i}", "id": f"CDB-{i % 4}"} for i in range(40)]
    batches = make_batches(pairs, 3, random.Random(1))
    assert batches
    for batch in batches:
        assert len(batch) >= 2
        assert len({p["id"] for p in batch}) == len(batch)


def test_batching_is_reproducible_for_a_seed():
    pairs = [{"q": f"q{i}", "id": f"CDB-{i % 6}"} for i in range(30)]
    assert make_batches(pairs, 4, random.Random(7)) == make_batches(pairs, 4, random.Random(7))


def test_metrics_and_rejection():
    qs = [
        {"kind": "in_scope", "gold": ["A"]},
        {"kind": "in_scope", "gold": ["B"]},
        {"kind": "in_scope", "gold": ["C"]},
        {"kind": "out_of_scope", "gold": []},
        {"kind": "out_of_scope", "gold": []},
    ]
    rankings = [["A", "X"], ["X", "B"], [], [], ["A"]]
    m = metrics(qs, rankings)
    assert m["n"] == 3
    assert m["hit@1"] == 1 / 3
    assert m["hit@4"] == 2 / 3
    assert abs(m["mrr@4"] - (1 + 0.5) / 3) < 1e-9
    assert m["no_result"] == 1 / 3
    assert rejection_rate(qs, rankings) == 0.5


def test_threshold_separates_in_scope_from_out_of_scope():
    t = calibrate_threshold([0.82, 0.85, 0.9], [0.6, 0.65, 0.7])
    assert 0.7 < t < 0.82
    assert calibrate_threshold([], [0.5]) is None


def test_pairs_come_from_the_catalog_and_skip_eval_questions():
    chunks = [
        {"id": "CSDP-12", "title": "SECOND DEGREE OFFENSES", "text": "1. Brawl inside the campus;\n5. Vandalism (destroying school properties);"},
        {"id": "CSDP-16", "title": "SECOND DEGREE INTERVENTIONS", "text": "1. University Censure"},
    ]
    offenses = [{"type": "Vandalism", "category": "Second Degree", "section": "Second Degree Offenses, no. 5"}]
    pairs = build_pairs(chunks, offenses)
    assert {"q": "Is vandalism an offense?", "id": "CSDP-12"} in pairs
    assert {"q": "What is the sanction for vandalism?", "id": "CSDP-16"} in pairs
    kept = without_eval_questions(pairs, [{"q": "Is vandalism an offense?"}])
    assert {"q": "Is vandalism an offense?", "id": "CSDP-12"} not in kept
    assert len(kept) == len(pairs) - 1


def test_pairs_find_the_interventions_chunk_by_title_not_by_id():
    chunks = [
        {"id": "X-1", "title": "FIRST DEGREE OFFENSES", "text": "1. Shouting;"},
        {"id": "X-9", "title": "FIRST DEGREE INTERVENTIONS", "text": "1. Disciplinary reprimand"},
    ]
    offenses = [{"type": "Shouting", "category": "First Degree", "section": "First Degree Offenses, no. 1"}]
    pairs = build_pairs(chunks, offenses)
    assert {"q": "Is shouting an offense?", "id": "X-1"} in pairs
    assert {"q": "What is the penalty for shouting?", "id": "X-9"} in pairs


def test_rate_limiter_window_expires():
    now = [0.0]
    limiter = RateLimiter(2, clock=lambda: now[0])
    assert limiter.allow("u") and limiter.allow("u") and not limiter.allow("u")
    now[0] = 61.0
    assert limiter.allow("u")


def test_claims_check():
    assert check_claims({"uid": "u1", "email": "A@UB.EDU.PH", "email_verified": True}) == "u1"
    for bad in ({"email": "a@gmail.com", "email_verified": True}, {"email": "a@ub.edu.ph", "email_verified": False}, {}):
        try:
            check_claims(bad)
        except AuthError as exc:
            assert exc.status == 403
        else:
            raise AssertionError("expected AuthError")


def test_content_hash_matches_the_shared_fixture():
    import json
    from pathlib import Path

    from app.fingerprint import content_hash

    case = json.loads((Path(__file__).parent / "fixtures" / "hash_case.json").read_text(encoding="utf-8"))
    assert content_hash(case["chunks"]) == case["hash"]
    case["chunks"][0]["text"] += "!"
    assert content_hash(case["chunks"]) != case["hash"]
