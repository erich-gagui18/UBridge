DEFAULT_K = 60


def rrf(rankings, limit=4, k=DEFAULT_K):
    scores = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    ordered = sorted(scores.items(), key=lambda pair: -pair[1])
    return [item for item, _ in ordered[:limit]]
