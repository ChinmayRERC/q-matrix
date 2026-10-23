"""Tests for the Q-matrix Qiskit reference algorithms."""

from __future__ import annotations

import math

import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.circuit.library import PhaseGate
from qiskit.quantum_info import Statevector

from qiskit_ref.algorithms import (
    bell_circuit,
    bernstein_vazirani,
    deutsch_jozsa,
    ghz_circuit,
    grover,
    noisy_bell,
    phase_estimation,
    phase_from_counts,
    qft,
    sample_counts,
    statevector,
    teleportation,
)


def most_likely(counts: dict[str, int]) -> str:
    return max(counts, key=counts.get)


def test_bell_statevector() -> None:
    psi = statevector(bell_circuit())
    expected = np.zeros(4, dtype=complex)
    expected[0] = expected[3] = 1 / math.sqrt(2)
    assert np.allclose(psi.data, expected, atol=1e-12)


def test_bell_counts_only_correlated() -> None:
    counts = sample_counts(bell_circuit(measure=True), shots=1024)
    assert set(counts) <= {"00", "11"}
    assert sum(counts.values()) == 1024


def test_ghz_statevector() -> None:
    psi = statevector(ghz_circuit(4))
    expected = np.zeros(16, dtype=complex)
    expected[0] = expected[15] = 1 / math.sqrt(2)
    assert np.allclose(psi.data, expected, atol=1e-12)


def test_deutsch_jozsa_constant_is_all_zero() -> None:
    counts = sample_counts(deutsch_jozsa(3, constant=True), shots=512)
    assert set(counts) == {"000"}


def test_deutsch_jozsa_balanced_never_all_zero() -> None:
    counts = sample_counts(deutsch_jozsa(3, constant=False), shots=512)
    assert "000" not in counts
    assert sum(counts.values()) == 512


def test_bernstein_vazirani_recovers_secret() -> None:
    for secret in ("101", "0110", "1111", "10001"):
        counts = sample_counts(bernstein_vazirani(secret), shots=512)
        assert most_likely(counts) == secret


def test_grover_amplifies_target() -> None:
    counts = sample_counts(grover(3, 5, iterations=None), shots=2048)
    assert most_likely(counts) == "101"
    # Two iterations for n=3 should be comfortably above the uniform 1/8.
    assert counts["101"] / sum(counts.values()) > 0.85


def test_qft_on_zero_is_uniform() -> None:
    psi = statevector(qft(3))
    probabilities = psi.probabilities()
    assert np.allclose(probabilities, np.ones(8) / 8, atol=1e-12)


def test_qft_inverse_is_exact_round_trip() -> None:
    prep = QuantumCircuit(3)
    prep.ry(0.31, 0)
    prep.rz(0.27, 1)
    prep.rx(0.42, 2)
    prep.cx(0, 2)
    forward = prep.compose(qft(3))
    round_trip = forward.compose(qft(3, inverse=True))
    assert np.allclose(Statevector.from_instruction(round_trip).data, Statevector.from_instruction(prep).data, atol=1e-12)


def test_qft_matches_qiskit_qftgate() -> None:
    from qiskit.circuit.library import QFTGate
    from qiskit.quantum_info import Operator

    for n in (2, 3, 4):
        reference = QuantumCircuit(n)
        reference.append(QFTGate(n), range(n))
        assert np.allclose(Operator(qft(n)).data, Operator(reference).data, atol=1e-12)


def test_phase_estimation_quarter_turn() -> None:
    n_count = 4
    counts = sample_counts(phase_estimation(0.25, n_count), shots=2048)
    best = most_likely(counts)
    # The evaluation register is written MSB-first by Qiskit.
    assert int(best, 2) == 4
    assert abs(phase_from_counts(counts, n_count) - 0.25) < 1e-12


def test_phase_estimation_three_eighths() -> None:
    n_count = 4
    counts = sample_counts(phase_estimation(0.375, n_count), shots=2048)
    assert abs(phase_from_counts(counts, n_count) - 0.375) < 1e-12


def test_teleportation_preserves_state() -> None:
    pytest.importorskip("qiskit_aer")
    from qiskit_aer import AerSimulator

    prep = QuantumCircuit(1)
    prep.ry(0.7, 0)
    qc = teleportation(prep)
    result = AerSimulator().run(qc, shots=4000, seed_simulator=11).result()
    counts = result.get_counts()

    # The teleported qubit is measured into classical bit 2, which is the
    # leftmost character of Aer's displayed bitstring.
    zero = sum(n for bits, n in counts.items() if bits[0] == "0")
    one = sum(n for bits, n in counts.items() if bits[0] == "1")
    p_zero = zero / (zero + one)
    assert abs(p_zero - math.cos(0.35) ** 2) < 0.04


def test_noisy_bell_changes_counts() -> None:
    pytest.importorskip("qiskit_aer")
    from qiskit_aer import AerSimulator

    qc, model = noisy_bell(noise_level=0.05)
    counts = AerSimulator(noise_model=model).run(qc, shots=4000, seed_simulator=5).result().get_counts()
    # Ideal Bell has only 00 and 11; depolarising noise produces other outcomes.
    assert any(bits not in {"00", "11"} for bits in counts)
    assert sum(counts.values()) == 4000


def test_phase_gate_sanity() -> None:
    qc = QuantumCircuit(1)
    qc.append(PhaseGate(math.pi / 4), [0])
    qc.h(0)
    assert isinstance(statevector(qc), Statevector)
