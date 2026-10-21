import json
from pathlib import Path

from app.fusion import rrf

ROOT = Path(__file__).resolve().parent
DEFAULT_HANDBOOK = ROOT.parent / "public" / "assets" / "js" / "data" / "handbook.json"
DEFAULT_QUESTIONS = ROOT / "eval" / "questions.jsonl"
TOP_K = 4


def load_handbook(path=DEFAULT_HANDBOOK):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data["version"], data["chunks"]


def load_questions(path=DEFAULT_QUESTIONS, splits=None):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    if splits:
        rows = [r for r in rows if r["split"] in splits]
    return rows


def passage_text(chunk):
    return f"{chunk.get('title', '')}\n{chunk['text']}".strip()


def dense_scores(encoder, chunks, questions):
    passages = encoder.encode_passages([passage_text(c) for c in chunks])
    queries = encoder.encode_queries([q["q"] for q in questions])
    return queries @ passages.T


def rank_ids(score_matrix, chunk_ids, limit=TOP_K):
    rankings = []
    for row in score_matrix:
        order = sorted(range(len(chunk_ids)), key=lambda i: -row[i])[:limit]
        rankings.append([(chunk_ids[i], float(row[i])) for i in order])
    return rankings


def apply_threshold(ranking, min_score):
    if min_score is None:
        return ranking
    return [(i, s) for i, s in ranking if s >= min_score]


def hybrid_ranking(keyword_ids, dense_ranking, limit=TOP_K):
    return rrf([list(keyword_ids), [i for i, _ in dense_ranking]], limit=limit)


def metrics(questions, rankings):
    scored = [(q, r) for q, r in zip(questions, rankings) if q["kind"] == "in_scope"]
    n = len(scored)
    if n == 0:
        return {"n": 0, "hit@1": 0.0, "hit@4": 0.0, "mrr@4": 0.0, "no_result": 0.0}
    hit1 = hit4 = reciprocal = empty = 0
    for q, ranking in scored:
        ids = list(ranking)[:TOP_K]
        gold = set(q["gold"])
        if not ids:
            empty += 1
        if ids and ids[0] in gold:
            hit1 += 1
        for rank, i in enumerate(ids, 1):
            if i in gold:
                hit4 += 1
                reciprocal += 1.0 / rank
                break
    return {
        "n": n,
        "hit@1": hit1 / n,
        "hit@4": hit4 / n,
        "mrr@4": reciprocal / n,
        "no_result": empty / n,
    }


def rejection_rate(questions, rankings):
    scored = [r for q, r in zip(questions, rankings) if q["kind"] == "out_of_scope"]
    if not scored:
        return 0.0
    return sum(1 for r in scored if not list(r)) / len(scored)


def by_language(questions, rankings):
    out = {}
    for lang in sorted({q["lang"] for q in questions}):
        pairs = [(q, r) for q, r in zip(questions, rankings) if q["lang"] == lang]
        qs, rs = [p[0] for p in pairs], [p[1] for p in pairs]
        out[lang] = metrics(qs, rs)
    return out


def calibrate_threshold(in_scope_top, out_of_scope_top):
    if not in_scope_top or not out_of_scope_top:
        return None
    candidates = sorted(set(in_scope_top) | set(out_of_scope_top))
    best, best_score = None, -1.0
    for t in candidates:
        accept_in = sum(1 for s in in_scope_top if s >= t) / len(in_scope_top)
        reject_out = sum(1 for s in out_of_scope_top if s < t) / len(out_of_scope_top)
        score = (accept_in + reject_out) / 2
        if score > best_score or (score == best_score and best is not None and t > best):
            best, best_score = t, score
    below = [s for s in in_scope_top + out_of_scope_top if s < best]
    return round((best + max(below)) / 2, 4) if below else round(best - 1e-4, 4)


def top_scores(questions, score_matrix, kind):
    return [float(max(row)) for q, row in zip(questions, score_matrix) if q["kind"] == kind]
