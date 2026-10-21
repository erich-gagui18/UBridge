import pytest
from fastapi.testclient import TestClient

from app.auth import AuthError
from app.config import Settings
from app.main import create_app

GOOD = {"uid": "u1", "email": "student@ub.edu.ph", "email_verified": True}


def make_client(index, encoder, claims=GOOD, **settings):
    def verifier(token):
        if token == "bad":
            raise AuthError(401, "invalid token")
        return claims

    app = create_app(encoder, index, verifier, Settings(**settings), torch_version="0.0-test")
    return TestClient(app)


def post(client, question="what is the penalty for vandalism", token="good"):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/search", json={"question": question}, headers=headers)


def test_search_returns_ids_scores_and_version_only(index, encoder):
    res = post(make_client(index, encoder))
    assert res.status_code == 200
    body = res.json()
    assert body["handbookVersion"] == "test-1"
    assert body["handbookHash"] == "hash-1"
    assert body["hits"][0]["id"] == "CDB-21"
    assert set(body["hits"][0]) == {"id", "score"}
    assert "text" not in str(body)


def test_missing_or_invalid_token_is_401(index, encoder):
    client = make_client(index, encoder)
    assert post(client, token=None).status_code == 401
    assert post(client, token="bad").status_code == 401


def test_non_ub_or_unverified_accounts_are_403(index, encoder):
    assert post(make_client(index, encoder, {"uid": "u", "email": "x@gmail.com", "email_verified": True})).status_code == 403
    assert post(make_client(index, encoder, {"uid": "u", "email": "x@ub.edu.ph", "email_verified": False})).status_code == 403


def test_question_length_is_validated(index, encoder):
    client = make_client(index, encoder)
    assert post(client, question="a").status_code == 422
    assert post(client, question="x" * 301).status_code == 422


def test_rate_limit_applies_per_user(index, encoder):
    client = make_client(index, encoder, rate_limit_per_minute=2)
    assert [post(client).status_code for _ in range(3)] == [200, 200, 429]


def test_min_score_from_the_index_config_drops_weak_matches(index, encoder):
    index.config["min_score"] = 0.99
    assert post(make_client(index, encoder), question="appeal decision president").json()["hits"] == []


def test_health_needs_no_token_and_reports_the_index(index, encoder):
    res = make_client(index, encoder).get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "model": "stub-model", "chunks": 3, "handbookVersion": "test-1", "handbookHash": "hash-1", "torch": "0.0-test"}


def test_cors_allows_the_hosting_origin_only(index, encoder):
    client = make_client(index, encoder)
    headers = {"Origin": "https://ubridge-76eee.web.app", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}
    allowed = client.options("/search", headers=headers)
    assert allowed.headers.get("access-control-allow-origin") == "https://ubridge-76eee.web.app"
    denied = client.options("/search", headers={**headers, "Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


def test_auth_can_be_switched_off_for_local_testing(index, encoder):
    client = make_client(index, encoder, require_auth=False)
    assert post(client, token=None).status_code == 200
