import os

import numpy as np

import pytest
from fastapi.testclient import TestClient

import apps.api.main as api
from apps.api.main import app

client = TestClient(app)


def bell_circuit(shots=2000, seed=7):
    return {
        "circuit": {
            "numQubits": 2,
            "gates": [
                {"kind": "H", "qubits": [0], "params": [], "column": 0},
                {"kind": "CNOT", "qubits": [0, 1], "params": [], "column": 1},
            ],
        },
        "shots": shots,
        "seed": seed,
    }


def test_health_reports_fallback_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["ai"] == "local-fallback"


def test_health_prefers_nvidia_when_configured(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    body = client.get("/api/health").json()
    assert body["ai"] == "nvidia"
    assert body["model"]


def test_bell_state_probabilities():
    response = client.post("/api/simulate", json=bell_circuit(shots=100))
    assert response.status_code == 200
    body = response.json()
    p = body["probabilities"]
    assert p[0] == pytest.approx(0.5)
    assert p[3] == pytest.approx(0.5)
    assert p[1] == pytest.approx(0.0)
    assert p[2] == pytest.approx(0.0)
    assert set(body["counts"]) <= {"00", "11"}


def test_expected_probabilities_agreement():
    payload = bell_circuit(shots=10)
    payload["expected_probabilities"] = [0.5, 0.0, 0.0, 0.5]
    body = client.post("/api/simulate", json=payload).json()
    assert body["agrees"] is True
    assert body["max_abs_diff"] < 1e-9


def test_rotation_matches_closed_form():
    # RY(pi/2) on |0> -> (|0> + |1>)/sqrt(2)
    payload = {
        "circuit": {
            "numQubits": 1,
            "gates": [{"kind": "RY", "qubits": [0], "params": [1.5707963267948966], "column": 0}],
        },
        "shots": 10,
    }
    body = client.post("/api/simulate", json=payload).json()
    assert body["probabilities"][0] == pytest.approx(0.5, abs=1e-9)
    assert body["probabilities"][1] == pytest.approx(0.5, abs=1e-9)


def test_swap_test_probability():
    payload = {
        "circuit": {
            "numQubits": 3,
            "gates": [
                {"kind": "X", "qubits": [1], "params": [], "column": 0},
                {"kind": "H", "qubits": [2], "params": [], "column": 1},
                {"kind": "H", "qubits": [0], "params": [], "column": 2},
                {"kind": "CSWAP", "qubits": [0, 1, 2], "params": [], "column": 3},
                {"kind": "H", "qubits": [0], "params": [], "column": 4},
            ],
        },
        "shots": 10,
    }
    body = client.post("/api/simulate", json=payload).json()
    p = body["probabilities"]
    p0 = sum(prob for i, prob in enumerate(p) if not (i & 1))
    assert p0 == pytest.approx(0.75, abs=1e-9)


def test_conditional_gate_rejected():
    payload = {
        "circuit": {
            "numQubits": 1,
            "gates": [
                {"kind": "M", "qubits": [0], "params": [], "column": 0},
                {"kind": "X", "qubits": [0], "params": [], "column": 1, "condition": {"qubit": 0, "value": 1}},
            ],
        },
        "shots": 10,
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 422


def test_out_of_range_qubit_rejected():
    payload = {
        "circuit": {"numQubits": 1, "gates": [{"kind": "H", "qubits": [3], "params": [], "column": 0}]},
        "shots": 10,
    }
    assert client.post("/api/simulate", json=payload).status_code == 422


def test_tutor_falls_back_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    response = client.post(
        "/api/ai/tutor",
        json={
            "question": "why does the hadamard create superposition?",
            "mode": "explain",
            "insights": [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "local"
    assert "superposition" in body["text"].lower()
    assert isinstance(body["suggestions"], list) and body["suggestions"]


def test_tutor_debug_mode_surfaces_errors(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    response = client.post(
        "/api/ai/tutor",
        json={
            "question": "",
            "mode": "debug",
            "insights": [
                {"level": "error", "title": "Gate runs after a measurement", "detail": "The state is classical.", "fix": "Move the measurement last."}
            ],
        },
    )
    body = response.json()
    assert "after a measurement" in body["text"]
    assert "Move the measurement last." in body["text"]


def test_tutor_rejects_overlong_question():
    response = client.post("/api/ai/tutor", json={"question": "x" * 5000, "mode": "explain"})
    assert response.status_code == 422


def test_plan_is_grounded_and_actionable(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    response = client.post(
        "/api/ai/plan",
        json={
            "name": "Ada",
            "minutes": 20,
            "mode": "guided",
            "lessons_completed": 3,
            "challenges_solved": 2,
            "mastered": 1,
            "topics": [
                {"id": "QI-02", "title": "Entanglement", "level": "Beginner", "mastery": 0.42},
                {"id": "QI-01", "title": "Superposition", "level": "Beginner", "mastery": 0.91},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "local"
    assert len(body["steps"]) == 3
    assert body["focus_topic"] == "QI-02"
    assert {step["action"] for step in body["steps"]} == {"lesson", "challenge"}
    assert "Ada" in body["headline"]


# --- AI cost guard ---------------------------------------------------------


def _tutor_post(ip: str | None = None):
    headers = {"x-forwarded-for": ip} if ip else {}
    return client.post(
        "/api/ai/tutor",
        json={"question": "what is a qubit?", "mode": "explain"},
        headers=headers,
    )


def test_ai_rate_limit_is_per_ip(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(api, "_call_nvidia", lambda key, payload: "stub answer")
    monkeypatch.setattr(api, "AI_HOURLY_PER_IP", 2)
    monkeypatch.setattr(api, "_ai_hits", {})
    monkeypatch.setattr(api, "_ai_day", {"day": "", "count": 0})

    assert _tutor_post("203.0.113.9").status_code == 200
    assert _tutor_post("203.0.113.9").status_code == 200
    blocked = _tutor_post("203.0.113.9")
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0
    # A different learner behind the same proxy is unaffected.
    assert _tutor_post("203.0.113.10").status_code == 200


def test_ai_daily_cap_stops_every_ip(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    monkeypatch.setattr(api, "_call_nvidia", lambda key, payload: "stub answer")
    monkeypatch.setattr(api, "AI_HOURLY_PER_IP", 50)
    monkeypatch.setattr(api, "AI_DAILY_CALLS", 1)
    monkeypatch.setattr(api, "_ai_hits", {})
    monkeypatch.setattr(api, "_ai_day", {"day": "", "count": 0})

    assert _tutor_post("198.51.100.1").status_code == 200
    assert _tutor_post("198.51.100.2").status_code == 429


def test_offline_tutor_is_never_rate_limited(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(api, "AI_HOURLY_PER_IP", 1)
    monkeypatch.setattr(api, "AI_DAILY_CALLS", 1)
    monkeypatch.setattr(api, "_ai_hits", {})
    monkeypatch.setattr(api, "_ai_day", {"day": "", "count": 0})

    for _ in range(4):
        assert _tutor_post("192.0.2.5").status_code == 200


# --- density engine and noisy cross-check ---------------------------------


def one_qubit(kind="X", qubits=(0,)):
    return {
        "circuit": {
            "numQubits": 2,
            "gates": [{"kind": kind, "qubits": list(qubits), "params": [], "column": 0}],
        },
        "shots": 4,
        "seed": 1,
    }


def test_ideal_density_matches_statevector():
    body = bell_circuit(shots=10)
    body["noise"] = {"depolarizing": 0.0, "amplitudeDamping": 0.0, "readoutError": 0.0}
    ideal = client.post("/api/simulate", json=body).json()
    assert ideal["backend"] == "numpy-statevector"
    body["noise"]["depolarizing"] = 1e-12  # forces the density path
    noisy = client.post("/api/simulate", json=body).json()
    assert noisy["backend"] == "numpy-density"
    for a, b in zip(ideal["probabilities"], noisy["probabilities"]):
        assert a == pytest.approx(b, abs=1e-9)


def test_depolarizing_matches_the_analytic_channel():
    body = one_qubit()
    body["noise"] = {"depolarizing": 0.3, "amplitudeDamping": 0.0, "readoutError": 0.0}
    p = client.post("/api/simulate", json=body).json()["probabilities"]
    # (1-p)|1><1| + p/3 (X+Y+Z) leaves 2p/3 on |0> and 1-2p/3 on |1>.
    assert p[0] == pytest.approx(0.2, abs=1e-9)  # index 0 = q0 reads 0
    assert p[1] == pytest.approx(0.8, abs=1e-9)


def test_amplitude_damping_matches_the_analytic_channel():
    body = one_qubit()
    body["noise"] = {"depolarizing": 0.0, "amplitudeDamping": 0.25, "readoutError": 0.0}
    p = client.post("/api/simulate", json=body).json()["probabilities"]
    assert p[0] == pytest.approx(0.25, abs=1e-9)
    assert p[1] == pytest.approx(0.75, abs=1e-9)


def test_readout_error_flips_reported_bits():
    body = one_qubit()
    body["shots"] = 4000
    body["noise"] = {"depolarizing": 0.0, "amplitudeDamping": 0.0, "readoutError": 0.5}
    counts = client.post("/api/simulate", json=body).json()["counts"]
    zeros = counts.get("00", 0) + counts.get("10", 0)
    assert 1600 < zeros < 2400  # half of 4000, +-10%


def test_noisy_cross_check_is_capped_at_six_qubits():
    body = {
        "circuit": {"numQubits": 7, "gates": [{"kind": "H", "qubits": [0], "params": [], "column": 0}]},
        "noise": {"depolarizing": 0.01},
    }
    assert client.post("/api/simulate", json=body).status_code == 422


def test_density_state_is_a_valid_quantum_state():
    from apps.api.main import NoiseSpec, simulate_density

    circuit = api.Circuit(
        numQubits=2,
        gates=[
            api.Gate(kind="H", qubits=[0], params=[], column=0),
            api.Gate(kind="CNOT", qubits=[0, 1], params=[], column=1),
        ],
    )
    rho = simulate_density(circuit, NoiseSpec(depolarizing=0.05, amplitudeDamping=0.02))
    assert np.allclose(rho, rho.conj().T, atol=1e-12)  # Hermitian
    assert np.isclose(np.trace(rho).real, 1.0, atol=1e-9)  # trace 1
    assert np.all(np.linalg.eigvalsh(rho) > -1e-12)  # positive semidefinite
