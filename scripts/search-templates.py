#!/usr/bin/env python3
"""Search for correct W-state / Grover constructions and debug the reference."""
import itertools
import numpy as np

H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)


def rx(t):
    return np.array([[np.cos(t / 2), -1j * np.sin(t / 2)], [-1j * np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def ry(t):
    return np.array([[np.cos(t / 2), -np.sin(t / 2)], [np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def rz(t):
    return np.array([[np.exp(-1j * t / 2), 0], [0, np.exp(1j * t / 2)]], dtype=complex)


def apply1(state, q, m, n):
    dim = 2**n
    new = np.zeros(dim, dtype=complex)
    for i in range(dim):
        if ((i >> q) & 1) == 0:
            j = i | (1 << q)
            new[i] = m[0, 0] * state[i] + m[0, 1] * state[j]
            new[j] = m[1, 0] * state[i] + m[1, 1] * state[j]
    return new


def apply_cx(state, c, t, n):
    dim = 2**n
    new = np.zeros(dim, dtype=complex)
    for i in range(dim):
        if (i >> c) & 1:
            new[i ^ (1 << t)] = state[i]
        else:
            new[i] = state[i]
    return new


def apply_cz(state, c, t, n):
    """Controlled-Z with little-endian bits: flips phase when both bits set."""
    dim = 2**n
    new = state.copy()
    for i in range(dim):
        if ((i >> c) & 1) and ((i >> t) & 1):
            new[i] = -new[i]
    return new


def run(gates, n):
    dim = 2**n
    state = np.zeros(dim, dtype=complex)
    state[0] = 1
    for kind, qubits, params in gates:
        if kind == "CNOT":
            state = apply_cx(state, qubits[0], qubits[1], n)
        elif kind == "CZ":
            state = apply_cz(state, qubits[0], qubits[1], n)
        elif kind == "H":
            state = apply1(state, qubits[0], H, n)
        elif kind == "X":
            state = apply1(state, qubits[0], X, n)
        elif kind == "Z":
            state = apply1(state, qubits[0], Z, n)
        elif kind == "RX":
            state = apply1(state, qubits[0], rx(params[0]), n)
        elif kind == "RY":
            state = apply1(state, qubits[0], ry(params[0]), n)
        elif kind == "RZ":
            state = apply1(state, qubits[0], rz(params[0]), n)
    return state, np.abs(state) ** 2


def live(probs):
    return {i: round(float(p), 4) for i, p in enumerate(probs) if p > 1e-6}


print("=== reference sanity ===")
st, pr = run([("H", [0], []), ("H", [1], []), ("CZ", [0, 1], [])], 2)
print("H H CZ amplitudes:", np.round(st, 4))
st, pr = run([("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("H", [1], [])], 2)
print("H H CZ H H amplitudes:", np.round(st, 4))

print("\n=== W-state search ===")
best = None
for t1 in np.linspace(-np.pi, np.pi, 25):
    for t2 in np.linspace(-np.pi, np.pi, 25):
        for order in ["a", "b"]:
            if order == "a":
                gates = [
                    ("X", [2], []),
                    ("CNOT", [2, 1], []),
                    ("RY", [1], [t1]),
                    ("CNOT", [1, 0], []),
                    ("RY", [0], [t2]),
                    ("CNOT", [0, 1], []),
                ]
            else:
                gates = [
                    ("X", [2], []),
                    ("CNOT", [2, 1], []),
                    ("RY", [1], [t1]),
                    ("CNOT", [1, 0], []),
                    ("RY", [0], [t2]),
                ]
            _, pr = run(gates, 3)
            want = {1: 1 / 3, 2: 1 / 3, 4: 1 / 3}
            err = sum((pr[i] - v) ** 2 for i, v in want.items()) + sum(pr[i] ** 2 for i in range(8) if i not in want)
            if best is None or err < best[0]:
                best = (err, t1, t2, order, gates, live(pr))
print("best W:", best[0], "t1=%.4f t2=%.4f order=%s" % (best[1], best[2], best[3]))
print("   gates:", [(g[0], g[1], [round(p, 4) for p in g[2]]) for g in best[4]])
print("   probs:", best[5])

print("\n=== Grover search (target |11>, N=4) ===")
cands = {
    "H H CZ H X H X H X H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("X", [0], []),
                              ("H", [1], []), ("X", [0], []), ("H", [1], []), ("X", [0], []), ("H", [1], [])],
    "H H CZ H H X X H H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("H", [1], []),
                           ("X", [0], []), ("X", [1], []), ("H", [0], []), ("H", [1], [])],
    "H H CZ H X H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("X", [0], []),
                     ("H", [1], [])],
    "H H CZ H H X X H H X X H H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("H", [1], []),
                                   ("X", [0], []), ("X", [1], []), ("H", [0], []), ("H", [1], []), ("X", [0], []),
                                   ("X", [1], []), ("H", [0], []), ("H", [1], [])],
    "H H CZ X X H H X X H H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("X", [0], []), ("X", [1], []),
                               ("H", [0], []), ("H", [1], []), ("X", [0], []), ("X", [1], []), ("H", [0], []), ("H", [1], [])],
    "H H CZ H X H X H": [("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []), ("H", [0], []), ("X", [0], []),
                         ("H", [1], []), ("X", [0], []), ("H", [1], [])],
}
for name, gates in cands.items():
    _, pr = run(gates, 2)
    print(f"{name:34s}", live(pr))

print("\n=== Deutsch-Jozsa / Bernstein-Vazirani with 2 input qubits ===")
# DJ: balanced oracle f(x)=x0 XOR x1 ; ancilla q2
dj = [
    ("X", [2], []),
    ("H", [0], []),
    ("H", [1], []),
    ("H", [2], []),
    ("CNOT", [0, 2], []),
    ("CNOT", [1, 2], []),
    ("H", [0], []),
    ("H", [1], []),
]
_, pr = run(dj, 3)
print("DJ balanced (2 input bits):", live(pr))

# BV: hidden string s = 10 ; ancilla q2 ; oracle flips ancilla iff x0 = 1
bv = [
    ("X", [2], []),
    ("H", [0], []),
    ("H", [1], []),
    ("H", [2], []),
    ("CNOT", [0, 2], []),
    ("H", [0], []),
    ("H", [1], []),
]
_, pr = run(bv, 3)
print("BV hidden=10:", live(pr))
