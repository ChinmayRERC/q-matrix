#!/usr/bin/env python3
"""Ground truth for 2-qubit concurrence + verification targets for the TS engine."""
import numpy as np


def w_state_to_vector(entries):
    v = np.zeros(4, dtype=complex)
    for i, c in enumerate(entries):
        v[i] = c
    return v


def concurrence(psi):
    psi = np.asarray(psi, dtype=complex)
    rho = np.outer(psi, psi.conj())
    sy = np.array([[0, -1j], [1j, 0]])
    s = np.kron(sy, sy)
    r = rho @ (s @ rho.conj() @ s)
    lam = np.linalg.eigvals(r)
    roots = np.sort(np.sqrt(np.clip(np.abs(lam.real), 0, None)))[::-1]
    return float(max(0.0, roots[0] - roots[1] - roots[2] + roots[3]))


CASES = {
    "bell": [1 / np.sqrt(2), 0, 0, 1 / np.sqrt(2)],
    "product_hh": [0.5, 0.5, 0.5, 0.5],
    "partial_75_25": [np.sqrt(0.75), 0, 0, np.sqrt(0.25)],
    "psi_1_2_3": [1 / np.sqrt(14), 2 / np.sqrt(14), 0, 3 / np.sqrt(14)],
    "singlet": [0, 1 / np.sqrt(2), -1 / np.sqrt(2), 0],
    "plus_00_01": [1 / np.sqrt(2), 1 / np.sqrt(2), 0, 0],
    "mixed_ghz_like": [
        (1 + 0.3j) / np.sqrt(2 + 0.3**2 + 0.5),
        0,
        0,
        np.sqrt(0.5) / np.sqrt(2 + 0.3**2 + 0.5),
    ],
}

print("case            concurrence   overlap|psi psi~|   2*lam_max(T)-1")
for name, entries in CASES.items():
    v = w_state_to_vector(entries)
    c = concurrence(v)
    # candidate 1: |<psi|spinflip(psi*)>|
    sy = np.array([[0, -1j], [1j, 0]])
    s = np.kron(sy, sy)
    tilde = s @ v.conj()
    overlap = abs(np.vdot(v, tilde))
    # candidate 2: 2*lmax(T)-1 with T = [[r00+r11, -r01,10],[-r10,01, r00+r11]]
    rho = np.outer(v, v.conj())
    T = np.array(
        [
            [rho[0, 0] + rho[3, 3], -rho[1, 2]],
            [-rho[2, 1], rho[0, 0] + rho[3, 3]],
        ]
    )
    lmax = max(np.linalg.eigvalsh(T).real)
    cand2 = 2 * lmax - 1
    print(f"{name:16s} {c:12.6f} {overlap:16.6f} {cand2:12.6f}")

print("\n--- statevector probabilities (little-endian, q0=LSB) ---")
def probs_from_gates(gates, n):
    dim = 2**n
    state = np.zeros(dim, dtype=complex)
    state[0] = 1
    H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
    X = np.array([[0, 1], [1, 0]], dtype=complex)
    Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    Z = np.array([[1, 0], [0, -1]], dtype=complex)
    mats = {"H": H, "X": X, "Y": Y, "Z": Z}
    for kind, qubits in gates:
        if kind == "CNOT":
            c, t = qubits
            new = state.copy()
            for i in range(dim):
                if (i >> c) & 1:
                    j = i ^ (1 << t)
                    new[j] = state[i]
            state = new
            continue
        q = qubits[0]
        m = mats[kind]
        new = np.zeros(dim, dtype=complex)
        for i in range(dim):
            if ((i >> q) & 1) == 0:
                j = i | (1 << q)
                new[i] = m[0, 0] * state[i] + m[0, 1] * state[j]
                new[j] = m[1, 0] * state[i] + m[1, 1] * state[j]
        state = new
    return np.abs(state) ** 2

print("bell  ", np.round(probs_from_gates([("H", [0]), ("CNOT", [0, 1])], 2), 6))
print("ghz3  ", np.round(probs_from_gates([("H", [0]), ("CNOT", [0, 1]), ("CNOT", [1, 2])], 3), 6))

print("\n--- W state circuit ---")
w = probs_from_gates(
    [
        ("X", [2]),
        ("CNOT", [2, 1]),
        ("CNOT", [1, 0]),
        ("CNOT", [0, 2]),
    ],
    3,
)
print("cx-chain W:", np.round(w, 6))
