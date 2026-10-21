# Retrieval evaluation (test split, handbook saep-m-rev4-2026)

hit@k: a correct chunk is in the top k. MRR@4: mean reciprocal rank of the first correct chunk. No result: in-scope questions with nothing returned. Rejection: out-of-scope questions correctly answered with nothing.

| System | In-scope questions | hit@1 | hit@4 | MRR@4 | No result | Out-of-scope rejected |
|---|---|---|---|---|---|---|
| Keyword (BM25, current) | 41 | 58.5% | 68.3% | 0.628 | 24.4% | 72.7% |

## hit@4 by question language (en = English, tl = Filipino/Taglish)

| System | en | tl |
|---|---|---|
| Keyword (BM25, current) | 82.4% | 0.0% |

Thresholds are calibrated on the dev split (18 questions) and reported on the test split.
