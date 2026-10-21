import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import batch_to_device

from app.encoder import SentenceEncoder, prefixes_for
from batching import make_batches
from retrieval_eval import (
    DEFAULT_HANDBOOK,
    DEFAULT_QUESTIONS,
    ROOT,
    dense_scores,
    load_handbook,
    load_questions,
    metrics,
    passage_text,
    rank_ids,
)


def embed(model, texts, device):
    features = batch_to_device(model.tokenize(texts), device)
    return F.normalize(model(features)["sentence_embedding"], dim=-1)


def contrastive_loss(queries, passages, temperature):
    logits = queries @ passages.T / temperature
    labels = torch.arange(logits.size(0), device=logits.device)
    return 0.5 * (F.cross_entropy(logits, labels) + F.cross_entropy(logits.T, labels))


def dev_hit_at_4(model, chunks, dev, query_prefix, passage_prefix):
    model.eval()
    with torch.no_grad():
        encoder = SentenceEncoder(model, query_prefix, passage_prefix)
        matrix = dense_scores(encoder, chunks, dev)
    model.train()
    rankings = [[i for i, _ in r] for r in rank_ids(matrix, [c["id"] for c in chunks])]
    return metrics(dev, rankings)["hit@4"]


def train(args):
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    rng = random.Random(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    query_prefix, passage_prefix = prefixes_for(args.model)
    model = SentenceTransformer(args.model, device=str(device))
    model.max_seq_length = args.max_seq_length

    _, chunks = load_handbook(args.handbook)
    passages = {c["id"]: passage_prefix + passage_text(c) for c in chunks}
    pairs = [json.loads(l) for l in Path(args.pairs).read_text(encoding="utf-8").splitlines() if l.strip()]
    pairs = [p for p in pairs if p["id"] in passages]
    dev = load_questions(args.questions, {"dev"})

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    best = dev_hit_at_4(model, chunks, dev, query_prefix, passage_prefix) if dev else 0.0
    log = [{"epoch": 0, "loss": None, "dev_hit@4": best}]
    print(f"epoch 0 (pretrained): dev hit@4 = {best:.3f}")
    model.save(args.out)

    model.train()
    for epoch in range(1, args.epochs + 1):
        losses = []
        for batch in make_batches(pairs, args.batch_size, rng):
            queries = embed(model, [query_prefix + p["q"] for p in batch], device)
            targets = embed(model, [passages[p["id"]] for p in batch], device)
            loss = contrastive_loss(queries, targets, args.temperature)
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(loss.item())
        score = dev_hit_at_4(model, chunks, dev, query_prefix, passage_prefix) if dev else 0.0
        mean_loss = float(np.mean(losses)) if losses else None
        log.append({"epoch": epoch, "loss": mean_loss, "dev_hit@4": score})
        print(f"epoch {epoch}: loss = {mean_loss}, dev hit@4 = {score:.3f}")
        if score >= best:
            best = score
            model.save(args.out)
            print(f"saved to {args.out}")

    Path(args.out, "train_log.json").write_text(json.dumps({"args": vars(args), "log": log}, indent=2) + "\n", encoding="utf-8")
    return log


def main():
    parser = argparse.ArgumentParser(description="Fine-tune an embedding model on handbook question and chunk pairs with a PyTorch loop")
    parser.add_argument("--model", default="intfloat/multilingual-e5-small")
    parser.add_argument("--pairs", default=str(ROOT / "eval" / "train_pairs.jsonl"))
    parser.add_argument("--handbook", default=str(DEFAULT_HANDBOOK))
    parser.add_argument("--questions", default=str(DEFAULT_QUESTIONS))
    parser.add_argument("--out", default=str(ROOT / "models" / "ubridge-embedder"))
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--temperature", type=float, default=0.05)
    parser.add_argument("--max-seq-length", type=int, default=256)
    parser.add_argument("--seed", type=int, default=42)
    train(parser.parse_args())


if __name__ == "__main__":
    main()
