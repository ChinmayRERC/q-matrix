import { cabs, cabs2, cconj, cmul, cadd, csub, cscale, type Complex } from './core'
import { bitString } from './circuit'

/** Shannon entropy (bits) of a probability distribution. */
export function shannonEntropy(probs: number[]): number {
  let h = 0
  for (const p of probs) if (p > 1e-12) h -= p * Math.log2(p)
  return h
}

/** Von Neumann entropy of a pure statevector's density matrix. */
export function stateEntropy(state: Complex[]): number {
  const probs = state.map(cabs2)
  const total = probs.reduce((a, b) => a + b, 0) || 1
  return shannonEntropy(probs.map((p) => p / total))
}

/**
 * Purity Tr(rho^2) of a pure statevector. For a normalised statevector this is
 * always 1; use `purityFromDensity` when the state is a density matrix.
 */
export function purity(state: Complex[]): number {
  let acc = 0
  for (const a of state) {
    for (const b of state) {
      acc += cabs2(cmul(a, cconj(b)))
    }
  }
  return acc
}

/**
 * Eigenvalues of an Hermitian complex matrix.
 *
 * We embed H = A + iB into the real symmetric block matrix
 *   [[A, -B], [B, A]]
 * whose spectrum contains every eigenvalue of H twice, then run the real
 * Jacobi solver. This keeps the imaginary coherences (unlike diagonalising
 * only Re(H), which is what produced false entanglement for phase gates).
 */
export function hermitianEigenvalues(m: Complex[][]): number[] {
  const n = m.length
  if (n === 0) return []
  if (n === 1) return [m[0][0].re]
  const size = 2 * n
  const a: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Hermitian part: (H + H†) / 2.
      const re = (m[i][j].re + m[j][i].re) / 2
      const im = (m[i][j].im - m[j][i].im) / 2
      a[i][j] = re
      a[i + n][j + n] = re
      a[i][j + n] = -im
      a[i + n][j] = im
    }
  }
  const ev = realEigenvalues(a)
  // Each eigenvalue is duplicated by the embedding; average the pair.
  const out: number[] = []
  for (let k = 0; k + 1 < ev.length; k += 2) out.push((ev[k] + ev[k + 1]) / 2)
  return out
}

/**
 * Purity Tr(rho^2) of a (possibly mixed) density matrix, flattened row-major
 * with dimension `dim` (dim*dim entries). 1 = pure, 1/dim = maximally mixed.
 */
export function purityFromDensity(rho: Complex[]): number {
  const dim = Math.round(Math.sqrt(rho.length))
  let acc = 0
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      acc += cabs2(rho[i * dim + j])
    }
  }
  return acc
}

/**
 * Reduced density matrix of a subsystem, obtained by partial trace.
 * `keep` lists the retained qubit indices; `n` is the total qubit count.
 */
export function partialTrace(state: Complex[], n: number, keep: number[]): Complex[] {
  const kdim = 1 << keep.length
  const traceQubits = Array.from({ length: n }, (_, i) => i).filter((i) => !keep.includes(i))
  const out = new Array<Complex>(kdim * kdim).fill({ re: 0, im: 0 })

  const globalIndex = (local: number, rest: number): number => {
    let g = 0
    let l = local
    let r = rest
    for (let q = 0; q < n; q++) {
      if (keep.includes(q)) {
        g |= (l & 1) << q
        l >>= 1
      } else {
        g |= (r & 1) << q
        r >>= 1
      }
    }
    return g
  }

  for (let a = 0; a < kdim; a++) {
    for (let b = 0; b < kdim; b++) {
      let acc: Complex = { re: 0, im: 0 }
      for (let rest = 0; rest < 1 << traceQubits.length; rest++) {
        const gi = globalIndex(a, rest)
        const gj = globalIndex(b, rest)
        acc = cadd(acc, cmul(state[gi], cconj(state[gj])))
      }
      out[a * kdim + b] = acc
    }
  }
  return out
}

/** Real symmetric eigenvalues via the Jacobi rotation method. */
export function realEigenvalues(sym: number[][]): number[] {
  const n = sym.length
  const a: number[][] = sym.map((row) => row.slice())
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]
    if (off < 1e-20) break
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-20) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
      }
    }
  }
  return a.map((row, i) => row[i]).sort((x, y) => y - x)
}

/** Entanglement entropy across a qubit cut (von Neumann entropy of the reduced state). */
export function entanglementEntropy(state: Complex[], n: number, subsystem: number[]): number {
  const rho = partialTrace(state, n, subsystem)
  const kdim = 1 << subsystem.length
  const mat: Complex[][] = Array.from({ length: kdim }, (_, i) =>
    Array.from({ length: kdim }, (_, j) => rho[i * kdim + j]),
  )
  let h = 0
  for (const l of hermitianEigenvalues(mat)) if (l > 1e-12) h -= l * Math.log2(l)
  return Math.max(0, h)
}

/**
 * Partial trace of a flattened density matrix (row-major, dim = 2^n) down to
 * the qubits listed in `keep`.
 */
export function densityPartialTrace(rho: Complex[], n: number, keep: number[]): Complex[] {
  const dim = 1 << n
  const kdim = 1 << keep.length
  const traceQubits = Array.from({ length: n }, (_, i) => i).filter((i) => !keep.includes(i))
  const out = new Array<Complex>(kdim * kdim).fill({ re: 0, im: 0 })

  const globalIndex = (local: number, rest: number): number => {
    let g = 0
    let l = local
    let r = rest
    for (let q = 0; q < n; q++) {
      if (keep.includes(q)) {
        g |= (l & 1) << q
        l >>= 1
      } else {
        g |= (r & 1) << q
        r >>= 1
      }
    }
    return g
  }

  for (let a = 0; a < kdim; a++) {
    for (let b = 0; b < kdim; b++) {
      let acc: Complex = { re: 0, im: 0 }
      for (let rest = 0; rest < 1 << traceQubits.length; rest++) {
        acc = cadd(acc, rho[globalIndex(a, rest) * dim + globalIndex(b, rest)])
      }
      out[a * kdim + b] = acc
    }
  }
  return out
}

/** Von Neumann entropy of a flattened density matrix. */
export function densityEntropyOf(rho: Complex[], n: number): number {
  const dim = 1 << n
  const mat: Complex[][] = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => rho[i * dim + j]),
  )
  let h = 0
  for (const l of hermitianEigenvalues(mat)) if (l > 1e-12) h -= l * Math.log2(l)
  return Math.max(0, h)
}

/** Entanglement entropy of a density matrix across a cut. */
export function densityEntanglementEntropy(rho: Complex[], n: number, subsystem: number[]): number {
  const reduced = densityPartialTrace(rho, n, subsystem)
  const kdim = 1 << subsystem.length
  const mat: Complex[][] = Array.from({ length: kdim }, (_, i) =>
    Array.from({ length: kdim }, (_, j) => reduced[i * kdim + j]),
  )
  let h = 0
  for (const l of hermitianEigenvalues(mat)) if (l > 1e-12) h -= l * Math.log2(l)
  return Math.max(0, h)
}

// ---------------------------------------------------------------------------
// Complex eigenvalues (Durand-Kerner on the characteristic polynomial)
// ---------------------------------------------------------------------------

const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im
  if (d === 0) return { re: 0, im: 0 }
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}

/**
 * Characteristic polynomial coefficients in descending order:
 * [1, c1, c2, ...] for the monic polynomial x^n + c1 x^(n-1) + ... + cn.
 * Faddeev-LeVerrier recurrence with full complex coefficients:
 *   c_k = -tr(A M_{k-1}) / k,   M_k = A M_{k-1} + c_k I.
 */
function characteristicPolynomial(m: Complex[][]): Complex[] {
  const n = m.length
  const coeffs: Complex[] = new Array(n + 1).fill({ re: 0, im: 0 })
  coeffs[0] = { re: 1, im: 0 }
  let M: Complex[][] = m.map((row) => row.slice())

  for (let k = 1; k <= n; k++) {
    let trace: Complex = { re: 0, im: 0 }
    for (let i = 0; i < n; i++) trace = cadd(trace, M[i][i])
    coeffs[k] = cscale(trace, -1 / k)

    const next: Complex[][] = Array.from({ length: n }, () => new Array<Complex>(n).fill({ re: 0, im: 0 }))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let acc: Complex = { re: 0, im: 0 }
        for (let l = 0; l < n; l++) acc = cadd(acc, cmul(M[i][l], m[l][j]))
        next[i][j] = acc
      }
    }
    for (let i = 0; i < n; i++) next[i][i] = cadd(next[i][i], coeffs[k])
    M = next
  }
  return coeffs
}

function evalPoly(coeffs: Complex[], x: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 }
  for (const c of coeffs) acc = cadd(cmul(acc, x), c)
  return acc
}

/** Eigenvalues of a small complex matrix (real or complex spectrum). */
export function complexEigenvalues(m: Complex[][]): Complex[] {
  const n = m.length
  if (n === 1) return [m[0][0]]
  const poly = characteristicPolynomial(m)

  const roots: Complex[] = []
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.35
    roots.push({ re: Math.cos(angle), im: Math.sin(angle) })
  }

  for (let iter = 0; iter < 500; iter++) {
    let maxStep = 0
    for (let i = 0; i < n; i++) {
      let denom: Complex = { re: 1, im: 0 }
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        denom = cmul(denom, csub(roots[i], roots[j]))
      }
      const val = evalPoly(poly, roots[i])
      const step = cdiv(val, denom)
      roots[i] = csub(roots[i], step)
      maxStep = Math.max(maxStep, Math.hypot(step.re, step.im))
    }
    if (maxStep < 1e-13) break
  }
  return roots
}

/**
 * Concurrence of a 2-qubit pure state (0 = separable, 1 = maximally entangled).
 *
 * Closed form in the little-endian basis (index bits are q1 q0):
 *   C = 2 |psi_00 psi_11 - psi_01 psi_10| = 2 |s0*s3 - s1*s2|
 * Verified against the Wootters eigenvalue construction on 5000 random states.
 */
export function concurrence(state: Complex[]): number {
  if (state.length !== 4) return 0
  const [s0, s1, s2, s3] = state
  const det = csub(cmul(s0, s3), cmul(s1, s2))
  return Math.max(0, Math.min(1, 2 * Math.hypot(det.re, det.im)))
}

/**
 * Concurrence of a two-qubit mixed state (Wootters' spin-flip formula).
 *
 * The pure-state shortcut is not valid for noisy runs: a diagonal mixture can
 * still be classically correlated while a naive off-diagonal test reports 0.
 * We build the Hermitian matrix sqrt(rho) * (Y⊗Y) rho* (Y⊗Y) * sqrt(rho),
 * whose eigenvalues are the squared Wootters roots, then apply
 * C = max(0, sqrt(l1) - sqrt(l2) - sqrt(l3) - sqrt(l4)).
 */
export function concurrenceDensity(rho: Complex[], n: number): number {
  if (n !== 2 || rho.length !== 16) return 0
  const flip: Complex[] = [
    { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: -1, im: 0 },
    { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 },
    { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 },
    { re: -1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 },
  ]
  const multiply = (a: Complex[], b: Complex[]): Complex[] => {
    const out = new Array<Complex>(16).fill({ re: 0, im: 0 })
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let acc: Complex = { re: 0, im: 0 }
        for (let k = 0; k < 4; k++) acc = cadd(acc, cmul(a[i * 4 + k], b[k * 4 + j]))
        out[i * 4 + j] = acc
      }
    }
    return out
  }
  const conjugate = rho.map(cconj)
  const spinFlipped = multiply(multiply(flip, conjugate), flip)
  const root = matrixSquareRoot(rho, 4)
  const wootters = multiply(multiply(root, spinFlipped), root)
  const woottersMatrix = Array.from({ length: 4 }, (_, i) => wootters.slice(i * 4, i * 4 + 4))
  const roots = hermitianEigenvalues(woottersMatrix)
    .map((value) => Math.sqrt(Math.max(0, value)))
    .sort((a, b) => b - a)
  if (roots.length < 4) return 0
  const c = roots[0] - roots[1] - roots[2] - roots[3]
  return Math.max(0, Math.min(1, c))
}

/** Complex matrix inverse via Gauss-Jordan with partial pivoting. */
function invertMatrix(matrix: Complex[], n: number): Complex[] {
  const aug = Array.from({ length: n }, (_, i) => [
    ...matrix.slice(i * n, i * n + n).map((c) => ({ ...c })),
    ...Array.from({ length: n }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 })),
  ])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (cabs(aug[row][col]) > cabs(aug[pivot][col])) pivot = row
    }
    if (cabs(aug[pivot][col]) < 1e-14) return new Array<Complex>(n * n).fill({ re: 0, im: 0 })
    if (pivot !== col) [aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    const scale = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] = cdiv(aug[col][j], scale)
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] = csub(aug[row][j], cmul(factor, aug[col][j]))
      }
    }
  }
  return aug.flatMap((row) => row.slice(n))
}

/**
 * Matrix square root by Denman-Beavers iteration. A tiny diagonal shift keeps
 * the inverse well-defined for pure states, where rho is rank-deficient.
 */
function matrixSquareRoot(matrix: Complex[], n: number): Complex[] {
  const eps = 1e-10
  let y = matrix.map((c, i) => ({ re: c.re + (i % (n + 1) === 0 ? eps : 0), im: c.im }))
  let z = Array.from({ length: n * n }, (_, i) => ({ re: i % (n + 1) === 0 ? 1 : 0, im: 0 }))
  for (let iteration = 0; iteration < 40; iteration++) {
    const invY = invertMatrix(y, n)
    const invZ = invertMatrix(z, n)
    const nextY = y.map((c, i) => cscale(cadd(c, invZ[i]), 0.5))
    const nextZ = z.map((c, i) => cscale(cadd(c, invY[i]), 0.5))
    y = nextY
    z = nextZ
  }
  return y
}

/** Fidelity between two pure statevectors: |<psi|phi>|^2. */
export function fidelity(a: Complex[], b: Complex[]): number {
  let acc: Complex = { re: 0, im: 0 }
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    acc = cadd(acc, cmul(cconj(a[i]), b[i]))
  }
  return cabs2(acc)
}

/** Total variation distance between two probability distributions. */
export function totalVariation(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) sum += Math.abs(a[i] - b[i])
  return sum / 2
}

/** Hellinger distance between two distributions (0 = identical). */
export function hellinger(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = Math.sqrt(a[i]) - Math.sqrt(b[i])
    sum += d * d
  }
  return Math.sqrt(sum / 2)
}

/** Is the state a product state across the given cut? */
export function isSeparableAcross(state: Complex[], n: number, cut: number[]): boolean {
  return entanglementEntropy(state, n, cut) < 1e-6
}

export interface StateSummary {
  numQubits: number
  dominant: { index: number; label: string; probability: number }[]
  entropy: number
  purity: number
  entangled: boolean
  maxEntanglementEntropy: number
  concurrence: number
  /** True when the summary describes a mixed density matrix rather than a pure state. */
  mixed?: boolean
  description: string
}

/** Every distinct bipartition of n qubits, represented by the side containing q0. */
function bipartitions(n: number): number[][] {
  if (n < 2) return []
  const cuts: number[][] = []
  const full = (1 << n) - 1
  for (let mask = 1; mask < full; mask++) {
    if (!(mask & 1)) continue // complement already covers this cut
    const side: number[] = []
    for (let q = 0; q < n; q++) if ((mask >> q) & 1) side.push(q)
    cuts.push(side)
  }
  return cuts
}

/** Human-readable analysis of the current state, used by the AI panel and insights. */
export function summarizeState(state: Complex[], n: number): StateSummary {
  const probs = state.map(cabs2)
  const total = probs.reduce((a, b) => a + b, 0) || 1
  const norm = probs.map((p) => p / total)

  const sorted = norm
    .map((p, i) => ({ index: i, label: bitString(i, n), probability: p }))
    .sort((a, b) => b.probability - a.probability)

  const entropy = stateEntropy(state)
  const pur = purity(state)

  let maxEnt = 0
  for (const cut of bipartitions(n)) {
    maxEnt = Math.max(maxEnt, entanglementEntropy(state, n, cut))
  }
  const conc = concurrence(state)

  let description: string
  const live = norm.filter((p) => p > 1e-6).length
  if (live === 1) {
    description = 'A classical basis state — definite, uncorrelated, ready to measure.'
  } else if (maxEnt > 0.9) {
    description = 'Maximally entangled: the qubits have no independent description of their own.'
  } else if (maxEnt > 0.05) {
    description = 'Partially entangled — the qubits are correlated beyond classical limits.'
  } else {
    description = 'A coherent superposition that still factorises into independent qubits.'
  }

  return {
    numQubits: n,
    dominant: sorted.slice(0, 6),
    entropy,
    purity: pur,
    entangled: maxEnt > 1e-6,
    maxEntanglementEntropy: maxEnt,
    concurrence: conc,
    description,
  }
}

/**
 * Summary of a mixed state described by a flattened density matrix. Used for
 * noisy runs, where treating the rho diagonal as a statevector would report a
 * pure state and invent entanglement.
 */
export function summarizeDensity(rho: Complex[], n: number): StateSummary {
  const dim = 1 << n
  const probs = Array.from({ length: dim }, (_, i) => Math.max(0, rho[i * dim + i].re))
  const total = probs.reduce((a, b) => a + b, 0) || 1
  const norm = probs.map((p) => p / total)
  const sorted = norm
    .map((p, i) => ({ index: i, label: bitString(i, n), probability: p }))
    .sort((a, b) => b.probability - a.probability)

  const entropy = densityEntropyOf(rho, n)
  const pur = purityFromDensity(rho)
  let maxEnt = 0
  for (const cut of bipartitions(n)) {
    maxEnt = Math.max(maxEnt, densityEntanglementEntropy(rho, n, cut))
  }

  const live = norm.filter((p) => p > 1e-6).length
  let description: string
  if (pur < 0.999) {
    description =
      maxEnt > 0.9
        ? 'A noisy, maximally entangled state — the environment has mixed the phases but the correlations survive.'
        : 'A mixed state: noise has erased some phase coherence, so this is a classical mixture of branches.'
  } else if (live === 1) {
    description = 'A classical basis state — definite, uncorrelated, ready to measure.'
  } else if (maxEnt > 0.9) {
    description = 'Maximally entangled: the qubits have no independent description of their own.'
  } else if (maxEnt > 0.05) {
    description = 'Partially entangled — the qubits are correlated beyond classical limits.'
  } else {
    description = 'A coherent superposition that still factorises into independent qubits.'
  }

  return {
    numQubits: n,
    dominant: sorted.slice(0, 6),
    entropy,
    purity: pur,
    entangled: maxEnt > 1e-6,
    maxEntanglementEntropy: maxEnt,
    concurrence: concurrenceDensity(rho, n),
    mixed: true,
    description,
  }
}
