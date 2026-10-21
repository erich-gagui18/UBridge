def make_batches(pairs, batch_size, rng):
    pool = list(pairs)
    rng.shuffle(pool)
    batches = []
    while pool:
        batch, seen, rest = [], set(), []
        for pair in pool:
            if len(batch) < batch_size and pair["id"] not in seen:
                batch.append(pair)
                seen.add(pair["id"])
            else:
                rest.append(pair)
        if len(batch) >= 2:
            batches.append(batch)
        if len(rest) == len(pool):
            break
        pool = rest
    return batches
