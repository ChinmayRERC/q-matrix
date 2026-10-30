"""IBM Quantum hardware execution, behind an env flag.

The workbench is a teaching simulator. This adapter lets a learner submit the
same circuit to a real IBM backend when the deployment has credentials, and
otherwise stays invisible: no token means `/api/hardware/status` reports
unavailable and `/api/hardware/run` answers 503. Nothing here runs by default,
and the token never leaves the server.

Required environment:
    IBM_QUANTUM_TOKEN     API key from quantum.ibm.com
    IBM_QUANTUM_INSTANCE  optional instance CRN (needed by some accounts)
    IBM_QUANTUM_BACKEND   optional backend name; defaults to least busy

The job is asynchronous because hardware queues outlive an HTTP timeout:
POST returns a job id, and the client polls `/api/hardware/jobs/{id}`.
In-flight job handles live in memory, so a restart forgets them — the job still
exists at IBM and can be found by its id in their dashboard.
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/hardware")

_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}
_submissions: dict[str, list[float]] = {}
MAX_SHOTS = 8192
MAX_PER_HOUR = 5
JOB_TTL = 24 * 3600


def _token() -> str:
    return os.getenv("IBM_QUANTUM_TOKEN", "").strip()


def _sdk():
    """Return (service class, sampler, pass manager) or raise 503."""
    try:
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
    except Exception:
        raise HTTPException(503, "IBM support is not installed on this server")
    service = QiskitRuntimeService(
        channel="ibm_quantum",
        token=_token(),
        instance=os.getenv("IBM_QUANTUM_INSTANCE") or None,
    )
    return service, SamplerV2, generate_preset_pass_manager


class HardwareGate(BaseModel):
    kind: str = Field(max_length=16)
    qubits: list[int] = Field(min_length=1, max_length=3)
    params: list[float] = Field(default_factory=list, max_length=3)
    column: int = Field(default=0, ge=0, le=10_000)


class HardwareCircuit(BaseModel):
    numQubits: int = Field(ge=1, le=40)
    gates: list[HardwareGate] = Field(max_length=300)


class HardwareRun(BaseModel):
    circuit: HardwareCircuit
    shots: int = Field(default=1024, ge=1, le=MAX_SHOTS)


def _build(circuit: HardwareCircuit):
    """Translate the API gate list to a Qiskit circuit.

    shortcut: measurement gates are collapsed into one final measure_all, which
    is what a teaching run wants; mid-circuit measurement and feed-forward need
    dynamic circuits and a calibration pass, so they stay browser-only.
    """
    from qiskit import QuantumCircuit

    qc = QuantumCircuit(circuit.numQubits)
    for gate in sorted(circuit.gates, key=lambda g: g.column):
        kind = gate.kind.upper()
        q = gate.qubits
        p = gate.params
        if kind in ("M", "BARRIER", "I"):
            continue
        if kind == "H":
            qc.h(q[0])
        elif kind == "X":
            qc.x(q[0])
        elif kind == "Y":
            qc.y(q[0])
        elif kind == "Z":
            qc.z(q[0])
        elif kind in ("S", "SDG"):
            qc.s(q[0]) if kind == "S" else qc.sdg(q[0])
        elif kind in ("T", "TDG"):
            qc.t(q[0]) if kind == "T" else qc.tdg(q[0])
        elif kind in ("RX", "RY", "RZ"):
            getattr(qc, kind.lower())(p[0], q[0])
        elif kind == "U":
            qc.u(p[0], p[1], p[2], q[0])
        elif kind == "CNOT":
            qc.cx(q[0], q[1])
        elif kind == "CZ":
            qc.cz(q[0], q[1])
        elif kind in ("CRX", "CRY", "CRZ"):
            getattr(qc, kind.lower())(p[0], q[0], q[1])
        elif kind == "SWAP":
            qc.swap(q[0], q[1])
        elif kind == "CSWAP":
            qc.cswap(q[0], q[1], q[2])
        elif kind == "CCX":
            qc.ccx(q[0], q[1], q[2])
        else:
            raise HTTPException(422, f"Gate {gate.kind} cannot run on hardware")
    qc.measure_all()
    return qc


def _ip(http: Request) -> str:
    return (
        http.headers.get("x-forwarded-for", "").split(",")[-1].strip()
        or (http.client.host if http.client else "unknown")
    )


def _charge(http: Request) -> None:
    now = time.time()
    with _lock:
        recent = [t for t in _submissions.get(_ip(http), []) if now - t < 3600]
        _submissions[_ip(http)] = recent + [now]
        if len(_submissions[_ip(http)]) > MAX_PER_HOUR:
            raise HTTPException(
                429,
                f"Hardware runs are limited to {MAX_PER_HOUR} per hour",
                headers={"Retry-After": "3600"},
            )


@router.get("/status")
def status() -> dict[str, Any]:
    """Feature discovery for the UI; never reveals the token."""
    token = bool(_token())
    backend = os.getenv("IBM_QUANTUM_BACKEND") or None
    if not token:
        return {"available": False, "reason": "IBM_QUANTUM_TOKEN is not set", "backend": backend}
    try:
        _sdk()
    except HTTPException as exc:
        return {"available": False, "reason": exc.detail, "backend": backend}
    return {"available": True, "backend": backend, "reason": None}


@router.post("/run")
def run(body: HardwareRun, http: Request) -> dict[str, Any]:
    if not _token():
        raise HTTPException(503, "IBM hardware execution is not configured")
    _charge(http)
    service, SamplerV2, generate_preset_pass_manager = _sdk()
    qc = _build(body.circuit)
    try:
        name = os.getenv("IBM_QUANTUM_BACKEND", "").strip()
        backend = service.backend(name) if name else service.least_busy(operational=True, simulator=False)
        isa = generate_preset_pass_manager(backend=backend, optimization_level=1).run(qc)
        job = SamplerV2(mode=backend).run([isa], shots=body.shots)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"IBM rejected the submission: {type(exc).__name__}")

    job_id = getattr(job, "job_id", lambda: None)() or str(id(job))
    now = time.time()
    with _lock:
        for key, entry in list(_jobs.items()):
            if now - entry["created"] > JOB_TTL:
                del _jobs[key]
        _jobs[job_id] = {"job": job, "created": now, "backend": backend.name, "shots": body.shots}
    return {"jobId": job_id, "backend": backend.name, "shots": body.shots}


def _counts(result: Any) -> dict[str, int]:
    data = result[0].data
    for name in ("meas", "c", "counts"):
        register = getattr(data, name, None)
        if register is not None and hasattr(register, "get_counts"):
            return {str(k): int(v) for k, v in register.get_counts().items()}
    raise HTTPException(502, "IBM result had no classical register")


@router.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    if not _token():
        raise HTTPException(503, "IBM hardware execution is not configured")
    with _lock:
        entry = _jobs.get(job_id)
    if not entry:
        raise HTTPException(404, "Unknown job id (a server restart forgets in-flight jobs)")
    job = entry["job"]
    state = str(job.status())
    payload: dict[str, Any] = {
        "jobId": job_id,
        "backend": entry["backend"],
        "shots": entry["shots"],
        "state": state,
    }
    if state.upper() in ("DONE", "COMPLETED"):
        payload["counts"] = _counts(job.result())
    return payload
