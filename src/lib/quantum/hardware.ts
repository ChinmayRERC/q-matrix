/**
 * Hardware device profiles.
 *
 * The workbench simulates at most six qubits, so these are *teaching* profiles:
 * the connectivity, native gate set, timing and readout regimes are modelled,
 * while the physical qubit counts are the real programme targets. Numbers are
 * order-of-magnitude, not device datasheets.
 */
import type { Circuit, Gate } from './circuit'
import type { NoiseConfig } from './simulator'

export type DeviceId = 'ideal' | 'anviqa-neutral' | 'anviqa-ion' | 'ibm-heron' | 'custom'

export interface DeviceProfile {
  id: DeviceId
  name: string
  short: string
  modality: string
  /** Physical qubits in the real machine or programme target. */
  physicalQubits: number
  connectivity: 'all-to-all' | 'nearest-neighbour'
  connectionNote: string
  basis: string[]
  noise: NoiseConfig
  twoQubitNs: number
  readoutNs: number
  coherenceUs: number
  readoutLabel: string
  note: string
  source: string
  sourceUrl: string
  /** Undirected edges for nearest-neighbour devices on the 6-qubit canvas. */
  edges?: Array<[number, number]>
}

/**
 * A six-node slice shaped like IBM's heavy-hex lattice: one degree-3 node, one
 * branch, and a four-hop path between the far corners. Enough to make SWAP
 * routing visible without pretending to be a 133-qubit map.
 */
export const HERON_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [1, 3],
  [3, 4],
  [4, 5],
]

export const DEVICES: Record<Exclude<DeviceId, 'custom'>, DeviceProfile> = {
  ideal: {
    id: 'ideal',
    name: 'Ideal simulator',
    short: 'Ideal',
    modality: 'Statevector',
    physicalQubits: 0,
    connectivity: 'all-to-all',
    connectionNote: 'any gate on any pair',
    basis: ['any'],
    noise: { depolarizing: 0, amplitudeDamping: 0, readoutError: 0 },
    twoQubitNs: 0,
    readoutNs: 0,
    coherenceUs: 0,
    readoutLabel: 'exact probabilities',
    note: 'No decoherence, no routing, no readout error. The reference result.',
    source: 'Q-matrix browser engine',
    sourceUrl: 'https://github.com/ChinmayRERC/q-matrix',
  },
  'anviqa-neutral': {
    id: 'anviqa-neutral',
    name: 'anviQa neutral atoms',
    short: 'Rb atoms',
    modality: 'Neutral atoms · Rb-87 tweezers',
    physicalQubits: 400,
    connectivity: 'all-to-all',
    connectionNote: 'reconfigurable: atoms are moved, so no SWAP routing',
    basis: ['rz', 'ry', 'cz'],
    noise: { depolarizing: 0.004, amplitudeDamping: 0.002, readoutError: 0.006 },
    twoQubitNs: 1_000,
    readoutNs: 5_000,
    coherenceUs: 1_500,
    readoutLabel: 'RDSNS · µs, non-destructive',
    note: 'Rydberg CZ is native. RRI’s RDSNS readout is ~1000× faster than fluorescence and does not destroy the state.',
    source: 'RRI Bengaluru · anviQa (NQM)',
    sourceUrl: 'https://qcinnovation.co.in/',
  },
  'anviqa-ion': {
    id: 'anviqa-ion',
    name: 'anviQa trapped ions',
    short: 'Ca⁺ ions',
    modality: 'Trapped ions · Ca⁺ chain',
    physicalQubits: 50,
    connectivity: 'all-to-all',
    connectionNote: 'every ion in the chain can couple to every other',
    basis: ['rz', 'rx', 'ry', 'cz'],
    noise: { depolarizing: 0.0015, amplitudeDamping: 0.001, readoutError: 0.003 },
    twoQubitNs: 200_000,
    readoutNs: 100_000,
    coherenceUs: 1_000_000,
    readoutLabel: 'fluorescence · ms, destructive',
    note: 'Long coherence and all-to-all coupling, paid for with slow gates. Numbers are teaching estimates.',
    source: 'RRI Bengaluru · anviQa (NQM)',
    sourceUrl: 'https://qcinnovation.co.in/',
  },
  'ibm-heron': {
    id: 'ibm-heron',
    name: 'IBM Heron',
    short: 'Heron',
    modality: 'Superconducting · heavy-hex',
    physicalQubits: 133,
    connectivity: 'nearest-neighbour',
    connectionNote: 'heavy-hex lattice: distant pairs need SWAP routing',
    basis: ['rz', 'sx', 'x', 'cz'],
    noise: { depolarizing: 0.006, amplitudeDamping: 0.004, readoutError: 0.012 },
    twoQubitNs: 100,
    readoutNs: 1_500,
    coherenceUs: 200,
    readoutLabel: 'dispersive · µs, destructive',
    note: 'Fast gates, short coherence, and a fixed coupling map. This is the profile that makes SWAP overhead real.',
    source: 'IBM Quantum · Heron',
    sourceUrl: 'https://quantum.cloud.ibm.com/',
  },
}

export const DEVICE_LIST = ['ideal', 'anviqa-neutral', 'anviqa-ion', 'ibm-heron', 'custom'] as const

export function deviceById(id: DeviceId | undefined): DeviceProfile | null {
  if (!id || id === 'custom') return null
  return DEVICES[id] ?? null
}

/** Noise config for the browser simulator, or undefined for an exact run. */
export function deviceNoise(id: DeviceId | undefined): NoiseConfig | undefined {
  const device = deviceById(id)
  if (!device) return undefined
  return device.noise.depolarizing > 0 ? device.noise : undefined
}

/** Native two-qubit operations after decomposition, before routing. */
export function nativeTwoQubitCost(gate: Gate): number {
  switch (gate.kind) {
    case 'CNOT':
    case 'CZ':
    case 'CRX':
    case 'CRY':
    case 'CRZ':
      return 1
    case 'SWAP':
      return 3
    case 'CCX':
      return 6
    case 'CSWAP':
      return 8
    default:
      return 0
  }
}

const adjacency = (n: number, edges: Array<[number, number]>) => {
  const graph = Array.from({ length: n }, () => [] as number[])
  for (const [a, b] of edges) {
    if (a >= n || b >= n) continue
    graph[a].push(b)
    graph[b].push(a)
  }
  return graph
}

/** Shortest-path distance between two qubits, or Infinity when disconnected. */
export function couplingDistance(n: number, edges: Array<[number, number]>, from: number, to: number): number {
  if (from === to) return 0
  const graph = adjacency(n, edges)
  const seen = new Array<boolean>(n).fill(false)
  const queue: Array<{ node: number; d: number }> = [{ node: from, d: 0 }]
  seen[from] = true
  while (queue.length) {
    const { node, d } = queue.shift()!
    for (const next of graph[node]) {
      if (next === to) return d + 1
      if (seen[next]) continue
      seen[next] = true
      queue.push({ node: next, d: d + 1 })
    }
  }
  return Number.POSITIVE_INFINITY
}

/** Coupling map for a device on an `n`-qubit register (empty = no constraint). */
export function couplingFor(deviceId: DeviceId | undefined, n: number): Array<[number, number]> {
  const device = deviceById(deviceId)
  if (!device || device.id === 'ideal') return []
  if (device.connectivity === 'all-to-all') {
    const edges: Array<[number, number]> = []
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) edges.push([a, b])
    return edges
  }
  return (device.edges ?? HERON_EDGES).filter(([a, b]) => a < n && b < n)
}

export interface HardwareReport {
  device: DeviceProfile
  /** Two-qubit gates written by the learner. */
  programTwoQubit: number
  /** Two-qubit gates after decomposition and SWAP insertion. */
  nativeTwoQubit: number
  /** Extra SWAPs inserted to satisfy the coupling map. */
  swaps: number
  /** (native − program) / program, 0 when nothing is added. */
  overhead: number
  depth: number
  /** Estimated wall-clock time of one shot, in milliseconds. */
  estimatedMs: number
  /** One-sentence plain-English reading of the numbers. */
  verdict: string
}

/** Route every two-qubit gate through the device coupling map. */
export function evaluateHardware(circuit: Circuit, deviceId: DeviceId | undefined): HardwareReport {
  const device = deviceById(deviceId) ?? DEVICES.ideal
  const n = circuit.numQubits
  const edges = couplingFor(device.id, n)
  const nearest = device.connectivity === 'nearest-neighbour'

  let programTwoQubit = 0
  let nativeTwoQubit = 0
  let swaps = 0

  for (const gate of circuit.gates) {
    const cost = nativeTwoQubitCost(gate)
    if (cost === 0) continue
    programTwoQubit += 1
    nativeTwoQubit += cost
    if (!nearest || gate.qubits.length < 2) continue
    const distance = couplingDistance(n, edges, gate.qubits[0], gate.qubits[1])
    if (!Number.isFinite(distance) || distance <= 1) continue
    // One SWAP per hop between the pair; each SWAP decomposes into three CXs.
    const routed = distance - 1
    swaps += routed
    nativeTwoQubit += routed * 3
  }

  const depth = circuit.gates.reduce((max, gate) => Math.max(max, gate.column + 1), 0)
  const estimatedMs =
    device.id === 'ideal' ? 0 : (nativeTwoQubit * device.twoQubitNs + depth * device.twoQubitNs * 0.1 + device.readoutNs) / 1e6
  const overhead = programTwoQubit > 0 ? Math.max(0, (nativeTwoQubit - programTwoQubit) / programTwoQubit) : 0

  let verdict: string
  if (device.id === 'ideal') {
    verdict = 'Ideal run: no routing, decoherence or readout error.'
  } else if (programTwoQubit === 0) {
    verdict = 'No two-qubit gates, so this circuit maps directly onto the device.'
  } else if (swaps === 0) {
    verdict = `${programTwoQubit} two-qubit gate${programTwoQubit === 1 ? '' : 's'} map directly — no SWAPs.`
  } else {
    verdict = `${programTwoQubit} two-qubit gate${programTwoQubit === 1 ? '' : 's'} need ${swaps} SWAP${swaps === 1 ? '' : 's'} — ${nativeTwoQubit} native gates, ${Math.round(overhead * 100)}% overhead.`
  }

  return { device, programTwoQubit, nativeTwoQubit, swaps, overhead, depth, estimatedMs, verdict }
}

/** Format a duration in milliseconds for the UI. */
export function formatDuration(ms: number): string {
  if (ms === 0) return 'instant'
  if (ms < 0.001) return `${(ms * 1e6).toFixed(0)} ns`
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`
  return `${ms.toFixed(2)} ms`
}
