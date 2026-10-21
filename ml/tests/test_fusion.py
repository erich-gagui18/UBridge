import json
from pathlib import Path

import pytest

from app.fusion import rrf

CASES = json.loads((Path(__file__).parent / "fixtures" / "fusion_cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_rrf_matches_shared_fixture(case):
    assert rrf(case["rankings"], limit=case["limit"]) == case["expected"]
