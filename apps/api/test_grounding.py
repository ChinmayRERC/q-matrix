from fastapi.testclient import TestClient

import apps.api.main as api
from apps.api.grounding import check

client = TestClient(api.app)

CONTEXT = "probabilities: 00=0.5, 11=0.5. The circuit has 2 qubits, 2 gates."


def test_matching_probabilities_are_grounded():
    ok, bad = check("Measuring gives 00 or 11, 50% each.", CONTEXT)
    assert ok and bad == []


def test_invented_probability_is_caught():
    ok, bad = check("The result is |11> with probability 87%.", CONTEXT)
    assert not ok
    assert bad == ["87%"]


def test_decimal_claims_are_checked_too():
    ok, bad = check("The amplitude is 0.93 for |00>.", CONTEXT)
    assert not ok and bad == ["0.93"]


def test_certainty_and_missing_context_are_always_allowed():
    assert check("It is 100% certain to be 0.", CONTEXT)[0]
    assert check("It is 87% likely.", "")[0]


def test_percentage_and_fraction_forms_match():
    assert check("About 50% of shots land on 00.", CONTEXT)[0]
    assert check("About 0.5 of shots land on 00.", CONTEXT)[0]


def test_ungrounded_model_answer_falls_back(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    monkeypatch.setattr(api, "_call_nvidia", lambda key, payload: "It comes out |11> 87% of the time.")
    monkeypatch.setattr(api, "AI_HOURLY_PER_IP", 100)
    monkeypatch.setattr(api, "_ai_hits", {})
    monkeypatch.setattr(api, "_ai_day", {"day": "", "count": 0})

    body = client.post(
        "/api/ai/tutor",
        json={
            "question": "what will I measure?",
            "mode": "hint",
            "state_summary": "00=0.5, 11=0.5",
            "circuit_summary": "2 qubits, H then CNOT",
        },
    ).json()
    assert body["source"] == "local"
    assert body["grounded"] is False
    assert body["degraded_reason"] == "ungrounded_numbers"
    assert "87%" in body["unsupported_claims"]


def test_grounded_model_answer_is_returned(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    monkeypatch.setattr(api, "_call_nvidia", lambda key, payload: "You will see 00 or 11, 50% each.")
    monkeypatch.setattr(api, "AI_HOURLY_PER_IP", 100)
    monkeypatch.setattr(api, "_ai_hits", {})
    monkeypatch.setattr(api, "_ai_day", {"day": "", "count": 0})

    body = client.post(
        "/api/ai/tutor",
        json={
            "question": "what will I measure?",
            "mode": "hint",
            "state_summary": "00=0.5, 11=0.5",
            "circuit_summary": "2 qubits, H then CNOT",
        },
    ).json()
    assert body["source"] == "nvidia"
    assert body["grounded"] is True
