import pytest
from fastapi.testclient import TestClient

import apps.api.ibm as ibm
from apps.api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("IBM_QUANTUM_TOKEN", raising=False)
    monkeypatch.delenv("IBM_QUANTUM_BACKEND", raising=False)
    monkeypatch.setattr(ibm, "_jobs", {})
    monkeypatch.setattr(ibm, "_submissions", {})


def body(shots=64):
    return {
        "circuit": {
            "numQubits": 2,
            "gates": [
                {"kind": "H", "qubits": [0], "params": [], "column": 0},
                {"kind": "CNOT", "qubits": [0, 1], "params": [], "column": 1},
            ],
        },
        "shots": shots,
    }


def test_unconfigured_status_is_hidden_but_honest():
    status = client.get("/api/hardware/status").json()
    assert status["available"] is False
    assert "IBM_QUANTUM_TOKEN" in status["reason"]


def test_unconfigured_run_is_503_and_does_not_charge(monkeypatch):
    assert client.post("/api/hardware/run", json=body()).status_code == 503
    assert ibm._submissions == {}


def test_configured_but_no_sdk_is_503(monkeypatch):
    monkeypatch.setenv("IBM_QUANTUM_TOKEN", "secret-token")
    monkeypatch.setattr(ibm, "_sdk", lambda: (_ for _ in ()).throw(ibm.HTTPException(503, "IBM support is not installed on this server")))
    status = client.get("/api/hardware/status").json()
    assert status["available"] is False
    assert "not installed" in status["reason"]
    response = client.post("/api/hardware/run", json=body())
    assert response.status_code == 503


def test_unknown_job_is_404_when_configured(monkeypatch):
    monkeypatch.setenv("IBM_QUANTUM_TOKEN", "secret-token")
    assert client.get("/api/hardware/jobs/nope").status_code == 404


def test_shot_cap_is_enforced():
    assert client.post("/api/hardware/run", json=body(shots=10_000)).status_code == 422
