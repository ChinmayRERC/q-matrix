/**
 * Quantum core: complex arithmetic, matrix helpers and the gate library.
 *
 * Basis convention: little-endian, qubit 0 is the least significant bit of the
 * state index (identical to Qiskit's ordering) so results can be compared
 * directly against Qiskit / Cirq references.
 */

export interface Complex {
  re: number
  im: number
}

export const C = (re: number, im = 0): Complex => ({ re, im })

export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im })
export const cmul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
})
export const cscale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k })
export const cconj = (a: Complex): Complex => ({ re: a.re, im: -a.im })
export const cabs2 = (a: Complex): number => a.re * a.re + a.im * a.im
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im)
export const cphase = (a: Complex): number => Math.atan2(a.im, a.re)

export const ZERO: Complex = { re: 0, im: 0 }
export const ONE: Complex = { re: 1, im: 0 }
export const I: Complex = { re: 0, im: 1 }

export const csqrt = (a: Complex): Complex => {
  const r = cabs(a)
  if (r === 0) return ZERO
  const re = Math.sqrt((r + a.re) / 2)
  const im = Math.sign(a.im || 1) * Math.sqrt((r - a.re) / 2)
  return { re, im }
}

export const cexp = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) })

/** Multiplication table over 2x2 / 4x4 / 8x8 dense complex matrices. */
export type Mat2 = [Complex, Complex, Complex, Complex]
export type Mat4 = Complex[]
export type Mat8 = Complex[]

/** Row-major dense matrix multiply. */
export function matmul(a: Complex[], b: Complex[], n: number): Complex[] {
  const out = new Array<Complex>(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let acc = ZERO
      for (let k = 0; k < n; k++) {
        acc = cadd(acc, cmul(a[i * n + k], b[k * n + j]))
      }
      out[i * n + j] = acc
    }
  }
  return out
}

/** Conjugate transpose. */
export function adjoint(m: Complex[], n: number): Complex[] {
  const out = new Array<Complex>(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) out[i * n + j] = cconj(m[j * n + i])
  }
  return out
}

// ---------------------------------------------------------------------------
// Gate library
// ---------------------------------------------------------------------------

export type GateKind =
  | 'H'
  | 'X'
  | 'Y'
  | 'Z'
  | 'S'
  | 'T'
  | 'Sdg'
  | 'Tdg'
  | 'RX'
  | 'RY'
  | 'RZ'
  | 'U'
  | 'CNOT'
  | 'CZ'
  | 'SWAP'
  | 'CRX'
  | 'CRY'
  | 'CRZ'
  | 'CCX'
  | 'CSWAP'
  | 'M'
  | 'BARRIER'
  | 'I'

export type GateCategory = 'basis' | 'phase' | 'rotation' | 'controlled' | 'multi' | 'measure' | 'utility'

export interface GateSpec {
  kind: GateKind
  name: string
  short: string
  category: GateCategory
  arity: number
  params: number[]
  /** CSS tone used by the palette and the composer. */
  tone: string
  blurb: string
  formula?: string
  /** Whether the gate is deterministic (no measurement randomness). */
  deterministic: boolean
}

const S = Math.sqrt(0.5)

export const GATE_LIBRARY: Record<GateKind, GateSpec> = {
  H: {
    kind: 'H',
    name: 'Hadamard',
    short: 'H',
    category: 'basis',
    arity: 1,
    params: [],
    tone: 'violet',
    blurb: 'Creates an equal superposition of |0⟩ and |1⟩.',
    formula: 'H = 1/√2 [[1,1],[1,-1]]',
    deterministic: true,
  },
  X: {
    kind: 'X',
    name: 'Pauli-X (NOT)',
    short: 'X',
    category: 'basis',
    arity: 1,
    params: [],
    tone: 'cyan',
    blurb: 'Flips |0⟩ ↔ |1⟩. The quantum NOT gate.',
    formula: 'X = [[0,1],[1,0]]',
    deterministic: true,
  },
  Y: {
    kind: 'Y',
    name: 'Pauli-Y',
    short: 'Y',
    category: 'basis',
    arity: 1,
    params: [],
    tone: 'cyan',
    blurb: 'Rotates the Bloch sphere 180° about the Y axis.',
    formula: 'Y = [[0,-i],[i,0]]',
    deterministic: true,
  },
  Z: {
    kind: 'Z',
    name: 'Pauli-Z (phase flip)',
    short: 'Z',
    category: 'basis',
    arity: 1,
    params: [],
    tone: 'cyan',
    blurb: 'Leaves |0⟩ alone and flips the sign of |1⟩.',
    formula: 'Z = [[1,0],[0,-1]]',
    deterministic: true,
  },
  S: {
    kind: 'S',
    name: 'Phase S',
    short: 'S',
    category: 'phase',
    arity: 1,
    params: [],
    tone: 'amber',
    blurb: 'Adds a quarter turn of phase to |1⟩.',
    formula: 'S = [[1,0],[0,i]]',
    deterministic: true,
  },
  T: {
    kind: 'T',
    name: 'Phase T',
    short: 'T',
    category: 'phase',
    arity: 1,
    params: [],
    tone: 'amber',
    blurb: 'Adds a π/4 phase turn. Needed for universal gate sets.',
    formula: 'T = diag(1, e^{iπ/4})',
    deterministic: true,
  },
  Sdg: {
    kind: 'Sdg',
    name: 'S dagger',
    short: 'S†',
    category: 'phase',
    arity: 1,
    params: [],
    tone: 'amber',
    blurb: 'Inverse of the S gate.',
    formula: 'S† = diag(1, -i)',
    deterministic: true,
  },
  Tdg: {
    kind: 'Tdg',
    name: 'T dagger',
    short: 'T†',
    category: 'phase',
    arity: 1,
    params: [],
    tone: 'amber',
    blurb: 'Inverse of the T gate.',
    formula: 'T† = diag(1, e^{-iπ/4})',
    deterministic: true,
  },
  RX: {
    kind: 'RX',
    name: 'Rotation X',
    short: 'RX',
    category: 'rotation',
    arity: 1,
    params: [Math.PI / 2],
    tone: 'rose',
    blurb: 'Rotates about the X axis by θ radians.',
    formula: 'RX(θ) = [[cos(θ/2), -i sin(θ/2)],[-i sin(θ/2), cos(θ/2)]]',
    deterministic: true,
  },
  RY: {
    kind: 'RY',
    name: 'Rotation Y',
    short: 'RY',
    category: 'rotation',
    arity: 1,
    params: [Math.PI / 2],
    tone: 'rose',
    blurb: 'Rotates about the Y axis by θ radians.',
    formula: 'RY(θ) = [[cos(θ/2), -sin(θ/2)],[sin(θ/2), cos(θ/2)]]',
    deterministic: true,
  },
  RZ: {
    kind: 'RZ',
    name: 'Rotation Z',
    short: 'RZ',
    category: 'rotation',
    arity: 1,
    params: [Math.PI / 2],
    tone: 'rose',
    blurb: 'Rotates about the Z axis by θ radians (adds phase).',
    formula: 'RZ(θ) = diag(e^{-iθ/2}, e^{iθ/2})',
    deterministic: true,
  },
  U: {
    kind: 'U',
    name: 'General U',
    short: 'U',
    category: 'rotation',
    arity: 1,
    params: [Math.PI / 2, 0, Math.PI / 2],
    tone: 'rose',
    blurb: 'The general single-qubit unitary U(θ, φ, λ).',
    formula: 'U(θ,φ,λ) = [[cos(θ/2), -e^{iλ}sin(θ/2)],[e^{iφ}sin(θ/2), e^{i(φ+λ})cos(θ/2)]]',
    deterministic: true,
  },
  CNOT: {
    kind: 'CNOT',
    name: 'Controlled-NOT',
    short: '⊕',
    category: 'controlled',
    arity: 2,
    params: [],
    tone: 'pink',
    blurb: 'Flips the target qubit when the control qubit is |1⟩.',
    formula: 'CNOT',
    deterministic: true,
  },
  CZ: {
    kind: 'CZ',
    name: 'Controlled-Z',
    short: 'CZ',
    category: 'controlled',
    arity: 2,
    params: [],
    tone: 'pink',
    blurb: 'Applies a phase flip to the target when the control is |1⟩.',
    formula: 'CZ',
    deterministic: true,
  },
  SWAP: {
    kind: 'SWAP',
    name: 'Swap',
    short: '⇄',
    category: 'controlled',
    arity: 2,
    params: [],
    tone: 'pink',
    blurb: 'Exchanges the states of two qubits.',
    formula: 'SWAP',
    deterministic: true,
  },
  CRX: {
    kind: 'CRX',
    name: 'Controlled RX',
    short: 'CRX',
    category: 'controlled',
    arity: 2,
    params: [Math.PI / 2],
    tone: 'pink',
    blurb: 'Applies an X rotation to the target conditioned on the control.',
    formula: 'CRX(θ)',
    deterministic: true,
  },
  CRY: {
    kind: 'CRY',
    name: 'Controlled RY',
    short: 'CRY',
    category: 'controlled',
    arity: 2,
    params: [Math.PI / 2],
    tone: 'pink',
    blurb: 'Applies a Y rotation to the target conditioned on the control.',
    formula: 'CRY(θ)',
    deterministic: true,
  },
  CRZ: {
    kind: 'CRZ',
    name: 'Controlled RZ',
    short: 'CRZ',
    category: 'controlled',
    arity: 2,
    params: [Math.PI / 2],
    tone: 'pink',
    blurb: 'Applies a Z rotation to the target conditioned on the control.',
    formula: 'CRZ(θ)',
    deterministic: true,
  },
  CCX: {
    kind: 'CCX',
    name: 'Toffoli (CCX)',
    short: 'CCX',
    category: 'multi',
    arity: 3,
    params: [],
    tone: 'lime',
    blurb: 'Flips the target only when both controls are |1⟩.',
    formula: 'CCX',
    deterministic: true,
  },
  CSWAP: {
    kind: 'CSWAP',
    name: 'Fredkin (CSWAP)',
    short: 'CSWAP',
    category: 'multi',
    arity: 3,
    params: [],
    tone: 'lime',
    blurb: 'Swaps two target qubits when the control is |1⟩.',
    formula: 'CSWAP',
    deterministic: true,
  },
  M: {
    kind: 'M',
    name: 'Measure',
    short: '⌁',
    category: 'measure',
    arity: 1,
    params: [],
    tone: 'green',
    blurb: 'Collapses the qubit to |0⟩ or |1⟩ and records a bit.',
    formula: '⟨ψ|M|ψ⟩',
    deterministic: false,
  },
  BARRIER: {
    kind: 'BARRIER',
    name: 'Barrier',
    short: '▚',
    category: 'utility',
    arity: 1,
    params: [],
    tone: 'slate',
    blurb: 'Marks a visual boundary without changing the state.',
    deterministic: true,
  },
  I: {
    kind: 'I',
    name: 'Identity',
    short: 'I',
    category: 'utility',
    arity: 1,
    params: [],
    tone: 'slate',
    blurb: 'Leaves the qubit untouched.',
    formula: 'I',
    deterministic: true,
  },
}

export const PALETTE_ORDER: GateKind[] = [
  'H',
  'X',
  'Y',
  'Z',
  'S',
  'T',
  'Sdg',
  'RX',
  'RY',
  'RZ',
  'CNOT',
  'CZ',
  'SWAP',
  'CRX',
  'CRY',
  'CRZ',
  'CCX',
  'CSWAP',
  'M',
]

// ---------------------------------------------------------------------------
// Matrix constructors
// ---------------------------------------------------------------------------

/** 2x2 matrix from four entries in row-major order. */
export const mat2 = (m00: Complex, m01: Complex, m10: Complex, m11: Complex): Mat2 => [m00, m01, m10, m11]

export const IDENTITY2: Mat2 = mat2(ONE, ZERO, ZERO, ONE)

export const PAULI_X: Mat2 = mat2(ZERO, ONE, ONE, ZERO)
export const PAULI_Y: Mat2 = mat2(ZERO, C(0, -1), C(0, 1), ZERO)
export const PAULI_Z: Mat2 = mat2(ONE, ZERO, ZERO, C(-1, 0))

export const HADAMARD: Mat2 = mat2(C(S), C(S), C(S), C(-S))

export function phaseMat(theta: number): Mat2 {
  return mat2(ONE, ZERO, ZERO, cexp(theta))
}

export function rxMat(theta: number): Mat2 {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return mat2(C(c), C(0, -s), C(0, -s), C(c))
}

export function ryMat(theta: number): Mat2 {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return mat2(C(c), C(-s), C(s), C(c))
}

export function rzMat(theta: number): Mat2 {
  return mat2(cexp(-theta / 2), ZERO, ZERO, cexp(theta / 2))
}

export function uMat(theta: number, phi: number, lambda: number): Mat2 {
  const ct = Math.cos(theta / 2)
  const st = Math.sin(theta / 2)
  return mat2(
    C(ct),
    cscale(cexp(lambda), -st),
    cscale(cexp(phi), st),
    cscale(cexp(phi + lambda), ct),
  )
}

/**
 * Build the 4x4 matrix of a controlled single-qubit gate.
 * Local basis order is (control, target) -> index = 2*b_control + b_target.
 */
export function cnotMat(): Mat4 {
  return mat2x2to4(IDENTITY2, PAULI_X)
}

export function czMat(): Mat4 {
  return mat2x2to4(IDENTITY2, phaseMat(Math.PI))
}

export function swapMat(): Mat4 {
  const m = new Array<Complex>(16).fill(ZERO)
  const perm = [0, 2, 1, 3]
  for (let i = 0; i < 4; i++) m[perm[i] * 4 + i] = ONE
  return m
}

/** Block-diagonal 4x4 from two 2x2 blocks: block0 applies when control is |0⟩, block1 when |1⟩. */
export function mat2x2to4(block0: Mat2, block1: Mat2): Mat4 {
  const m = new Array<Complex>(16).fill(ZERO)
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      m[i * 4 + j] = block0[i * 2 + j]
      m[(2 + i) * 4 + (2 + j)] = block1[i * 2 + j]
    }
  }
  return m
}

/** 8x8 Toffoli matrix (local basis order: q0, q1, q2 -> index = 4*b0 + 2*b1 + b2). */
export function toffoliMat(): Mat8 {
  const m = new Array<Complex>(64).fill(ZERO)
  for (let i = 0; i < 8; i++) m[i * 8 + i] = ONE
  // |110> <-> |111>; clear both diagonal entries the swap replaces
  m[6 * 8 + 6] = ZERO
  m[7 * 8 + 6] = ONE
  m[6 * 8 + 7] = ONE
  m[7 * 8 + 7] = ZERO
  return m
}

/** 8x8 Fredkin matrix (local basis order: control, a, b). */
export function fredkinMat(): Mat8 {
  const m = new Array<Complex>(64).fill(ZERO)
  // control=0 -> identity
  for (let i = 0; i < 4; i++) m[i * 8 + i] = ONE
  // control=1 -> swap the last two qubits (|1,0,1> <-> |1,1,0>)
  const perm = [0, 1, 2, 3, 4, 6, 5, 7]
  for (let i = 4; i < 8; i++) m[perm[i] * 8 + i] = ONE
  return m
}

/** Single-qubit matrix for a gate kind (rotation params in radians). */
export function singleQubitMatrix(kind: GateKind, params: number[]): Mat2 {
  switch (kind) {
    case 'H':
      return HADAMARD
    case 'X':
      return PAULI_X
    case 'Y':
      return PAULI_Y
    case 'Z':
      return PAULI_Z
    case 'S':
      return phaseMat(Math.PI / 2)
    case 'T':
      return phaseMat(Math.PI / 4)
    case 'Sdg':
      return phaseMat(-Math.PI / 2)
    case 'Tdg':
      return phaseMat(-Math.PI / 4)
    case 'RX':
      return rxMat(params[0] ?? 0)
    case 'RY':
      return ryMat(params[0] ?? 0)
    case 'RZ':
      return rzMat(params[0] ?? 0)
    case 'U':
      return uMat(params[0] ?? 0, params[1] ?? 0, params[2] ?? 0)
    case 'I':
    case 'BARRIER':
      return IDENTITY2
    default:
      return IDENTITY2
  }
}

/** Two-qubit matrix for a gate kind. */
export function twoQubitMatrix(kind: GateKind, params: number[]): Mat4 {
  switch (kind) {
    case 'CNOT':
      return cnotMat()
    case 'CZ':
      return czMat()
    case 'SWAP':
      return swapMat()
    case 'CRX':
      return mat2x2to4(IDENTITY2, rxMat(params[0] ?? 0))
    case 'CRY':
      return mat2x2to4(IDENTITY2, ryMat(params[0] ?? 0))
    case 'CRZ':
      return mat2x2to4(IDENTITY2, rzMat(params[0] ?? 0))
    default:
      return swapMat()
  }
}
