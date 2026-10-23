#!/usr/bin/env python3
"""
Independent numpy reference implementation of the quantum engine.

Used as an oracle to validate the TypeScript simulator, and to search for the
correct gate sequences of the W-state and Grover templates.
"""
import numpy as np

H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
S = np.array([[1, 0], [0, 1j]], dtype=complex)
T = np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex)


def rx(t):
    return np.array([[np.cos(t / 2), -1j * np.sin(t / 2)], [-1j * np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def ry(t):
    return np.array([[np.cos(t / 2), -np.sin(t / 2)], [np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def rz(t):
    return np.array([[np.exp(-1j * t / 2), 0], [0, np.exp(1j * t / 2)]], dtype=complex)


SINGLE = {"H": H, "X": X, "Y": Y, "Z": Z, "S": S, "T": T}
TWO = {
    "CZ": lambda: np.diag([1, 1, 1, -1]).astype(complex),
    "SWAP": lambda: np.array(
        [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], dtype=complex
    ),
}


def run(gates, n, shots=100000, seed=7):
    """gates: list of (kind, [qubits], params). Little-endian: q0 is the LSB."""
    dim = 2**n
    state = np.zeros(dim, dtype=complex)
    state[0] = 1
    rng = np.random.default_rng(seed)

    for kind, qubits, params in gates:
        if kind == "CNOT":
            c, t = qubits
            new = np.zeros(dim, dtype=complex)
            for i in range(dim):
                if (i >> c) & 1:
                    new[i ^ (1 << t)] = state[i]
                else:
                    new[i] = state[i]
            state = new
        elif kind in ("CZ", "SWAP"):
            m = TWO[kind]()
            q1, q2 = qubits
            new = np.zeros(dim, dtype=complex)
            for i in range(dim):
                if ((i >> q1) & 1) or ((i >> q2) & 1):
                    continue
                idx = [i, i | (1 << q2), i | (1 << q1), i | (1 << q1) | (1 << q2)]
                old = [state[j] for j in idx]
                for l in range(4):
                    new[idx[l]] = sum(m.flat[l * 4 + k] * old[k] for k in range(4))
            state = new
        elif kind in ("RX", "RY", "RZ"):
            m = {"RX": rx, "RY": ry, "RZ": rz}[kind](params[0])
            q = qubits[0]
            new = np.zeros(dim, dtype=complex)
            for i in range(dim):
                if ((i >> q) & 1) == 0:
                    j = i | (1 << q)
                    new[i] = m[0, 0] * state[i] + m[0, 1] * state[j]
                    new[j] = m[1, 0] * state[i] + m[1, 1] * state[j]
            state = new
        else:
            m = SINGLE[kind]
            q = qubits[0]
            new = np.zeros(dim, dtype=complex)
            for i in range(dim):
                if ((i >> q) & 1) == 0:
                    j = i | (1 << q)
                    new[i] = m[0, 0] * state[i] + m[0, 1] * state[j]
                    new[j] = m[1, 0] * state[i] + m[1, 1] * state[j]
            state = new

    probs = np.abs(state) ** 2
    return state, probs


def show(label, gates, n):
    state, probs = run(gates, n)
    live = [(i, p) for i, p in enumerate(probs) if p > 1e-6]
    print(f"{label:34s}", " ".join(f"|{i:03b}⟩:{p:.4f}" for i, p in live))
    return probs


print("=== W state candidates ===")
show("cx-chain", [("X", [2], []), ("CNOT", [2, 1], []), ("CNOT", [1, 0], [])], 3)
show(
    "standard W",
    [
        ("X", [2], []),
        ("CNOT", [2, 1], []),
        ("RY", [1], [-np.pi / 3]),
        ("CNOT", [1, 0], []),
        ("RY", [0], [-np.pi / 3]),
        ("CNOT", [0, 1], []),
    ],
    3,
)
show(
    "W v2",
    [
        ("X", [2], []),
        ("CNOT", [2, 1], []),
        ("RY", [1], [-np.pi / 3]),
        ("CNOT", [1, 0], []),
        ("RY", [0], [-np.pi / 3]),
        ("CNOT", [0, 1], []),
    ],
    3,
)
show(
    "W v3 (ry on 1 then cx 1->0, ry 0, cx 0->1)",
    [
        ("X", [2], []),
        ("CNOT", [2, 1], []),
        ("RY", [1], [2 * np.pi / 3]),
        ("CNOT", [1, 0], []),
        ("RY", [0], [2 * np.pi / 3]),
        ("CNOT", [0, 1], []),
    ],
    3,
)

print("\n=== Grover candidates (target |11>, N=4) ===")
H0 = ("H", [0], [])
H1 = ("H", [1], [])
X0 = ("X", [0], [])
X1 = ("X", [1], [])
CZ = ("CZ", [0, 1], [])

show("A: H H CZ H X H X H", [H0, H1, CZ, H0, H1, X0, X1, H0, H1, X0, X1, H0, H1], 2)
show("B: H H CZ H X H X H X H", [H0, H1, CZ, H0, H1, X0, X1, H0, H1, X0, X1, H0, H1, X0, X1], 2)
show("C: H H CZ H H X X H H", [H0, H1, CZ, H0, H1, X0, X1, H0, H1], 2)
show("D: H H CZ X X H H", [H0, H1, CZ, X0, X1, H0, H1], 2)
show("E: H H CZ H X H", [H0, H1, CZ, H0, X0, X1, H0], 2)

print("\n=== Deutsch-Jozsa (oracle = CNOT(0,1), f(x)=x0, balanced) ===")
show("DJ ancilla |->", [("X", [1], []), ("H", [0], []), ("H", [1], []), ("CNOT", [0, 1], []), ("H", [0], [])], 2)
show("DJ ancilla |+>", [("H", [0], []), ("H", [1], []), ("CNOT", [0, 1], []), ("H", [0], [])], 2)

print("\n=== Bernstein-Vazirani (hidden string 1) ===")
show("BV", [("X", [1], []), ("H", [0], []), ("H", [1], []), ("CNOT", [0, 1], []), ("H", [0], [])], 2)
show("BV v2 (H ancilla only)", [("H", [0], []), ("H", [1], []), ("CNOT", [0, 1], []), ("H", [0], [])], 2)

print("\n=== Teleportation (with conditional corrections) ===")
tele = [
    ("RY", [0], [np.pi / 4]),
    ("H", [1], []),
    ("CNOT", [1, 2], []),
    ("CNOT", [0, 1], []),
    ("H", [0], []),
]
state, probs = run(tele, 3)
print("pre-measure state:", np.round(probs, 4))

print("\n=== QFT on 3 qubits ===")
show(
    "QFT",
    [
        ("H", [0], []),
        ("RZ", [1], [np.pi / 2]),
        ("CZ", [0, 1], []),
        ("H", [1], []),
        ("RZ", [2], [np.pi / 4]),
        ("CZ", [0, 2], []),
        ("CZ", [1, 2], []),
        ("H", [2], []),
        ("SWAP", [0, 2], []),
    ],
    3,
)
