import argparse
import json
from pathlib import Path

from app.encoder import SentenceEncoder
from retrieval_eval import (
    DEFAULT_HANDBOOK,
    DEFAULT_QUESTIONS,
    ROOT,
    apply_threshold,
    by_language,
    calibrate_threshold,
    dense_scores,
    hybrid_ranking,
    load_handbook,
    load_questions,
    metrics,
    rank_ids,
    rejection_rate,
    top_scores,
)

PCT = lambda x: f"{x * 100:.1f}%"


def row(name, m, rejection):
    return f"| {name} | {m['n']} | {PCT(m['hit@1'])} | {PCT(m['hit@4'])} | {m['mrr@4']:.3f} | {PCT(m['no_result'])} | {PCT(rejection)} |"


def main():
    parser = argparse.ArgumentParser(description="Compare keyword (BM25) retrieval with PyTorch embedding models")
    parser.add_argument("--models", nargs="*", default=[])
    parser.add_argument("--bm25", default=str(ROOT / "artifacts" / "bm25_results.json"))
    parser.add_argument("--handbook", default=str(DEFAULT_HANDBOOK))
    parser.add_argument("--questions", default=str(DEFAULT_QUESTIONS))
    parser.add_argument("--split", default="test")
    parser.add_argument("--out", default=str(ROOT / "artifacts" / "report.md"))
    args = parser.parse_args()

    version, chunks = load_handbook(args.handbook)
    ids = [c["id"] for c in chunks]
    questions = load_questions(args.questions, {args.split})
    dev = load_questions(args.questions, {"dev"})
    bm25 = json.loads(Path(args.bm25).read_text(encoding="utf-8"))
    if bm25.get("handbookVersion") != version:
        raise SystemExit("bm25_results.json was built from a different handbook; run: npm run ml:baseline")
    keyword = [bm25["results"].get(q["id"], []) for q in questions]

    lines = [
        f"# Retrieval evaluation ({args.split} split, handbook {version})",
        "",
        "hit@k: a correct chunk is in the top k. MRR@4: mean reciprocal rank of the first correct chunk. "
        "No result: in-scope questions with nothing returned. Rejection: out-of-scope questions correctly answered with nothing.",
        "",
        "| System | In-scope questions | hit@1 | hit@4 | MRR@4 | No result | Out-of-scope rejected |",
        "|---|---|---|---|---|---|---|",
        row("Keyword (BM25, current)", metrics(questions, keyword), rejection_rate(questions, keyword)),
    ]
    language_rows = [("Keyword (BM25, current)", by_language(questions, keyword))]

    for model_name in args.models:
        encoder = SentenceEncoder.from_name(model_name)
        dev_matrix = dense_scores(encoder, chunks, dev)
        threshold = calibrate_threshold(top_scores(dev, dev_matrix, "in_scope"), top_scores(dev, dev_matrix, "out_of_scope"))
        matrix = dense_scores(encoder, chunks, questions)
        dense = [apply_threshold(r, threshold) for r in rank_ids(matrix, ids)]
        hybrid = [hybrid_ranking(k, d) for k, d in zip(keyword, dense)]
        dense_ids = [[i for i, _ in r] for r in dense]
        label = f"{model_name} (threshold {threshold})"
        lines.append(row(f"Dense: {label}", metrics(questions, dense_ids), rejection_rate(questions, dense_ids)))
        lines.append(row(f"Hybrid (BM25 + dense): {model_name}", metrics(questions, hybrid), rejection_rate(questions, hybrid)))
        language_rows.append((f"Dense: {model_name}", by_language(questions, dense_ids)))
        language_rows.append((f"Hybrid: {model_name}", by_language(questions, hybrid)))

    lines += ["", "## hit@4 by question language (en = English, tl = Filipino/Taglish)", "", "| System | en | tl |", "|---|---|---|"]
    for name, langs in language_rows:
        lines.append(f"| {name} | {PCT(langs.get('en', {}).get('hit@4', 0))} | {PCT(langs.get('tl', {}).get('hit@4', 0))} |")
    lines += ["", f"Thresholds are calibrated on the dev split ({len(dev)} questions) and reported on the {args.split} split.", ""]

    report = "\n".join(lines)
    Path(args.out).write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
