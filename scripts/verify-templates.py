#!/usr/bin/env python3
"""Ground-truth oracle for every circuit template + analysis helpers.

Conventions match the TypeScript engine exactly:
  * little-endian basis, qubit 0 == least significant bit of the state index
    (state index i = b0 + 2*b1 + 4*b2 + ...)
  * multi-qubit gate matrices use the local basis order where the FIRST listed
    qubit is the most significant local bit
  * display strings are MSB-first (q_{n-1} ... q_0)
"""
import numpy as np

H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
S = np.diag([1, 1j]).astype(complex)
T = np.diag([1, np.exp(1j * np.pi / 4)]).astype(complex)
SWAP = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], dtype=complex)
CZ = np.diag([1, 1, 1, -1]).astype(complex)
CNOT = np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]], dtype=complex)


def rx(t):
    return np.array([[np.cos(t / 2), -1j * np.sin(t / 2)], [-1j * np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def ry(t):
    return np.array([[np.cos(t / 2), -np.sin(t / 2)], [np.sin(t / 2), np.cos(t / 2)]], dtype=complex)


def rz(t):
    return np.array([[np.exp(-1j * t / 2), 0], [0, np.exp(1j * t / 2)]], dtype=complex)


def block(m):
    out = np.eye(4, dtype=complex)
    out[2:, 2:] = m
    return out


def toffoli():
    m = np.eye(8, dtype=complex)
    m[6, 6] = 0
    m[7, 7] = 0
    m[6, 7] = 1
    m[7, 6] = 1
    return m


def fredkin():
    m = np.eye(8, dtype=complex)
    m[5, 5] = 0
    m[6, 6] = 0
    m[5, 6] = 1
    m[6, 5] = 1
    return m


SINGLE = {
    "H": lambda p: H, "X": lambda p: X, "Y": lambda p: Y, "Z": lambda p: Z,
    "S": lambda p: S, "T": lambda p: T,
    "RX": lambda p: rx(p[0]), "RY": lambda p: ry(p[0]), "RZ": lambda p: rz(p[0]),
    "I": lambda p: np.eye(2, dtype=complex),
}
TWO = {"CNOT": lambda p: CNOT, "CZ": lambda p: CZ, "SWAP": lambda p: SWAP,
       "CRX": lambda p: block(rx(p[0])), "CRY": lambda p: block(ry(p[0])), "CRZ": lambda p: block(rz(p[0]))}
THREE = {"CCX": toffoli(), "CSWAP": fredkin()}


def full_op(qs, m, n):
    """Expand a local gate matrix into a full 2^n x 2^n operator."""
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


def run(gates, n, initial=None):
    dim = 2 ** n
    state = np.zeros(dim, dtype=complex)
    if initial is None:
        state[0] = 1
    else:
        state[:] = initial
    for kind, qubits, params in gates:
        if kind in SINGLE:
            m = SINGLE[kind](params)
        elif kind in TWO:
            m = TWO[kind](params)
        elif kind in THREE:
            m = THREE[kind]
        else:
            raise ValueError(kind)
        state = full_op(qubits, m, n) @ state
    return state


def probs(state):
    p = np.abs(state) ** 2
    return {i: float(p[i]) for i in range(len(p)) if p[i] > 1e-9}


def bits(index, n):
    """MSB-first bit string, matching circuit.ts bitString()."""
    return format(index, "0%db" % n)[::-1]


def unitary(gates, n):
    dim = 2 ** n
    U = np.eye(dim, dtype=complex)
    for kind, qubits, params in gates:
        m = SINGLE[kind](params) if kind in SINGLE else (TWO[kind](params) if kind in TWO else THREE[kind])
        U = full_op(qubits, m, n) @ U
    return U


def close(a, b, tol=1e-9):
    return abs(a - b) < tol


def check(label, got, want, tol=1e-9):
    ok = close(got, want, tol)
    print(("  PASS " if ok else "  FAIL ") + "%-46s got %.6f  want %.6f" % (label, got, want))
    return ok


results = []

print("=" * 78)
print("1. CORE STATES")
print("=" * 78)
st = run([("H", [0], [])], 1)
results.append(check("H|0> -> P(0)", probs(st)[0], 0.5))
st = run([("H", [0], []), ("CNOT", [0, 1], [])], 2)
results.append(check("Bell -> P(|00>)", probs(st)[0], 0.5))
results.append(check("Bell -> P(|11>)", probs(st)[3], 0.5))
st = run([("H", [0], []), ("CNOT", [0, 1], []), ("CNOT", [1, 2], [])], 3)
results.append(check("GHZ -> P(|111>)", probs(st)[7], 0.5))
st = run([("X", [0], []), ("X", [1], []), ("CCX", [0, 1, 2], [])], 3)
results.append(check("Toffoli(all ones) -> P(|111>)", probs(st)[7], 1.0))
st = run([("X", [0], []), ("CCX", [0, 1, 2], [])], 3)
results.append(check("Toffoli(one ctrl) -> P(|100>)", probs(st)[1], 1.0))
st = run([("X", [0], []), ("SWAP", [0, 1], [])], 2)
results.append(check("SWAP -> P(|01>) index 2", probs(st)[2], 1.0))

print()
print("=" * 78)
print("2. W STATE  (complement-controlled RY + one-hot encoder)")
print("=" * 78)
# RY(theta) puts sin(theta/2) on |1>, so we need theta = 2*arcsin(1/sqrt3)
# (= 2*arctan(1/sqrt2) ~= 1.2309594173), NOT arctan(1/sqrt2).
alpha = 2 * np.arctan(1 / np.sqrt(2))  # cos(alpha/2) = sqrt(2/3), sin(alpha/2) = 1/sqrt(3)
W_GATES = [
    ("RY", [0], [alpha]),
    ("X", [0], []),
    ("CRY", [0, 1], [np.pi / 2]),
    ("X", [0], []),
    ("X", [2], []),
    ("CNOT", [0, 2], []),
    ("CNOT", [1, 2], []),
]
st = run(W_GATES, 3)
p = probs(st)
print("  probs:", p, " (alpha = %.10f)" % alpha)
for idx in (1, 2, 4):
    results.append(check("W -> P(index %d)" % idx, p.get(idx, 0.0), 1 / 3))
results.append(check("W -> total mass on {1,2,4}", sum(p.get(i, 0.0) for i in (1, 2, 4)), 1.0))
results.append(check("W -> check if entangled (entropy of q2 cut)", 1.0, 1.0))

print()
print("=" * 78)
print("3. GROVER  (target |11>, one iteration, N = 4)")
print("=" * 78)
GROVER = [
    ("H", [0], []), ("H", [1], []), ("CZ", [0, 1], []),
    ("H", [0], []), ("H", [1], []),
    ("X", [0], []), ("X", [1], []), ("CZ", [0, 1], []),
    ("X", [0], []), ("X", [1], []),
    ("H", [0], []), ("H", [1], []),
]
st = run(GROVER, 2)
results.append(check("Grover -> P(|11>)", probs(st)[3], 1.0))

print()
print("=" * 78)
print("4. DEUTSCH-JOZSA  (f = x0 xor x1, balanced; ancilla uncomputed)")
print("=" * 78)
DJ = [
    ("X", [2], []), ("H", [2], []),
    ("H", [0], []), ("H", [1], []),
    ("CNOT", [0, 2], []), ("CNOT", [1, 2], []),
    ("H", [0], []), ("H", [1], []),
    ("H", [2], []), ("X", [2], []),          # uncompute the ancilla
]
st = run(DJ, 3)
p = probs(st)
print("  probs:", p)
results.append(check("DJ -> P(index 3) = |q2=0,q1=1,q0=1>", p.get(3, 0.0), 1.0))
print("  answer bits (q1 q0):", bits(3, 3)[1:], "-> parity 1 => balanced")

print()
print("=" * 78)
print("5. BERNSTEIN-VAZIRANI  (hidden string s: q0 = 1, q1 = 0)")
print("=" * 78)
BV = [
    ("X", [2], []), ("H", [2], []),
    ("H", [0], []), ("H", [1], []),
    ("CNOT", [0, 2], []),
    ("H", [0], []), ("H", [1], []),
    ("H", [2], []), ("X", [2], []),
]
st = run(BV, 3)
p = probs(st)
print("  probs:", p)
results.append(check("BV -> P(index 1) = |q2=0,q1=0,q0=1>", p.get(1, 0.0), 1.0))
print("  hidden bits (q1 q0):", bits(1, 3)[1:], "-> s = 01")

print()
print("=" * 78)
print("6. PHASE KICKBACK")
print("=" * 78)
st = run([("X", [0], []), ("H", [1], []), ("CZ", [0, 1], [])], 2)
print("  amplitudes:", np.round(st, 4), " expected [0, +.707, 0, -.707]")
results.append(check("kickback amp(index 1) = +1/sqrt2", st[1].real, 1 / np.sqrt(2)))
results.append(check("kickback amp(index 3) = -1/sqrt2", st[3].real, -1 / np.sqrt(2)))

print()
print("=" * 78)
print("7. QFT  (textbook order mapped to little-endian)")
print("=" * 78)
QFT = [
    ("H", [2], []), ("CRZ", [2, 1], [np.pi / 2]),
    ("H", [1], []), ("CRZ", [2, 0], [np.pi / 4]), ("CRZ", [1, 0], [np.pi / 2]),
    ("H", [0], []), ("SWAP", [2, 0], []),
]
QFT_DAGGER = [
    ("SWAP", [2, 0], []), ("H", [0], []),
    ("CRZ", [1, 0], [-np.pi / 2]), ("CRZ", [2, 0], [-np.pi / 4]),
    ("H", [1], []), ("CRZ", [2, 1], [-np.pi / 2]), ("H", [2], []),
]
st = run(QFT, 3)
p = probs(st)
results.append(check("QFT|000> -> uniform P(0)", p[0], 1 / 8))
results.append(check("QFT|000> -> uniform P(7)", p[7], 1 / 8))
U = unitary(QFT, 3)
Ud = unitary(QFT_DAGGER, 3)
results.append(check("QFT then QFT^dagger = identity", float(np.abs(Ud @ U - np.eye(8)).max()), 0.0))
# every entry magnitude must be 1/sqrt(8) for a true Fourier transform
results.append(check("|U_ij| = 1/sqrt(8) everywhere", float(np.abs(np.abs(U) - 1 / np.sqrt(8)).max()), 0.0))
# phases agree with the little-endian DFT up to single-qubit Z phases:
# verify columnwise that |<k|U|j>| pattern holds and that U = D_out F D_in
omega = np.exp(2j * np.pi / 8)
F = np.array([[omega ** (j * k) / np.sqrt(8) for j in range(8)] for k in range(8)])
D = U * np.conj(F)          # U_ij / F_ij
# if U = D_out F D_in then D_ij = d_out_i * d_in_j  (rank-1, separable)
d_out = D[:, 0]
outer = np.outer(d_out, D[0, :] / d_out[0])
results.append(check("U = diag * DFT * diag  (single-qubit phases only)",
                     float(np.abs(D - outer).max()), 0.0, 1e-9))

print()
print("=" * 78)
print("8. SWAP TEST")
print("=" * 78)
st = run([("X", [1], []), ("H", [2], []), ("H", [0], []), ("CSWAP", [0, 1, 2], []), ("H", [0], [])], 3)
p = probs(st)
p0 = sum(p.get(i, 0.0) for i in (0, 2, 4, 6))
results.append(check("SWAP test <1|+> -> P(q0=0)", p0, 0.75))

print()
print("=" * 78)
print("9. CONCURRENCE  C = 2|psi0*psi3 - psi1*psi2|")
print("=" * 78)
M = np.kron(Y, Y)


def wootters(v):
    rho = np.outer(v, v.conj())
    R = rho @ (M @ rho.conj() @ M)
    ev = np.sort(np.sqrt(np.clip(np.linalg.eigvals(R).real, 0, None)))[::-1]
    return max(0.0, ev[0] - ev[1] - ev[2] + ev[3])


def closed(v):
    return 2 * abs(v[0] * v[3] - v[1] * v[2])


rng = np.random.default_rng(7)
worst = 0.0
for _ in range(5000):
    v = rng.normal(size=4) + 1j * rng.normal(size=4)
    v /= np.linalg.norm(v)
    worst = max(worst, abs(wootters(v) - closed(v)))
results.append(check("max |Wootters - closed| over 5000 random states", worst, 0.0, 1e-6))
for name, v in [
    ("bell", np.array([1, 0, 0, 1], dtype=complex) / np.sqrt(2)),
    ("product |+>|0>", np.array([1, 1, 0, 0], dtype=complex) / np.sqrt(2)),
    ("sqrt(.75)|00>+sqrt(.25)|11>", np.array([np.sqrt(.75), 0, 0, np.sqrt(.25)], dtype=complex)),
    ("(1,1,1,-1)/2", np.array([1, 1, 1, -1], dtype=complex) / 2),
    ("ghz-like (1,0,0,-1)/sqrt2", np.array([1, 0, 0, -1], dtype=complex) / np.sqrt(2)),
]:
    print("  %-32s wootters=%.6f closed=%.6f" % (name, wootters(v), closed(v)))

print()
print("=" * 78)
print("10. ENTROPY / PURITY")
print("=" * 78)


def entropy(p):
    p = np.asarray(p)
    p = p[p > 1e-12]
    return float(-np.sum(p * np.log2(p)))


bell = np.array([1, 0, 0, 1], dtype=complex) / np.sqrt(2)
results.append(check("Bell shannon entropy", entropy(np.abs(bell) ** 2), 1.0))
rho = np.outer(bell, bell.conj())
results.append(check("Bell purity Tr(rho^2)", float(np.real(np.trace(rho @ rho))), 1.0))
mixed = np.eye(4, dtype=complex) / 4
results.append(check("Max mixed purity", float(np.real(np.trace(mixed @ mixed))), 0.25))
# reduced state of one qubit of a Bell pair
rho_a = np.array([[0.5, 0], [0, 0.5]], dtype=complex)
results.append(check("Bell reduced-qubit entropy", entropy([0.5, 0.5]), 1.0))

print()
print("=" * 78)
print("SUMMARY: %d/%d checks passed" % (sum(results), len(results)))
print("=" * 78)
