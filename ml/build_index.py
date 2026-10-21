import argparse
import datetime as dt
import json
from pathlib import Path

from app.encoder import SentenceEncoder, prefixes_for
from app.fingerprint import content_hash
from app.index import VectorIndex
from retrieval_eval import (
    DEFAULT_HANDBOOK,
    DEFAULT_QUESTIONS,
    calibrate_threshold,
    dense_scores,
    load_handbook,
    load_questions,
    passage_text,
    top_scores,
)


def main():
    parser = argparse.ArgumentParser(description="Encode the handbook chunks and write artifacts/index.npz and config.json")
    parser.add_argument("--model", default="intfloat/multilingual-e5-small")
    parser.add_argument("--record-as", default=None)
    parser.add_argument("--handbook", default=str(DEFAULT_HANDBOOK))
    parser.add_argument("--questions", default=str(DEFAULT_QUESTIONS))
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent / "artifacts"))
    parser.add_argument("--min-score", default="auto")
    parser.add_argument("--query-prefix", default=None)
    parser.add_argument("--passage-prefix", default=None)
    args = parser.parse_args()

    version, chunks = load_handbook(args.handbook)
    default_query, default_passage = prefixes_for(args.record_as or args.model)
    query_prefix = default_query if args.query_prefix is None else args.query_prefix
    passage_prefix = default_passage if args.passage_prefix is None else args.passage_prefix

    encoder = SentenceEncoder.from_name(args.model, query_prefix, passage_prefix)
    vectors = encoder.encode_passages([passage_text(c) for c in chunks])

    min_score = None
    if args.min_score == "auto":
        dev = load_questions(args.questions, {"dev"})
        if dev:
            matrix = dense_scores(encoder, chunks, dev)
            min_score = calibrate_threshold(top_scores(dev, matrix, "in_scope"), top_scores(dev, matrix, "out_of_scope"))
    elif args.min_score != "none":
        min_score = float(args.min_score)

    config = {
        "model": args.record_as or args.model,
        "handbook_version": version,
        "handbook_hash": content_hash(chunks),
        "dimension": int(vectors.shape[1]),
        "chunks": len(chunks),
        "query_prefix": query_prefix,
        "passage_prefix": passage_prefix,
        "min_score": min_score,
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }
    VectorIndex([c["id"] for c in chunks], vectors, config).save(args.out)
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
