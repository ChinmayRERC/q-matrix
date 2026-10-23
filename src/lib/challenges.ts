/**
 * Circuit challenges with deterministic auto-graders.
 *
 * Every challenge is checked against the simulator output rather than a stored
 * gate list, so any correct construction passes. Graders return a per-check
 * breakdown so the UI can show *why* something failed, and the tutor can turn
 * that into a Socratic hint.
 */
import {
  addGate,
  countGates,
  emptyCircuit,
  type Circuit,
  type GateCondition,
} from './quantum/circuit'
import { concurrence, summarizeState } from './quantum/analysis'
import { simulate, type SimResult } from './quantum/simulator'
import type { Complex, GateKind } from './quantum/core'

export type ChallengeLevel = 'starter' | 'intermediate' | 'advanced'

export interface GradeCheck {
  label: string
  ok: boolean
  detail: string
}

export interface GradeResult {
  passed: boolean
  score: number
  checks: GradeCheck[]
  hint: string
}

export interface Challenge {
  id: string
  title: string
  brief: string
  difficulty: ChallengeLevel
  topicIds: string[]
  xp: number
  qubits: number
  /**
   * Starting circuit loaded by the challenge page and by Reset. A scaffold is
   * deliberately *not* a solution: it only removes setup boilerplate, so the
   * learner still has to add the gates the challenge is teaching.
   */
  scaffold: () => Circuit
  /** Ordered Socratic ladder — one hint per attempt. */
  hints: string[]
  grade: (circuit: Circuit) => GradeResult
}

/** Small builder used by challenge scaffolds. */
const scaffold = (
  numQubits: number,
  name: string,
  steps: Array<[GateKind, number[], number?, number[]?, GateCondition?]> = [],
): Circuit => {
  let circuit = emptyCircuit(numQubits, name)
  for (const [kind, qubits, column, params, condition] of steps) {
    circuit = addGate(circuit, kind, qubits, column, params, condition)
  }
  return circuit
}

const kindCount = (circuit: Circuit, kind: GateKind): number =>
  circuit.gates.filter((g) => g.kind === kind).length

const qubitCountCheck = (circuit: Circuit, expected: number): GradeCheck =>
  gateCheck(
    'Qubit register',
    circuit.numQubits === expected,
    `${circuit.numQubits} qubit(s) in the register, expected ${expected}.`,
  )

// ---------------------------------------------------------------------------
// Grading helpers
// ---------------------------------------------------------------------------

const TOL = 2e-3

const near = (a: number, b: number, tol = TOL) => Math.abs(a - b) <= tol

/** Compare a probability vector against expected values, ignoring tiny tails. */
function probsMatch(actual: number[], expected: Record<number, number>, tol = TOL): GradeCheck {
  const failures: string[] = []
  const max = Math.max(...Object.keys(expected).map(Number), ...actual.map((_, i) => i))
  for (let i = 0; i <= max; i++) {
    const want = expected[i] ?? 0
    if (!near(actual[i] ?? 0, want, tol)) {
      failures.push(`P(${i}) = ${(actual[i] ?? 0).toFixed(3)}, expected ${want.toFixed(3)}`)
    }
  }
  return {
    label: 'Measurement distribution',
    ok: failures.length === 0,
    detail: failures.length ? failures.join(' · ') : 'Distribution matches exactly.',
  }
}

/** State equality up to an arbitrary global phase. */
function stateUpToPhase(actual: Complex[], expected: Complex[], tol = 5e-3): GradeCheck {
  let phase: Complex | null = null
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i]
    if (Math.hypot(e.re, e.im) > 1e-6) {
      const mag = e.re * e.re + e.im * e.im
      phase = { re: (actual[i].re * e.re + actual[i].im * e.im) / mag, im: (actual[i].im * e.re - actual[i].re * e.im) / mag }
      break
    }
  }
  if (!phase) return { label: 'State vector', ok: false, detail: 'Expected state is all zeros.' }
  let worst = 0
  for (let i = 0; i < expected.length; i++) {
    const want = { re: e_re(expected[i]) * phase.re - e_im(expected[i]) * phase.im, im: e_re(expected[i]) * phase.im + e_im(expected[i]) * phase.re }
    worst = Math.max(worst, Math.hypot(actual[i].re - want.re, actual[i].im - want.im))
  }
  return {
    label: 'State vector (up to global phase)',
    ok: worst <= tol,
    detail: worst <= tol ? 'Amplitudes and relative phases are correct.' : `Largest amplitude error: ${worst.toFixed(3)}.`,
  }
}
const e_re = (c: Complex) => c.re
const e_im = (c: Complex) => c.im

const gateCheck = (label: string, ok: boolean, detail: string): GradeCheck => ({ label, ok, detail })

/** Exact QFT amplitudes for the computational basis state |j>. */
function qftState(n: number, j: number): Complex[] {
  const dim = 1 << n
  const scale = 1 / Math.sqrt(dim)
  return Array.from({ length: dim }, (_, k) => {
    const angle = (2 * Math.PI * j * k) / dim
    return { re: scale * Math.cos(angle), im: scale * Math.sin(angle) }
  })
}

function finish(checks: GradeCheck[], hint: string): GradeResult {
  const passed = checks.every((c) => c.ok)
  const score = checks.reduce((s, c) => s + (c.ok ? 1 : 0), 0) / Math.max(1, checks.length)
  return { passed, score, checks, hint: passed ? 'Solved — try the next one.' : hint }
}

/** Run a circuit and grade it, catching structural problems instead of throwing. */
function gradeWith(circuit: Circuit, fn: (sim: SimResult) => GradeCheck[], hint: string): GradeResult {
  let sim: SimResult
  try {
    sim = simulate(circuit, { shots: 256, seed: 99 })
  } catch (err) {
    return {
      passed: false,
      score: 0,
      checks: [gateCheck('Simulation', false, err instanceof Error ? err.message : 'Circuit failed to run')],
      hint,
    }
  }
  try {
    return finish(fn(sim), hint)
  } catch (err) {
    return {
      passed: false,
      score: 0,
      checks: [gateCheck('Circuit structure', false, err instanceof Error ? err.message : 'Grading failed')],
      hint,
    }
  }
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

export const CHALLENGES: Challenge[] = [
  {
    id: 'coin-flip',
    title: 'The fair coin',
    brief: 'Put a single qubit into an equal superposition so that measuring it gives 0 or 1 with 50% chance each.',
    difficulty: 'starter',
    topicIds: ['QI-02'],
    xp: 40,
    qubits: 1,
    scaffold: () => scaffold(1, 'Fair coin — start here'),
    hints: [
      'Which single-qubit gate maps the north pole of the Bloch sphere onto the equator?',
      'The Hadamard gate H creates an equal superposition from |0⟩.',
      'Place one H on q0. P(0) = P(1) = 0.5.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 1),
          probsMatch(sim.probabilities, { 0: 0.5, 1: 0.5 }),
          gateCheck('Gate budget', countGates(circuit) <= 2, `${countGates(circuit)} gate(s) used — 1 is enough.`),
        ],
        'Aim for an even split between the two outcomes.',
      ),
  },
  {
    id: 'bell-pair',
    title: 'Build a Bell pair',
    brief: 'Entangle two qubits so that measuring them always gives 00 or 11 with equal probability.',
    difficulty: 'starter',
    topicIds: ['QI-03', 'QI-04'],
    xp: 60,
    qubits: 2,
    scaffold: () => scaffold(2, 'Bell pair — start here'),
    hints: [
      'You need one gate that creates a superposition and one that creates correlation.',
      'H on the control, then CNOT from that control to the other qubit.',
      'H(q0) then CNOT(q0 → q1). The Concurrence readout should hit 1.00.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 2),
          probsMatch(sim.probabilities, { 0: 0.5, 3: 0.5 }),
          gateCheck(
            'Genuine entanglement',
            concurrence(sim.state) >= 0.99,
            `Concurrence = ${concurrence(sim.state).toFixed(2)} (needs ≥ 0.99).`,
          ),
        ],
        'Only |00⟩ and |11⟩ should survive, and the concurrence must reach 1.',
      ),
  },
  {
    id: 'anti-bell',
    title: 'The other Bell pair',
    brief: 'Now produce the anti-correlated pair: 01 and 10, never 00 or 11.',
    difficulty: 'intermediate',
    topicIds: ['QI-04'],
    xp: 70,
    qubits: 2,
    scaffold: () =>
      scaffold(2, 'Anti-Bell — finish the pair', [
        ['H', [0], 0],
        ['CNOT', [0, 1], 1],
      ]),
    hints: [
      'Start from the Bell pair you already know and flip exactly one qubit.',
      'An X on one of the two qubits swaps 00↔01 and 11↔10 — a bit flip on q0 is enough.',
      'Bell pair then X(q0): outcomes become 01 and 10 (indices 1 and 2 in little-endian).',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 2),
          probsMatch(sim.probabilities, { 1: 0.5, 2: 0.5 }),
          gateCheck('Still entangled', concurrence(sim.state) >= 0.99, `Concurrence = ${concurrence(sim.state).toFixed(2)}.`),
          gateCheck('Gate budget', countGates(circuit) <= 5, `${countGates(circuit)} gate(s) used — 3 is enough.`),
        ],
        'The two outcomes must differ in exactly one bit and never agree.',
      ),
  },
  {
    id: 'ghz',
    title: 'Three of a kind',
    brief: 'Create a GHZ state on three qubits: all zeros or all ones, nothing in between.',
    difficulty: 'intermediate',
    topicIds: ['QI-03'],
    xp: 90,
    qubits: 3,
    scaffold: () =>
      scaffold(3, 'GHZ — extend the Bell pair', [
        ['H', [0], 0],
        ['CNOT', [0, 1], 1],
      ]),
    hints: [
      'Generalise the Bell recipe: one superposition, then spread the correlation.',
      'H(q0), then CNOT(q0→q1) and CNOT(q1→q2).',
      'Check that P(000) = P(111) = 0.5 and every other outcome is zero.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 3),
          probsMatch(sim.probabilities, { 0: 0.5, 7: 0.5 }),
          gateCheck(
            'Three-way entanglement',
            summarizeState(sim.state, 3).maxEntanglementEntropy >= 0.99,
            `Max entropy across a cut = ${summarizeState(sim.state, 3).maxEntanglementEntropy.toFixed(2)} bits.`,
          ),
          gateCheck('Gate budget', countGates(circuit) <= 6, `${countGates(circuit)} gate(s) used — 3 is enough.`),
        ],
        'Every qubit must agree: 000 or 111 only.',
      ),
  },
  {
    id: 'phase-wizard',
    title: 'Hidden phase',
    brief: 'Make a 50/50 superposition where the |1⟩ amplitude carries a relative phase of exactly i.',
    difficulty: 'intermediate',
    topicIds: ['QI-01', 'G-04'],
    xp: 80,
    qubits: 1,
    scaffold: () => scaffold(1, 'Hidden phase — superposition ready', [['H', [0], 0]]),
    hints: [
      'First make an equal superposition, then rotate only the phase of the |1⟩ branch.',
      'H gives (|0⟩+|1⟩)/√2. The S gate multiplies |1⟩ by i.',
      'H then S: state = (|0⟩ + i|1⟩)/√2.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 1),
          probsMatch(sim.probabilities, { 0: 0.5, 1: 0.5 }),
          stateUpToPhase(sim.state, [
            { re: Math.SQRT1_2, im: 0 },
            { re: 0, im: Math.SQRT1_2 },
          ]),
          gateCheck('Gate budget', countGates(circuit) <= 4, `${countGates(circuit)} gate(s) used — 2 is enough.`),
        ],
        'Probabilities look right, but check the complex phase on the |1⟩ amplitude.',
      ),
  },
  {
    id: 'cz-entangler',
    title: 'Entangle without CNOT',
    brief: 'Produce a maximally entangled two-qubit state using only Hadamards and CZ gates.',
    difficulty: 'advanced',
    topicIds: ['G-04'],
    xp: 110,
    qubits: 2,
    scaffold: () => scaffold(2, 'CZ entangler — start here'),
    hints: [
      'CZ is diagonal in the computational basis, so it only acts on branches that already exist.',
      'Put both qubits in superposition first: H(q0), H(q1).',
      'H(q0), H(q1), CZ(q0,q1) gives (|00⟩ + |01⟩ + |10⟩ − |11⟩)/2 — maximally entangled.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 2),
          gateCheck(
            'Only H and CZ',
            circuit.gates.every((g) => g.kind === 'H' || g.kind === 'CZ'),
            `Used: ${[...new Set(circuit.gates.map((g) => g.kind))].join(', ') || 'nothing'}.`,
          ),
          gateCheck(
            'Uses both gate types',
            kindCount(circuit, 'H') >= 2 && kindCount(circuit, 'CZ') >= 1,
            `${kindCount(circuit, 'H')} H and ${kindCount(circuit, 'CZ')} CZ gate(s).`,
          ),
          gateCheck('Maximal entanglement', concurrence(sim.state) >= 0.99, `Concurrence = ${concurrence(sim.state).toFixed(2)}.`),
        ],
        'Both qubits need to be in superposition before the CZ can correlate them.',
      ),
  },
  {
    id: 'grover-hit',
    title: 'Find the needle',
    brief: 'Use one Grover iteration to make |11⟩ the only possible measurement outcome.',
    difficulty: 'advanced',
    topicIds: ['A-07'],
    xp: 130,
    qubits: 2,
    scaffold: () =>
      scaffold(2, 'Grover — uniform superposition ready', [
        ['H', [0], 0],
        ['H', [1], 0],
      ]),
    hints: [
      'Grover = uniform superposition, an oracle that marks |11⟩, then a reflection about the mean.',
      'The oracle is CZ (it flips the sign of |11⟩); the reflection is H, X, CZ, X, H.',
      'H,H → CZ → H,H → X,X → CZ → X,X → H,H gives P(11) = 1.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 2),
          probsMatch(sim.probabilities, { 3: 1 }, 1e-2),
          gateCheck(
            'Grover structure',
            kindCount(circuit, 'H') >= 4 && kindCount(circuit, 'CZ') >= 2 && kindCount(circuit, 'X') >= 4,
            `${kindCount(circuit, 'H')} H, ${kindCount(circuit, 'CZ')} CZ, ${kindCount(circuit, 'X')} X.`,
          ),
          gateCheck('Gate budget', countGates(circuit) <= 14, `${countGates(circuit)} gate(s) used — 12 is the textbook version.`),
        ],
        'After one iteration the marked state should dominate completely.',
      ),
  },
  {
    id: 'deutsch-jozsa',
    title: 'One query oracle',
    brief:
      'Build a balanced two-input Deutsch–Jozsa circuit: all four input outcomes become equally likely, and the ancilla returns to |0⟩.',
    difficulty: 'advanced',
    topicIds: ['A-01'],
    xp: 140,
    qubits: 3,
    scaffold: () =>
      scaffold(3, 'Deutsch–Jozsa — state preparation ready', [
        ['X', [2], 0],
        ['H', [2], 1],
        ['H', [0], 2],
        ['H', [1], 3],
      ]),
    hints: [
      'The ancilla starts in |1⟩ then gets a Hadamard, so CNOTs into it kick back a phase.',
      'A balanced function makes the two input amplitudes interfere into an equal superposition of all four inputs.',
      'Use two CNOTs into the ancilla, H the inputs again, then uncompute the ancilla with H and X.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 3),
          gateCheck(
            'Balanced oracle',
            kindCount(circuit, 'CNOT') >= 2,
            `${kindCount(circuit, 'CNOT')} CNOT(s) into the ancilla.`,
          ),
          gateCheck(
            'Interference step',
            kindCount(circuit, 'H') >= 5,
            `${kindCount(circuit, 'H')} Hadamards — five are needed (two inputs twice, plus the ancilla).`,
          ),
          // f(x0,x1)=x0 XOR x1 maps to a uniform input distribution:
          // P(00)=P(01)=P(10)=P(11)=0.25, with the ancilla back in |0>.
          probsMatch(sim.probabilities, { 0: 0.25, 1: 0.25, 2: 0.25, 3: 0.25 }, 2e-2),
        ],
        'For a balanced function the input register is uniform over all four values, not concentrated on 00.',
      ),
  },
  {
    id: 'qft-uniform',
    title: 'Fourier phase ramp',
    brief:
      'Prepare |001⟩ and apply the 3-qubit QFT. The histogram is flat, but the complex phases carry the Fourier information — match the exact state.',
    difficulty: 'advanced',
    topicIds: ['A-04'],
    xp: 140,
    qubits: 3,
    scaffold: () => scaffold(3, 'QFT — input |001⟩ ready', [['X', [0], 0]]),
    hints: [
      'QFT|001⟩ = (1/√8) Σₖ e^{2πik/8}|k⟩. Every outcome has probability 1/8, but the phases form a ramp.',
      'In Qiskit’s little-endian order the bit-reversal SWAP comes first, then a ladder of H and controlled phases.',
      'Build each controlled phase with RZ(θ/2) on the control plus CRZ(θ). For 3 qubits use θ = π/2, π/4, π/2 and SWAP(q0,q2).',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => [
          qubitCountCheck(circuit, 3),
          gateCheck(
            'QFT ladder',
            kindCount(circuit, 'H') >= 3 && kindCount(circuit, 'CRZ') >= 3,
            `${kindCount(circuit, 'H')} H and ${kindCount(circuit, 'CRZ')} CRZ gate(s).`,
          ),
          stateUpToPhase(sim.state, qftState(3, 1)),
          gateCheck('Gate budget', countGates(circuit) <= 12, `${countGates(circuit)} gate(s) used — 10 is enough.`),
        ],
        'A flat histogram is not enough: compare the phase of every amplitude with QFT|001⟩.',
      ),
  },
  {
    id: 'teleport',
    title: 'Teleport a state',
    brief: 'Send an RY(π/3) state from q0 to q2 using a Bell pair, a Bell-basis measurement and classical corrections.',
    difficulty: 'advanced',
    topicIds: ['QI-06'],
    xp: 180,
    qubits: 3,
    scaffold: () =>
      scaffold(3, 'Teleportation — state and Bell pair ready', [
        ['RY', [0], 0, [Math.PI / 3]],
        ['H', [1], 1],
        ['CNOT', [1, 2], 2],
      ]),
    hints: [
      'Prepare the state, then share a Bell pair between the middle and destination qubit.',
      'A Bell-basis measurement is CNOT then H on the source, followed by measurement.',
      'Correct with X when the second bit is 1 and Z when the first bit is 1 — then q2 holds the original state.',
    ],
    grade: (circuit) => {
      const conditional = circuit.gates.filter((g) => g.condition)
      const measurements = circuit.gates.filter((g) => g.kind === 'M')
      const correctX = conditional.some(
        (g) => g.kind === 'X' && g.condition?.qubit === 1 && g.condition.value === 1,
      )
      const correctZ = conditional.some(
        (g) => g.kind === 'Z' && g.condition?.qubit === 0 && g.condition.value === 1,
      )
      const checks: GradeCheck[] = [
        qubitCountCheck(circuit, 3),
        gateCheck(
          'Classical feed-forward present',
          conditional.length >= 2 && correctX && correctZ,
          `${conditional.length} conditional gate(s); X on c1 and Z on c0 are required.`,
        ),
        gateCheck('Both source qubits measured', measurements.length >= 3, `${measurements.length} measurement(s).`),
      ]
      let sim: SimResult
      try {
        sim = simulate(circuit, { shots: 2000, seed: 5 })
      } catch (err) {
        return finish(
          [...checks, gateCheck('Simulation', false, err instanceof Error ? err.message : 'failed')],
          'The circuit must simulate cleanly first.',
        )
      }
      const total = Object.values(sim.counts).reduce((a, b) => a + b, 0) || 1
      let ones = 0
      for (const [key, n] of Object.entries(sim.counts)) {
        const idx = parseInt([...key].reverse().join(''), 2)
        if ((idx >> 2) & 1) ones += n
      }
      checks.push(
        gateCheck(
          'Destination distribution',
          Math.abs(ones / total - 0.25) < 0.06,
          `P(q2 = 1) = ${(ones / total).toFixed(2)}, expected about 0.25.`,
        ),
      )
      return finish(checks, 'Check that the corrections are conditioned on the right measurement bits.')
    },
  },
  {
    id: 'no-clone',
    title: 'The impossible copy',
    brief: 'Try to clone an unknown state: prepare |+⟩ on q0 and copy it to q1 using only CNOT. See what actually happens.',
    difficulty: 'intermediate',
    topicIds: ['QI-05'],
    xp: 60,
    qubits: 2,
    scaffold: () => scaffold(2, 'No-cloning — |+⟩ ready', [['H', [0], 0]]),
    hints: [
      'CNOT copies basis states perfectly — that is the trap.',
      'With H on q0 first, the control is in superposition, so the CNOT entangles instead of copying.',
      'H(q0), CNOT(q0→q1) produces a Bell pair, not |++⟩. The clone attempt failed — that is the point.',
    ],
    grade: (circuit) =>
      gradeWith(
        circuit,
        (sim) => {
          const summary = summarizeState(sim.state, 2)
          return [
            qubitCountCheck(circuit, 2),
            gateCheck(
              'Attempted a copy with H and CNOT only',
              circuit.gates.every((g) => g.kind === 'H' || g.kind === 'CNOT') &&
                circuit.gates.some((g) => g.kind === 'CNOT') &&
                circuit.gates.some((g) => g.kind === 'H'),
              'Use H on q0 and CNOT(q0 → q1).',
            ),
            gateCheck(
              'Reproduced the failure mode',
              summary.concurrence >= 0.99,
              `Concurrence = ${summary.concurrence.toFixed(2)} — any real clone would be separable (0).`,
            ),
            probsMatch(sim.probabilities, { 0: 0.5, 3: 0.5 }),
          ]
        },
        'A universal cloner would need |+⟩|0⟩ → |+⟩|+⟩. Entanglement gets in the way.',
      ),
  },
]

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id)

/** Progressively stronger hints — clamp the attempt index. */
export function hintFor(challenge: Challenge, attempt: number): string {
  return challenge.hints[Math.min(challenge.hints.length - 1, Math.max(0, attempt))]
}
