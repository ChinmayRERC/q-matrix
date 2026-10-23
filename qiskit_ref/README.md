# Q-matrix — Qiskit 1.0+ reference algorithms

Standalone, runnable implementations of the circuits used in the Q-matrix
curriculum. They target **Qiskit SDK 1.0+** and are tested against Qiskit
**2.5.2** with `StatevectorSampler` and the modern primitives API.

The web app has its own TypeScript statevector engine. This folder is the
independent Python reference used for teaching, cross-checking and take-home
experiments.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r qiskit_ref/requirements.txt
```

## Run the tests

From the repository root:

```bash
python -m pytest qiskit_ref -q
```

## Run the demo

```bash
python -m qiskit_ref.algorithms
```

## What is covered

| Function | Algorithm | What the tests check |
| --- | --- | --- |
| `bell_circuit()` | Bell pair | Amplitudes at `|00⟩` and `|11⟩` |
| `ghz_circuit(n)` | GHZ state | Only `|0…0⟩` and `|1…1⟩` |
| `deutsch_jozsa(n, constant)` | Deutsch–Jozsa | Constant → all zeros; balanced → never all zeros |
| `bernstein_vazirani(secret)` | Bernstein–Vazirani | Recovers the secret string |
| `grover(n, target)` | Grover search | Target is the most likely measurement |
| `qft(n, inverse)` | Quantum Fourier Transform | Uniform superposition; exact round-trip |
| `phase_estimation(phase, n)` | Quantum phase estimation | Estimates the eigenphase |
| `teleportation(state_prep)` | Teleportation with `if_test` | Final qubit matches the prepared state |
| `noisy_bell(noise_level)` | Noise-aware Bell experiment | Depolarising noise changes the counts |

## Conventions

- **Little-endian, Qiskit default.** Qubit 0 is the least-significant bit of a
  statevector index. `|10⟩` means qubit 1 is 1 and qubit 0 is 0.
- Measurement strings are written most-significant bit first, so a count of
  `"101"` has classical bit 2 = 1, bit 1 = 0, bit 0 = 1.
- `qft()` is an exact DFT: its unitary matches Qiskit's `QFTGate` (the
  bit-reversal swaps are placed before the H + controlled-phase ladder to match
  Qiskit's little-endian matrix). The inverse is an exact unitary inverse.
- Phase estimation uses one target qubit and `n_count` evaluation qubits. The
  target is prepared in `|1⟩`, the eigenstate of the phase gate, and the
  reported integer is the most likely bitstring of the evaluation register.

## Why not use `qiskit_algorithms`?

These are deliberately small, dependency-light teaching implementations. You
can read every gate. For production experiments, use Qiskit's built-in
`GroverOperator`, `PhaseEstimation`, `QFTGate` and the primitives in
`qiskit.primitives`.
