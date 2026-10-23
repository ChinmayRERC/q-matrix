import {
  C,
  I as CI,
  ONE,
  ZERO,
  cabs2,
  cadd,
  cconj,
  cmul,
  cscale,
  type Complex,
  type Mat4,
  type Mat8,
  singleQubitMatrix,
  toffoliMat,
  fredkinMat,
  twoQubitMatrix,
} from './core'
import { bitString, gatesInColumn, type Circuit, type Gate } from './circuit'
import { hermitianEigenvalues } from './analysis'

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so runs are reproducible and testable.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface NoiseConfig {
  /** Depolarising channel strength after each gate (0 = ideal). */
  depolarizing: number
  /** Amplitude damping probability per gate (0 = ideal). */
  amplitudeDamping: number
  /** Probability of flipping a measured bit (readout error). */
  readoutError: number
}

export const NOISE_PRESETS: Record<string, NoiseConfig> = {
  ideal: { depolarizing: 0, amplitudeDamping: 0, readoutError: 0 },
  light: { depolarizing: 0.005, amplitudeDamping: 0.002, readoutError: 0.004 },
  moderate: { depolarizing: 0.02, amplitudeDamping: 0.01, readoutError: 0.012 },
  heavy: { depolarizing: 0.06, amplitudeDamping: 0.03, readoutError: 0.03 },
}

export const isNoisy = (n?: NoiseConfig): boolean =>
  !!n && (n.depolarizing > 0 || n.amplitudeDamping > 0 || n.readoutError > 0)

export interface SimOptions {
  numQubits?: number
  shots?: number
  seed?: number
  /** Collapse the state at each measurement gate instead of measuring at the end. */
  collapseOnMeasure?: boolean
  noise?: NoiseConfig
}

export interface StepSnapshot {
  index: number
  column: number
  gateId: string
  kind: Gate['kind']
  label: string
  state: Complex[]
  probabilities: number[]
  /** Measured outcome for this step, when the gate was a measurement. */
  bit?: number
  /** True when a classical condition prevented this gate from being applied. */
  skipped?: boolean
}

export interface SimResult {
  numQubits: number
  state: Complex[]
  probabilities: number[]
  counts: Record<string, number>
  shots: number
  steps: StepSnapshot[]
  /** Classical bits recorded by measurement gates, keyed by qubit index. */
  measuredBits: Record<number, number>
  /** True when the run used a noisy (density-matrix) simulation. */
  noisy: boolean
  /** Density matrix (row-major, dim*dim) when the run was noisy. */
  rho?: Complex[]
  /** Tr(rho^2): 1 for an ideal pure state, < 1 once noise has mixed it. */
  purity: number
  durationMs: number
}

// ---------------------------------------------------------------------------
// Statevector gate application
// ---------------------------------------------------------------------------

function applySingle(state: Complex[], dim: number, q: number, m: Complex[]): void {
  const bit = 1 << q
  for (let i = 0; i < dim; i++) {
    if ((i & bit) === 0) {
      const j = i | bit
      const a = state[i]
      const b = state[j]
      state[i] = cadd(cmul(m[0], a), cmul(m[1], b))
      state[j] = cadd(cmul(m[2], a), cmul(m[3], b))
    }
  }
}

/** Local basis order for 2-qubit gates: index = 2*b_ctrl + b_target. */
function applyTwo(state: Complex[], dim: number, q1: number, q2: number, m: Mat4): void {
  const b1 = 1 << q1
  const b2 = 1 << q2
  for (let base = 0; base < dim; base++) {
    if (base & b1) continue
    if (base & b2) continue
    const idx = [base, base | b2, base | b1, base | b1 | b2]
    const old = idx.map((i) => state[i])
    for (let l = 0; l < 4; l++) {
      let acc = ZERO
      for (let k = 0; k < 4; k++) {
        const u = m[l * 4 + k]
        if (u.re === 0 && u.im === 0) continue
        acc = cadd(acc, cmul(u, old[k]))
      }
      state[idx[l]] = acc
    }
  }
}

/** Local basis order for 3-qubit gates: index = 4*b0 + 2*b1 + b2. */
function applyThree(state: Complex[], dim: number, qubits: number[], m: Mat8): void {
  const [q0, q1, q2] = qubits
  const bits = [1 << q0, 1 << q1, 1 << q2]
  for (let base = 0; base < dim; base++) {
    if ((base & bits[0]) || (base & bits[1]) || (base & bits[2])) continue
    const idx: number[] = []
    for (let l = 0; l < 8; l++) {
      let g = base
      if ((l >> 2) & 1) g |= bits[0]
      if ((l >> 1) & 1) g |= bits[1]
      if (l & 1) g |= bits[2]
      idx.push(g)
    }
    const old = idx.map((i) => state[i])
    for (let l = 0; l < 8; l++) {
      let acc = ZERO
      for (let k = 0; k < 8; k++) {
        const u = m[l * 8 + k]
        if (u.re === 0 && u.im === 0) continue
        acc = cadd(acc, cmul(u, old[k]))
      }
      state[idx[l]] = acc
    }
  }
}

export function applyGateToState(state: Complex[], dim: number, gate: Gate): void {
  switch (gate.kind) {
    case 'M':
    case 'BARRIER':
      return
    case 'CNOT':
    case 'CZ':
    case 'SWAP':
    case 'CRX':
    case 'CRY':
    case 'CRZ':
      applyTwo(state, dim, gate.qubits[0], gate.qubits[1], twoQubitMatrix(gate.kind, gate.params))
      return
    case 'CCX':
      applyThree(state, dim, gate.qubits, toffoliMat())
      return
    case 'CSWAP':
      applyThree(state, dim, gate.qubits, fredkinMat())
      return
    default:
      applySingle(state, dim, gate.qubits[0], singleQubitMatrix(gate.kind, gate.params))
  }
}

export const probabilitiesOf = (state: Complex[]): number[] => state.map(cabs2)

export const initialState = (numQubits: number): Complex[] => {
  const dim = 1 << numQubits
  const state = new Array<Complex>(dim).fill(ZERO)
  state[0] = ONE
  return state
}

// ---------------------------------------------------------------------------
// Density matrix simulation (required for noise)
// ---------------------------------------------------------------------------

function applyGateDensity(rho: Complex[], dim: number, qubits: number[], u: Complex[]): Complex[] {
  const size = 1 << qubits.length
  const mask = qubits.reduce((a, q) => a | (1 << q), 0)
  const others: number[] = []
  for (let i = 0; i < dim; i++) if ((i & mask) === 0) others.push(i)

  // Gate matrices are written with the first listed qubit as the MOST
  // significant local bit (index = 2*ctrl + target, 4*b0 + 2*b1 + b2), while
  // `l` is a little-endian integer (bit 0 = LSB). Map bit k to the reversed
  // slot so the density path applies exactly the same matrix as the
  // statevector path.
  const localToGlobal = (base: number, l: number): number => {
    let g = base
    for (let k = 0; k < qubits.length; k++) if ((l >> k) & 1) g |= 1 << qubits[qubits.length - 1 - k]
    return g
  }

  const out = new Array<Complex>(dim * dim).fill(ZERO)
  for (const o1 of others) {
    for (const o2 of others) {
      for (let l1 = 0; l1 < size; l1++) {
        const g1 = localToGlobal(o1, l1)
        for (let l2 = 0; l2 < size; l2++) {
          const g2 = localToGlobal(o2, l2)
          let acc = ZERO
          for (let m1 = 0; m1 < size; m1++) {
            const u1 = u[l1 * size + m1]
            if (u1.re === 0 && u1.im === 0) continue
            const gm1 = localToGlobal(o1, m1)
            for (let m2 = 0; m2 < size; m2++) {
              const u2 = u[l2 * size + m2]
              if (u2.re === 0 && u2.im === 0) continue
              const gm2 = localToGlobal(o2, m2)
              acc = cadd(acc, cmul(cmul(u1, rho[gm1 * dim + gm2]), cconj(u2)))
            }
          }
          out[g1 * dim + g2] = acc
        }
      }
    }
  }
  return out
}

/** Conjugation by a Pauli on qubit q: P rho P (P is Hermitian for X, Z; handled via phase). */
function applyPauliDensity(rho: Complex[], dim: number, q: number, pauli: 'X' | 'Y' | 'Z'): Complex[] {
  const mask = 1 << q
  const out = new Array<Complex>(dim * dim).fill(ZERO)
  const bitOf = (i: number) => (i & mask) === 0 ? 0 : 1

  if (pauli === 'X') {
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        out[i * dim + j] = rho[(i ^ mask) * dim + (j ^ mask)]
      }
    }
    return out
  }

  if (pauli === 'Z') {
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const sign = bitOf(i) ^ bitOf(j) ? -1 : 1
        out[i * dim + j] = cscale(rho[i * dim + j], sign)
      }
    }
    return out
  }

  // Y = i X Z  =>  Y rho Y = -X (Z rho Z) X
  const zed = applyPauliDensity(rho, dim, q, 'Z')
  const xed = applyPauliDensity(zed, dim, q, 'X')
  for (let k = 0; k < xed.length; k++) out[k] = cscale(xed[k], -1)
  return out
}

/** Amplitude damping channel on qubit q. */
function applyAmplitudeDamping(rho: Complex[], dim: number, q: number, gamma: number): Complex[] {
  const mask = 1 << q
  const f = Math.sqrt(Math.max(0, 1 - gamma))
  const out = new Array<Complex>(dim * dim).fill(ZERO)
  for (let i = 0; i < dim; i++) {
    const bi = (i & mask) === 0 ? 0 : 1
    for (let j = 0; j < dim; j++) {
      const bj = (j & mask) === 0 ? 0 : 1
      let acc: Complex
      if (bi === 0 && bj === 0) {
        acc = cadd(rho[i * dim + j], cscale(rho[(i | mask) * dim + (j | mask)], gamma))
      } else if (bi === 0 || bj === 0) {
        acc = cscale(rho[i * dim + j], f)
      } else {
        acc = cscale(rho[i * dim + j], f * f)
      }
      out[i * dim + j] = acc
    }
  }
  return out
}

/** Marginal probability that qubit q reads 1 (from the density matrix diagonal). */
function densityProbOne(rho: Complex[], dim: number, q: number): number {
  const mask = 1 << q
  let p = 0
  for (let i = 0; i < dim; i++) {
    if (i & mask) p += rho[i * dim + i].re
  }
  return Math.max(0, Math.min(1, p))
}

/** Project the density matrix onto the q = bit subspace and renormalise. */
function projectDensity(rho: Complex[], dim: number, q: number, bit: number): Complex[] {
  const mask = 1 << q
  const out = new Array<Complex>(dim * dim).fill(ZERO)
  let trace = 0
  for (let i = 0; i < dim; i++) {
    if (((i & mask) === 0 ? 0 : 1) !== bit) continue
    for (let j = 0; j < dim; j++) {
      if (((j & mask) === 0 ? 0 : 1) !== bit) continue
      out[i * dim + j] = rho[i * dim + j]
    }
    trace += rho[i * dim + i].re
  }
  if (trace > 1e-12) {
    for (let k = 0; k < out.length; k++) out[k] = cscale(out[k], 1 / trace)
  }
  return out
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

export function sampleFromProbabilities(
  probs: number[],
  shots: number,
  rng: () => number,
): number[] {
  const cumulative: number[] = []
  let running = 0
  for (const p of probs) {
    running += p
    cumulative.push(running)
  }
  const total = running || 1
  const results: number[] = []
  for (let s = 0; s < shots; s++) {
    const r = rng() * total
    let idx = cumulative.findIndex((c) => r < c)
    if (idx === -1) idx = probs.length - 1
    results.push(idx)
  }
  return results
}

/** Apply classical readout error (bit flips) to a sampled index. */
function applyReadoutError(index: number, numQubits: number, p: number, rng: () => number): number {
  if (p <= 0) return index
  let out = index
  for (let q = 0; q < numQubits; q++) {
    if (rng() < p) out ^= 1 << q
  }
  return out
}

// ---------------------------------------------------------------------------
// Main simulation entry point
// ---------------------------------------------------------------------------

interface TrajectoryResult {
  state: Complex[]
  rho: Complex[] | null
  steps: StepSnapshot[]
  measuredBits: Record<number, number>
  probabilities: number[]
}

/**
 * Execute the circuit once. When `collapse` is on, each measurement projects the
 * state, so one call = one physical shot (needed for classical feed-forward).
 */
function runTrajectory(
  circuit: Circuit,
  numQubits: number,
  dim: number,
  rng: () => number,
  collapse: boolean,
  noise: NoiseConfig | undefined,
  recordSteps: boolean,
): TrajectoryResult {
  const steps: StepSnapshot[] = []
  const measuredBits: Record<number, number> = {}

  let state = initialState(numQubits)
  let rho: Complex[] | null = null
  if (noise && isNoisy(noise)) {
    rho = new Array<Complex>(dim * dim).fill(ZERO)
    rho[0] = ONE
  }

  const snapshot = (): Complex[] => (rho ? densityToStatevector(rho, dim) : state.slice())
  const currentProbs = (): number[] => (rho ? densityProbabilities(rho, dim) : probabilitiesOf(state))
  const columns = Math.max(0, ...circuit.gates.map((g) => g.column + 1))

  for (let column = 0; column < columns; column++) {
    for (const gate of gatesInColumn(circuit, column)) {
      // Classical feed-forward: skip the gate unless its control bit matches.
      if (gate.condition) {
        const observed = measuredBits[gate.condition.qubit]
        if (observed !== gate.condition.value) {
          if (recordSteps) {
            steps.push({
              index: steps.length,
              column,
              gateId: gate.id,
              kind: gate.kind,
              label: `${gateLabel(gate)} — skipped (c${gate.condition.qubit}=${observed ?? '?'})`,
              state: snapshot(),
              probabilities: currentProbs(),
              skipped: true,
            })
          }
          continue
        }
      }

      if (gate.kind === 'M') {
        const q = gate.qubits[0]
        const bit = sampleBit(q, state, rho, dim, rng)
        measuredBits[q] = bit
        if (collapse) {
          if (rho) {
            rho = projectDensity(rho, dim, q, bit)
          } else {
            const mask = 1 << q
            for (let i = 0; i < dim; i++) {
              if (((i & mask) === 0 ? 0 : 1) !== bit) state[i] = ZERO
            }
            let norm = 0
            for (const v of state) norm += cabs2(v)
            if (norm > 1e-12) for (let i = 0; i < dim; i++) state[i] = cscale(state[i], 1 / Math.sqrt(norm))
          }
        }
        if (recordSteps) {
          steps.push({
            index: steps.length,
            column,
            gateId: gate.id,
            kind: gate.kind,
            label: `measure q${q}`,
            state: snapshot(),
            probabilities: currentProbs(),
            bit,
          })
        }
        continue
      }

      if (gate.kind === 'BARRIER') continue

      if (rho) {
        rho = applyGateDensity(rho, dim, gate.qubits, matrixForGate(gate))
        if (noise) {
          // Apply the toy noise channel to every qubit the gate touched, not
          // just the first one. A CNOT therefore decoheres both participants.
          for (const q of new Set(gate.qubits)) {
            if (noise.depolarizing > 0) {
              const p = noise.depolarizing
              const px = applyPauliDensity(rho, dim, q, 'X')
              const py = applyPauliDensity(rho, dim, q, 'Y')
              const pz = applyPauliDensity(rho, dim, q, 'Z')
              const mixed = new Array<Complex>(dim * dim).fill(ZERO)
              for (let i = 0; i < mixed.length; i++) {
                mixed[i] = cadd(
                  cadd(cscale(rho[i], 1 - p), cscale(px[i], p / 3)),
                  cadd(cscale(py[i], p / 3), cscale(pz[i], p / 3)),
                )
              }
              rho = mixed
            }
            if (noise.amplitudeDamping > 0) {
              rho = applyAmplitudeDamping(rho, dim, q, noise.amplitudeDamping)
            }
          }
        }
      } else {
        applyGateToState(state, dim, gate)
      }

      if (recordSteps) {
        steps.push({
          index: steps.length,
          column,
          gateId: gate.id,
          kind: gate.kind,
          label: gateLabel(gate),
          state: snapshot(),
          probabilities: currentProbs(),
        })
      }
    }
  }

  return { state, rho, steps, measuredBits, probabilities: currentProbs() }
}

export function simulate(circuit: Circuit, options: SimOptions = {}): SimResult {
  const started = Date.now()
  const numQubits = options.numQubits ?? circuit.numQubits
  const shots = options.shots ?? 1024
  const seed = options.seed ?? 20260121
  const rng = mulberry32(seed)
  const noise = options.noise
  const noisy = isNoisy(noise)

  const dim = 1 << numQubits
  const hasConditionals = circuit.gates.some((g) => !!g.condition)
  const measurementColumns = circuit.gates.filter((g) => g.kind === 'M').map((g) => g.column)
  const firstMeasurement = measurementColumns.length ? Math.min(...measurementColumns) : Infinity
  // A measurement must collapse the state when a later operation can see the
  // outcome (feed-forward) or when another gate acts afterwards. Terminal
  // measurements can safely be sampled from the final distribution.
  const hasPostMeasurementGate = circuit.gates.some(
    (g) => g.kind !== 'M' && g.kind !== 'BARRIER' && g.column > firstMeasurement,
  )
  const collapse = hasConditionals || (options.collapseOnMeasure ?? hasPostMeasurementGate)
  const readout = noise?.readoutError ?? 0

  // One trajectory per shot when the state must collapse; otherwise a single
  // deterministic evolution supplies the final distribution. This is required
  // for noisy feed-forward too: the density matrix alone only gives one branch.
  const trajectories = collapse ? Math.max(1, shots) : 1

  let first: TrajectoryResult | undefined
  const counts: Record<string, number> = {}
  const ensembleProbs = new Array<number>(dim).fill(0)
  let ensembleRho: Complex[] | null = null

  for (let t = 0; t < trajectories; t++) {
    const result = runTrajectory(circuit, numQubits, dim, rng, collapse, noise, t === 0)
    if (!first) first = result

    if (collapse) {
      if (result.rho) {
        if (!ensembleRho) ensembleRho = new Array<Complex>(dim * dim).fill(ZERO)
        for (let i = 0; i < result.rho.length; i++) ensembleRho[i] = cadd(ensembleRho[i], result.rho[i])
      }
      for (let i = 0; i < dim; i++) ensembleProbs[i] += result.probabilities[i] ?? 0

      let idx: number
      if (measurementColumns.length) {
        idx = 0
        for (const [qStr, bit] of Object.entries(result.measuredBits)) {
          if (bit) idx |= 1 << Number(qStr)
        }
      } else {
        idx = sampleFromProbabilities(result.probabilities, 1, rng)[0] ?? 0
      }
      const key = bitString(applyReadoutError(idx, numQubits, readout, rng), numQubits)
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  const outcome = first as TrajectoryResult
  const finalRho = ensembleRho ?? outcome.rho ?? undefined

  if (!collapse) {
    for (const draw of sampleFromProbabilities(outcome.probabilities, shots, rng)) {
      const key = bitString(applyReadoutError(draw, numQubits, readout, rng), numQubits)
      counts[key] = (counts[key] ?? 0) + 1
    }
  } else {
    const scale = 1 / trajectories
    for (let i = 0; i < dim; i++) ensembleProbs[i] *= scale
    if (ensembleRho) for (let i = 0; i < ensembleRho.length; i++) ensembleRho[i] = cscale(ensembleRho[i], scale)
  }

  return {
    numQubits,
    state: finalRho ? densityToStatevector(finalRho, dim) : outcome.state,
    probabilities: collapse ? ensembleProbs : outcome.probabilities,
    counts,
    shots,
    steps: outcome.steps,
    measuredBits: outcome.measuredBits,
    noisy,
    ...(finalRho ? { rho: finalRho } : {}),
    purity: finalRho ? densityPurity(finalRho, dim) : 1,
    durationMs: Date.now() - started,
  }
}

/** Tr(rho^2) of a flattened density matrix. */
export function densityPurity(rho: Complex[], dim: number): number {
  let acc = 0
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      acc += cabs2(rho[i * dim + j])
    }
  }
  return acc
}

function matrixForGate(gate: Gate): Complex[] {
  switch (gate.kind) {
    case 'CNOT':
    case 'CZ':
    case 'SWAP':
    case 'CRX':
    case 'CRY':
    case 'CRZ':
      return twoQubitMatrix(gate.kind, gate.params)
    case 'CCX':
      return toffoliMat()
    case 'CSWAP':
      return fredkinMat()
    default:
      return singleQubitMatrix(gate.kind, gate.params)
  }
}

function gateLabel(gate: Gate): string {
  const q = gate.qubits
  switch (gate.kind) {
    case 'CNOT':
    case 'CZ':
    case 'SWAP':
    case 'CRX':
    case 'CRY':
    case 'CRZ':
      return `${gate.kind} q${q[0]},q${q[1]}`
    case 'CCX':
    case 'CSWAP':
      return `${gate.kind} q${q[0]},q${q[1]},q${q[2]}`
    default:
      return `${gate.kind} q${q[0]}`
  }
}

function sampleBit(q: number, state: Complex[], rho: Complex[] | null, dim: number, rng: () => number): number {
  const p1 = rho
    ? densityProbOne(rho, dim, q)
    : Array.from({ length: dim }, (_, i) => (i & (1 << q) ? cabs2(state[i]) : 0)).reduce((a, b) => a + b, 0)
  return rng() < p1 ? 1 : 0
}

/**
 * Representative amplitudes for a mixed state: sqrt of the rho diagonal with
 * zero phase. This is NOT a pure statevector and cannot carry coherences; use
 * `sim.rho` + `summarizeDensity` for entropy, purity and entanglement. It is
 * kept for the amplitude bars and Bloch views, which need a display vector.
 */
export function densityToStatevector(rho: Complex[], dim: number): Complex[] {
  const out = new Array<Complex>(dim).fill(ZERO)
  for (let i = 0; i < dim; i++) {
    const p = Math.max(0, rho[i * dim + i].re)
    out[i] = { re: Math.sqrt(p), im: 0 }
  }
  return out
}

export function densityProbabilities(rho: Complex[], dim: number): number[] {
  const out = new Array<number>(dim).fill(0)
  for (let i = 0; i < dim; i++) out[i] = Math.max(0, rho[i * dim + i].re)
  return out
}

/** Marginal distribution over a subset of qubits, remapped to compact indices. */
export function marginalProbabilities(probs: number[], dim: number, qubits: number[]): number[] {
  const out = new Array<number>(1 << qubits.length).fill(0)
  for (let i = 0; i < dim; i++) {
    let idx = 0
    qubits.forEach((q, k) => {
      if ((i >> q) & 1) idx |= 1 << k
    })
    out[idx] += probs[i]
  }
  return out
}

/** Von Neumann entropy of a density matrix (used for entanglement analysis). */
export function densityEntropy(rho: Complex[], dim: number): number {
  const eig = densityEigenvalues(rho, dim)
  let h = 0
  for (const l of eig) {
    if (l > 1e-12) h -= l * Math.log2(l)
  }
  return h
}

/** Eigenvalues of an Hermitian density matrix, including imaginary coherences. */
export function densityEigenvalues(rho: Complex[], dim: number): number[] {
  const mat: Complex[][] = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => rho[i * dim + j]),
  )
  return hermitianEigenvalues(mat)
}

export { CI, C }
