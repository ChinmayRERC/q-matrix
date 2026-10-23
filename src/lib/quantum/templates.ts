import { emptyCircuit, type Circuit, type Gate, type GateCondition } from './circuit'
import type { GateKind } from './core'

const g = (kind: GateKind, qubits: number[], params?: number[], condition?: GateCondition): Gate => ({
  id: `${kind}-${qubits.join('-')}-${Math.random().toString(36).slice(2, 7)}`,
  kind,
  qubits,
  params: params ?? [],
  column: 0,
  ...(condition ? { condition } : {}),
})

export interface CircuitTemplate {
  id: string
  name: string
  tagline: string
  difficulty: 'starter' | 'intermediate' | 'advanced'
  topics: string[]
  build: () => Circuit
}

/**
 * Lay gates out in list order. Each gate lands in the earliest moment where all
 * of its qubits are free, never before the previous gate, so the diagram reads
 * top-to-bottom in the same order the template was written. Classically
 * controlled gates are pushed after the measurement that drives them.
 */
const assemble = (numQubits: number, name: string, gates: Gate[]): Circuit => {
  const nextFree = new Map<number, number>()
  const measuredAt = new Map<number, number>()
  let cursor = 0
  const placed = gates.map((gate) => {
    let earliest = Math.max(cursor, ...gate.qubits.map((q) => nextFree.get(q) ?? 0))
    if (gate.condition) {
      const measured = measuredAt.get(gate.condition.qubit)
      if (measured !== undefined) earliest = Math.max(earliest, measured + 1)
    }
    gate.qubits.forEach((q) => nextFree.set(q, earliest + 1))
    if (gate.kind === 'M') measuredAt.set(gate.qubits[0], earliest)
    cursor = earliest
    return { ...gate, column: earliest }
  })
  return { ...emptyCircuit(numQubits, name), gates: placed }
}

// RY(theta) puts sin(theta/2) on |1>, so the W-state angle is
// theta = 2*arcsin(1/sqrt3) = 2*arctan(1/sqrt2) ~= 1.2309594173.
const W_ANGLE = 2 * Math.atan(1 / Math.SQRT2)

export const TEMPLATES: CircuitTemplate[] = [
  {
    id: 'superposition',
    name: 'Single-qubit superposition',
    tagline: 'One H gate turns |0⟩ into an even coin flip.',
    difficulty: 'starter',
    topics: ['QI-01', 'QI-02'],
    build: () => assemble(1, 'Superposition', [g('H', [0])]),
  },
  {
    id: 'phase',
    name: 'Phase wheel',
    tagline: 'Probabilities stay put while the relative phase rotates.',
    difficulty: 'starter',
    topics: ['M-01', 'QI-02'],
    // H prepares (|0> + |1>)/sqrt2; S adds a 90-degree relative phase, so the
    // amplitudes become (1, i)/sqrt2. The histogram is unchanged, which is the
    // whole point of an unobservable relative phase.
    build: () => assemble(1, 'Phase wheel', [g('H', [0]), g('S', [0])]),
  },
  {
    id: 'bell',
    name: 'Bell pair',
    tagline: 'The simplest possible entanglement: two qubits, one shared fate.',
    difficulty: 'starter',
    topics: ['QI-03', 'QI-04'],
    build: () => assemble(2, 'Bell pair', [g('H', [0]), g('CNOT', [0, 1])]),
  },
  {
    id: 'ghz',
    name: 'GHZ state',
    tagline: 'Three qubits that are all-or-nothing together.',
    difficulty: 'intermediate',
    topics: ['QI-03'],
    build: () => assemble(3, 'GHZ', [g('H', [0]), g('CNOT', [0, 1]), g('CNOT', [1, 2])]),
  },
  {
    id: 'w-state',
    name: 'W state',
    tagline: 'Exactly one qubit is excited — but which one is unknowable.',
    difficulty: 'intermediate',
    topics: ['QI-03'],
    // RY(alpha) q0 -> X q0 -> CRY(pi/2) q0->q1 -> X q0 puts q0,q1 in a W_2,
    // then the two CNOTs fan the |1> out onto q2 as well: (|001>+|010>+|100>)/sqrt3.
    build: () =>
      assemble(3, 'W state', [
        g('RY', [0], [W_ANGLE]),
        g('X', [0]),
        g('CRY', [0, 1], [Math.PI / 2]),
        g('X', [0]),
        g('X', [2]),
        g('CNOT', [0, 2]),
        g('CNOT', [1, 2]),
      ]),
  },
  {
    id: 'toffoli',
    name: 'Toffoli (CCX)',
    tagline: 'A classical AND gate that stays reversible.',
    difficulty: 'intermediate',
    topics: ['G-05'],
    build: () => assemble(3, 'Toffoli', [g('X', [0]), g('X', [1]), g('CCX', [0, 1, 2])]),
  },
  {
    id: 'teleportation',
    name: 'Quantum teleportation',
    tagline: 'Move a quantum state without ever copying it.',
    difficulty: 'advanced',
    topics: ['QI-06'],
    // q0 carries the state to send, q1/q2 share a Bell pair. After the Bell-basis
    // measurement the corrections are classically controlled by the two outcome
    // bits (X when q1 = 1, Z when q0 = 1) so q2 always ends up holding |psi>.
    build: () =>
      assemble(3, 'Teleportation', [
        g('RY', [0], [Math.PI / 3]),
        g('H', [1]),
        g('CNOT', [1, 2]),
        g('CNOT', [0, 1]),
        g('H', [0]),
        g('M', [0]),
        g('M', [1]),
        g('X', [2], [], { qubit: 1, value: 1 }),
        g('Z', [2], [], { qubit: 0, value: 1 }),
        g('M', [2]),
      ]),
  },
  {
    id: 'deutsch-jozsa',
    name: 'Deutsch–Jozsa',
    tagline: 'Decide whether a black-box function is constant or balanced in one query.',
    difficulty: 'advanced',
    topics: ['A-01'],
    // f(x0, x1) = x0 XOR x1 (balanced), implemented as two CNOTs into the ancilla.
    // The trailing H and X uncompute the ancilla back to |0> so the readout is clean.
    build: () =>
      assemble(3, 'Deutsch–Jozsa', [
        g('X', [2]),
        g('H', [2]),
        g('H', [0]),
        g('H', [1]),
        g('CNOT', [0, 2]),
        g('CNOT', [1, 2]),
        g('H', [0]),
        g('H', [1]),
        g('H', [2]),
        g('X', [2]),
      ]),
  },
  {
    id: 'bernstein-vazirani',
    name: 'Bernstein–Vazirani',
    tagline: 'Recover a hidden bit string with a single query.',
    difficulty: 'advanced',
    topics: ['A-02'],
    // Hidden string s = 01 (q0 = 1, q1 = 0): one CNOT from q0 into the ancilla.
    build: () =>
      assemble(3, 'Bernstein–Vazirani', [
        g('X', [2]),
        g('H', [2]),
        g('H', [0]),
        g('H', [1]),
        g('CNOT', [0, 2]),
        g('H', [0]),
        g('H', [1]),
        g('H', [2]),
        g('X', [2]),
      ]),
  },
  {
    id: 'qft',
    name: 'Quantum Fourier Transform',
    tagline: "The change of basis that powers Shor's algorithm.",
    difficulty: 'advanced',
    topics: ['A-04'],
    // Exact 3-qubit DFT in Qiskit's little-endian ordering. The bit-reversal
    // SWAP comes first (matching QFTGate), then the H/controlled-phase ladder.
    // Each controlled phase CP(theta) is built from CRZ(theta) plus an
    // RZ(theta/2) on its control, which is CP(theta) up to a global phase.
    build: () =>
      assemble(3, 'QFT', [
        g('SWAP', [0, 2]),
        g('H', [0]),
        g('RZ', [1], [Math.PI / 4]),
        g('CRZ', [1, 0], [Math.PI / 2]),
        g('RZ', [2], [Math.PI / 8]),
        g('CRZ', [2, 0], [Math.PI / 4]),
        g('H', [1]),
        g('RZ', [2], [Math.PI / 4]),
        g('CRZ', [2, 1], [Math.PI / 2]),
        g('H', [2]),
      ]),
  },
  {
    id: 'grover',
    name: "Grover's search",
    tagline: 'Amplitude amplification finds the needle in O(√N) steps.',
    difficulty: 'advanced',
    topics: ['A-07'],
    // Oracle marks |11> with a CZ, then the diffusion operator
    // H X CZ X H reflects the state about the average amplitude.
    build: () =>
      assemble(2, 'Grover search', [
        g('H', [0]),
        g('H', [1]),
        g('CZ', [0, 1]),
        g('H', [0]),
        g('H', [1]),
        g('X', [0]),
        g('X', [1]),
        g('CZ', [0, 1]),
        g('X', [0]),
        g('X', [1]),
        g('H', [0]),
        g('H', [1]),
      ]),
  },
  {
    id: 'swap-test',
    name: 'SWAP test',
    tagline: 'Compare two unknown states without ever revealing them.',
    difficulty: 'advanced',
    topics: ['QI-11'],
    // q0 is the ancilla, q1 holds |1> and q2 holds |+>. P(q0 = 0) = 0.75 shows
    // the two states are not orthogonal: (1 + |<1|+>|^2) / 2.
    build: () =>
      assemble(3, 'SWAP test', [
        g('X', [1]),
        g('H', [2]),
        g('H', [0]),
        g('CSWAP', [0, 1, 2]),
        g('H', [0]),
      ]),
  },
  {
    id: 'phase-kickback',
    name: 'Phase kickback',
    tagline: 'How a controlled gate turns an eigenstate into a phase.',
    difficulty: 'intermediate',
    topics: ['QI-04', 'G-04'],
    // q0 is |1>, an eigenstate of X; q1 is |+>. The CZ flips the sign of the
    // |1> branch of q1, leaving amplitudes +1/sqrt2 and -1/sqrt2.
    build: () => assemble(2, 'Phase kickback', [g('X', [0]), g('H', [1]), g('CZ', [0, 1])]),
  },
]

export const templateById = (id: string): CircuitTemplate | undefined =>
  TEMPLATES.find((t) => t.id === id)
