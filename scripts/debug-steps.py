#!/usr/bin/env python3
"""Step-by-step debugging of the numpy oracle against hand-computed values."""
import numpy as np
import importlib.util

spec = importlib.util.spec_from_file_location("vt", "scripts/verify-templates.py")
# Re-implement the core locally to avoid running the module's __main__ body.
H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
CNOT = np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]], dtype=complex)
CZ = np.diag([1, 1, 1, -1]).astype(complex)


def ry(t):
    return np.array([[np.cos(t / 2), -np.sin(t / 2)], [np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def rz(t):
    return np.array([[np.exp(-1j * t / 2), 0], [0, np.exp(1j * t / 2)]], dtype=complex)


def block(m):
    out = np.eye(4, dtype=complex)
    out[2:, 2:] = m
    return out


def fredkin():
    m = np.eye(8, dtype=complex)
    m[5, 5] = 0
    m[6, 6] = 0
    m[5, 6] = 1
    m[6, 5] = 1
    return m


def toffoli():
    m = np.eye(8, dtype=complex)
    m[6, 6] = 0
    m[7, 7] = 0
    m[6, 7] = 1
    m[7, 6] = 1
    return m


SINGLE = {"H": lambda p: H, "X": lambda p: X, "Z": lambda p: Z, "RY": lambda p: ry(p[0]), "RZ": lambda p: rz(p[0])}
TWO = {"CNOT": lambda p: CNOT, "CZ": lambda p: CZ,
       "CRY": lambda p: block(ry(p[0])), "CRZ": lambda p: block(rz(p[0]))}
THREE = {"CSWAP": fredkin(), "CCX": toffoli()}


def full_op(qs, m, n):
    dim = 2 ** n
    k = len(qs)
    others_mask = (~(sum(1 << q for q in qs))) & (dim - 1)
    op = np.zeros((dim, dim), dtype=complex)
    for col in range(dim):
        loc = 0
        for j, q in enumerate(qs):
            loc |= ((col >> q) & 1) << (k - 1 - j)
        for row_local in range(2 ** k):
            amp = m[row_local, loc]
            if abs(amp) < 1e-15:
                continue
            row = col & others_mask
            for j, q in enumerate(qs):
                row |= ((row_local >> (k - 1 - j)) & 1) << q
            op[row, col] += amp
    return op


def show(state, n, label):
    print("  %-28s" % label, np.round(state, 3))


print("== Deutsch-Jozsa step by step (n=3, ancilla q2) ==")
n = 3
st = np.zeros(8, dtype=complex)
st[0] = 1
show(st, n, "start |000>")
for label, qs, m in [
    ("X(q2)", [2], X),
    ("H(q2)", [2], H),
    ("H(q0)", [0], H),
    ("H(q1)", [1], H),
    ("CNOT(q0->q2)", [0, 2], CNOT),
    ("CNOT(q1->q2)", [1, 2], CNOT),
    ("H(q0)", [0], H),
    ("H(q1)", [1], H),
    ("H(q2)", [2], H),
]:
    st = full_op(qs, m, n) @ st
    show(st, n, label)

print()
print("== Bernstein-Vazirani step by step ==")
st = np.zeros(8, dtype=complex)
st[0] = 1
for label, qs, m in [
    ("X(q2)", [2], X),
    ("H(q2)", [2], H),
    ("H(q0)", [0], H),
    ("H(q1)", [1], H),
    ("CNOT(q0->q2)", [0, 2], CNOT),
    ("H(q0)", [0], H),
    ("H(q1)", [1], H),
    ("H(q2)", [2], H),
]:
    st = full_op(qs, m, n) @ st
    show(st, n, label)

print()
print("== SWAP test step by step ==")
st = np.zeros(8, dtype=complex)
st[0] = 1
for label, qs, m in [
    ("X(q1)", [1], X),
    ("H(q2)", [2], H),
    ("H(q0)", [0], H),
    ("CSWAP(q0;q1,q2)", [0, 1, 2], fredkin()),
    ("H(q0)", [0], H),
]:
    st = full_op(qs, m, n) @ st
    show(st, n, label)
print("  P(q0=0) =", round(float(np.abs(st[[0, 2, 4, 6]]) ** 2).sum(), 4), " P(q0=1) =",
      round(float(np.abs(st[[1, 3, 5, 7]]) ** 2).sum(), 4))

print()
print("== W state step by step ==")
alpha = np.arctan(1 / np.sqrt(2))
st = np.zeros(8, dtype=complex)
st[0] = 1
for label, qs, m in [
    ("RY(alpha, q0)", [0], ry(alpha)),
    ("X(q0)", [0], X),
    ("CRY(pi/2, q0->q1)", [0, 1], block(ry(np.pi / 2))),
    ("X(q0)", [0], X),
    ("X(q2)", [2], X),
    ("CNOT(q0->q2)", [0, 2], CNOT),
    ("CNOT(q1->q2)", [1, 2], CNOT),
]:
    st = full_op(qs, m, n) @ st
    show(st, n, label)
print("  probs:", {i: round(float(p), 4) for i, p in enumerate(np.abs(st) ** 2) if p > 1e-9})

print()
print("== QFT check ==")
qft = [
    ([2], H),
    ([2, 1], block(rz(np.pi / 2))),
    ([1], H),
    ([2, 0], block(rz(np.pi / 4))),
    ([1, 0], block(rz(np.pi / 2))),
    ([0], H),
    ([2, 0], np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], dtype=complex)),
]
dim = 8
U = np.zeros((dim, dim), dtype=complex)
for j in range(dim):
    col = np.zeros(dim, dtype=complex)
    col[j] = 1
    for qs, m in qft:
        col = full_op(qs, m, 3) @ col
    U[:, j] = col
omega = np.exp(2j * np.pi / dim)
rev = lambda k: int(format(k, "03b")[::-1], 2)
expected = np.array([[omega ** (rev(j) * rev(k)) / np.sqrt(dim) for j in range(dim)] for k in range(dim)])
print("  matches reversed-index DFT:", np.allclose(U, expected, atol=1e-9))
expected2 = np.array([[omega ** (j * k) / np.sqrt(dim) for j in range(dim)] for k in range(dim)])
print("  matches plain DFT        :", np.allclose(U, expected2, atol=1e-9))
print("  unitary:", np.allclose(U.conj().T @ U, np.eye(dim), atol=1e-9))
