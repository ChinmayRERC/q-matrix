"""Q-matrix · Qiskit 1.0+ reference algorithms.

Every public function returns a :class:`~qiskit.QuantumCircuit`. Circuits that
end in measurement return counts through :func:`sample_counts`; unitary-only
circuits can be inspected with :func:`statevector`.

Conventions follow Qiskit: qubit 0 is the least-significant bit, and measurement
strings are displayed most-significant bit first.
"""

from __future__ import annotations

import math

from qiskit import QuantumCircuit
from qiskit.circuit import Gate
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import Statevector

__all__ = [
    "bell_circuit",
    "ghz_circuit",
    "deutsch_jozsa",
    "bernstein_vazirani",
    "grover",
    "qft",
    "phase_estimation",
    "teleportation",
    "noisy_bell",
    "sample_counts",
    "statevector",
]


# ---------------------------------------------------------------------------
# State preparation
# ---------------------------------------------------------------------------


def bell_circuit(measure: bool = False) -> QuantumCircuit:
    """Create a Bell pair ``(|00⟩ + |11⟩) / sqrt(2)``.

    Args:
        measure: Add a measurement of both qubits in the ``meas`` register.
    """

    qc = QuantumCircuit(2, 2 if measure else 0, name="bell")
    qc.h(0)
    qc.cx(0, 1)
    if measure:
        qc.measure([0, 1], [0, 1])
    return qc


def ghz_circuit(n: int = 3, measure: bool = False) -> QuantumCircuit:
    """Create an ``n``-qubit GHZ state ``(|0…0⟩ + |1…1⟩) / sqrt(2)``."""

    if n < 2:
        raise ValueError("GHZ needs at least 2 qubits")
    qc = QuantumCircuit(n, n if measure else 0, name=f"ghz-{n}")
    qc.h(0)
    for target in range(1, n):
        qc.cx(0, target)
    if measure:
        qc.measure(range(n), range(n))
    return qc


# ---------------------------------------------------------------------------
# Oracles and query algorithms
# ---------------------------------------------------------------------------


def deutsch_jozsa(n: int, constant: bool = True, measure: bool = True) -> QuantumCircuit:
    """Deutsch–Jozsa for an ``n``-bit Boolean function.

    ``constant=True`` implements ``f(x)=0``. ``constant=False`` implements the
    balanced parity function ``f(x)=x_0 xor x_1 xor … xor x_{n-1}`` using CNOTs
    into the ancilla. The ancilla is qubit ``n``.

    The measurement register contains only the input qubits: all zeros for a
    constant function, and at least one 1 for a balanced function.
    """

    if n < 1:
        raise ValueError("need at least one input qubit")
    qc = QuantumCircuit(n + 1, n, name="deutsch-jozsa")
    qc.x(n)  # |−⟩ ancilla
    qc.h(range(n + 1))
    if not constant:
        for control in range(n):
            qc.cx(control, n)
    qc.h(range(n))
    if measure:
        qc.measure(range(n), range(n))
    return qc


def bernstein_vazirani(secret: str, measure: bool = True) -> QuantumCircuit:
    """Recover the hidden bitstring ``secret`` with one oracle query.

    ``secret`` is written in display order, so ``"101"`` means the function is
    ``f(x) = x_0 xor x_2``. The returned measurement string equals ``secret``.
    """

    if not secret or set(secret) - {"0", "1"}:
        raise ValueError("secret must be a non-empty binary string")
    n = len(secret)
    qc = QuantumCircuit(n + 1, n, name="bernstein-vazirani")
    qc.x(n)
    qc.h(range(n + 1))
    # secret[0] is the most-significant displayed bit, which is qubit n-1.
    for i, bit in enumerate(reversed(secret)):
        if bit == "1":
            qc.cx(i, n)
    qc.h(range(n))
    if measure:
        qc.measure(range(n), range(n))
    return qc


def _phase_flip(qc: QuantumCircuit, target: int, n: int) -> None:
    """Apply a phase flip to the computational basis state ``target``."""

    for qubit in range(n):
        if not (target >> qubit) & 1:
            qc.x(qubit)
    qc.h(n - 1)
    qc.mcx(list(range(n - 1)), n - 1)
    qc.h(n - 1)
    for qubit in range(n):
        if not (target >> qubit) & 1:
            qc.x(qubit)


def _diffusion(qc: QuantumCircuit, n: int) -> None:
    """Inversion about the mean for ``n`` qubits."""

    qc.h(range(n))
    qc.x(range(n))
    qc.h(n - 1)
    qc.mcx(list(range(n - 1)), n - 1)
    qc.h(n - 1)
    qc.x(range(n))
    qc.h(range(n))


def grover(n: int, target: int, iterations: int | None = None, measure: bool = True) -> QuantumCircuit:
    """Grover search over ``n`` qubits for the basis state ``target``.

    ``target`` is an integer in Qiskit's little-endian convention: ``target=5``
    means the displayed state ``|101⟩``. With ``iterations=None`` the optimal
    ``floor(pi/4 * sqrt(2**n))`` (at least one) is used.
    """

    if n < 2:
        raise ValueError("use at least 2 qubits for the multi-controlled Grover demo")
    if not 0 <= target < 2**n:
        raise ValueError("target must fit in n qubits")
    if iterations is None:
        iterations = max(1, math.floor(math.pi / 4 * math.sqrt(2**n)))
    if iterations < 1:
        raise ValueError("iterations must be positive")

    qc = QuantumCircuit(n, n if measure else 0, name="grover")
    qc.h(range(n))
    for _ in range(iterations):
        _phase_flip(qc, target, n)
        _diffusion(qc, n)
    if measure:
        qc.measure(range(n), range(n))
    return qc


# ---------------------------------------------------------------------------
# Fourier and phase estimation
# ---------------------------------------------------------------------------


def qft(n: int, inverse: bool = False, do_swaps: bool = True) -> QuantumCircuit:
    """Quantum Fourier Transform on ``n`` qubits.

    The forward transform is ``H`` and controlled-phase rotations followed by
    the standard bit-reversal swaps. ``inverse=True`` returns the exact inverse
    unitary, which makes ``qft(n).compose(qft(n, inverse=True))`` the identity.
    """

    if n < 1:
        raise ValueError("QFT needs at least one qubit")
    qc = QuantumCircuit(n, name="iqft" if inverse else "qft")
    # In Qiskit's little-endian ordering the bit-reversal swaps belong at the
    # start of the ladder, which makes this circuit's unitary exactly equal to
    # QFTGate (verified against Operator(QFTGate(n)) for n = 2..6).
    if do_swaps:
        for i in range(n // 2):
            qc.swap(i, n - 1 - i)
    for j in range(n):
        qc.h(j)
        for k in range(j + 1, n):
            qc.cp(math.pi / (2 ** (k - j)), k, j)
    return qc.inverse() if inverse else qc


def phase_estimation(phase: float, n_count: int = 4, measure: bool = True) -> QuantumCircuit:
    """Estimate the eigenphase of ``PhaseGate(2*pi*phase)``.

    ``phase`` is in turns, so ``0.25`` is a quarter turn. The target qubit is
    prepared in ``|1⟩`` (an eigenstate of the phase gate) and the ``n_count``
    evaluation qubits hold the binary estimate. Resolve the result with
    :func:`phase_from_counts`.
    """

    if not 0 <= phase < 1:
        raise ValueError("phase must be in [0, 1)")
    if n_count < 2:
        raise ValueError("use at least 2 counting qubits")

    # Evaluation qubits q[0:n_count], target q[n_count].
    qc = QuantumCircuit(n_count + 1, n_count, name="phase-estimation")
    qc.x(n_count)  # |1> is the +1 eigenstate of the phase gate family
    qc.h(range(n_count))

    # Controlled-U^(2^j): a controlled phase on the |1> target.
    for j in range(n_count):
        qc.cp(2 * math.pi * phase * (2**j), j, n_count)

    # Inverse QFT on the evaluation register.
    qc.compose(qft(n_count, inverse=True), qubits=range(n_count), inplace=True)

    if measure:
        qc.measure(range(n_count), range(n_count))
    return qc


def phase_from_counts(counts: dict[str, int], n_count: int) -> float:
    """Return the most likely eigenphase (in turns) from phase-estimation counts.

    Qiskit writes measurement strings most-significant bit first, so ``"0100"``
    with four counting qubits is the integer 4 and an estimated phase of 0.25.
    """

    if not counts:
        raise ValueError("counts is empty")
    best = max(counts, key=counts.get)
    value = int(best, 2)
    return value / (2**n_count)


# ---------------------------------------------------------------------------
# Teleportation and noise
# ---------------------------------------------------------------------------


def teleportation(state_prep: QuantumCircuit | Gate | None = None) -> QuantumCircuit:
    """Teleport an unknown one-qubit state from qubit 0 to qubit 2.

    The protocol uses a Bell pair on qubits 1–2, a Bell measurement on qubits
    0–1, and classical feed-forward with ``if_test``. The final qubit is measured
    into classical bit 2 so the result can be checked with Aer.
    """

    qc = QuantumCircuit(3, 3, name="teleportation")
    if state_prep is not None:
        if isinstance(state_prep, QuantumCircuit):
            if state_prep.num_qubits != 1:
                raise ValueError("state_prep must act on one qubit")
            qc.compose(state_prep, [0], inplace=True)
        else:
            qc.append(state_prep, [0])

    # Shared Bell pair.
    qc.h(1)
    qc.cx(1, 2)

    # Bell measurement on the message and Alice's half of the pair.
    qc.cx(0, 1)
    qc.h(0)
    qc.measure(0, 0)
    qc.measure(1, 1)

    # Bob's corrections. The classical register is named "c" so the bit order
    # is explicit: c[0] is the X correction, c[1] is the Z correction.
    with qc.if_test((qc.cregs[0][1], 1)):
        qc.x(2)
    with qc.if_test((qc.cregs[0][0], 1)):
        qc.z(2)

    qc.measure(2, 2)
    return qc


def noisy_bell(noise_level: float = 0.02, measure: bool = True) -> tuple[QuantumCircuit, object]:
    """Return a Bell circuit plus an Aer depolarising noise model.

    The model applies one-qubit depolarising noise to ``h`` and two-qubit noise
    to ``cx``. Importing Aer is deferred so the pure-state algorithms work
    without the optional dependency.
    """

    if not 0 <= noise_level < 1:
        raise ValueError("noise_level must be in [0, 1)")
    from qiskit_aer.noise import NoiseModel, depolarizing_error

    qc = bell_circuit(measure=measure)
    model = NoiseModel()
    model.add_all_qubit_quantum_error(depolarizing_error(noise_level, 1), ["h", "x", "rz", "ry"])
    model.add_all_qubit_quantum_error(depolarizing_error(noise_level, 2), ["cx"])
    return qc, model


# ---------------------------------------------------------------------------
# Sampling and inspection helpers
# ---------------------------------------------------------------------------


def sample_counts(circuit: QuantumCircuit, shots: int = 2048, seed: int = 7) -> dict[str, int]:
    """Sample a measured circuit with Qiskit's :class:`StatevectorSampler`.

    Qiskit 1.0+ returns a ``PrimitiveResult``; for a circuit with a register
    named ``meas`` (the default from ``measure_all``/``measure``) the counts live
    in ``result[0].data.meas``.
    """

    if not circuit.cregs:
        raise ValueError("sample_counts needs a circuit with classical bits")
    sampler = StatevectorSampler(seed=seed)
    result = sampler.run([circuit], shots=shots).result()
    data = result[0].data
    # Qiskit names the data field after the classical register. Prefer "meas",
    # then fall back to the only register present.
    if hasattr(data, "meas"):
        return data.meas.get_counts()
    for name in circuit.cregs[0].name, "c", "meas":
        if hasattr(data, name):
            return getattr(data, name).get_counts()
    raise RuntimeError(f"no counts field on sampler data: {data}")


def statevector(circuit: QuantumCircuit) -> Statevector:
    """Return the statevector of a unitary circuit (measurements are removed)."""

    clean = circuit.remove_final_measurements(inplace=False)
    return Statevector.from_instruction(clean)


def _demo() -> None:
    """Print a few small results; useful as a smoke test."""

    print("Bell amplitudes:")
    print(statevector(bell_circuit()).probabilities_dict())

    print("\nGrover n=3, target=5:")
    print(sample_counts(grover(3, 5), shots=1024))

    print("\nBernstein–Vazirani secret=101:")
    print(sample_counts(bernstein_vazirani("101"), shots=1024))

    print("\nQFT n=3 on |000>:")
    print(statevector(qft(3)).probabilities_dict())


if __name__ == "__main__":  # pragma: no cover
    _demo()
