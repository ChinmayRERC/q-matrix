import json

import pytest
from fastapi.testclient import TestClient

import apps.api.classroom as classroom
from apps.api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("QMATRIX_DB", str(tmp_path / "classroom.db"))
    monkeypatch.setattr(classroom, "_failures", {})
    yield


def make_class(name="PHY 301", pin="2468"):
    body = client.post("/api/class", json={"name": name, "pin": pin}).json()
    return body["code"], pin


def join(code, name="Asha"):
    response = client.post("/api/class/join", json={"code": code, "name": name})
    assert response.status_code == 200, response.text
    return response.json()


SNAPSHOT = {
    "name": "Asha",
    "xp": 240,
    "badges": ["first-steps"],
    "mastery": {
        "QI-02": {"pKnown": 0.91},
        "QI-03": {"pKnown": 0.4},
    },
    "lessons": {"QI-02": {"gain": 0.62, "completedAt": 1}, "QI-03": {"gain": 0.0}},
    "challenges": {"bell": {"solved": True}},
}


def test_class_join_and_sync_round_trip():
    code, _pin = make_class()
    learner = join(code)
    token = learner["token"]

    saved = client.put(
        "/api/learner/state",
        json={"payload": SNAPSHOT},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert saved.status_code == 200

    pulled = client.get("/api/learner/state", headers={"Authorization": f"Bearer {token}"}).json()
    assert pulled["payload"]["xp"] == 240
    assert pulled["classCode"] == code
    assert pulled["name"] == "Asha"


def test_unknown_class_and_bad_token_are_rejected():
    assert client.post("/api/class/join", json={"code": "ZZZZZZ", "name": "X"}).status_code == 404
    assert client.get("/api/learner/state", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/learner/state").status_code == 401


def test_educator_sees_the_roster_with_gain_and_mastery():
    code, pin = make_class()
    learner = join(code)
    client.put(
        "/api/learner/state",
        json={"payload": SNAPSHOT},
        headers={"Authorization": f"Bearer {learner['token']}"},
    )

    assert client.post("/api/educator/login", json={"code": code, "pin": "0000"}).status_code == 401
    login = client.post("/api/educator/login", json={"code": code, "pin": pin})
    assert login.status_code == 200
    token = login.json()["token"]

    roster = client.get("/api/educator/class", headers={"Authorization": f"Bearer {token}"}).json()
    assert roster["className"] == "PHY 301"
    assert len(roster["learners"]) == 1
    row = roster["learners"][0]
    assert row["xp"] == 240
    assert row["mastered"] == 1  # 0.91 clears the 0.85 bar
    assert row["lessonsCompleted"] == 1  # only the completed lesson counts
    assert row["meanGain"] == pytest.approx(0.62, abs=1e-3)
    assert roster["topics"][0]["id"] == "QI-02"


def test_roster_requires_a_live_session():
    code, pin = make_class()
    token = client.post("/api/educator/login", json={"code": code, "pin": pin}).json()["token"]
    assert client.get("/api/educator/class", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert client.get("/api/educator/class", headers={"Authorization": "Bearer stale"}).status_code == 401


def test_snapshot_size_is_capped():
    code, _pin = make_class()
    token = join(code)["token"]
    huge = {"blob": "x" * 400_000}
    response = client.put(
        "/api/learner/state",
        json={"payload": huge},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413


def test_metrics_report_ai_paths_and_latency():
    client.get("/api/health")
    body = client.get("/api/metrics").json()
    assert body["requests"] >= 1
    assert set(body["ai"]) >= {"nvidia", "claude", "local"}
    assert body["learners"] >= 0
