/**
 * Static + dynamic circuit analysis. This is the deterministic half of the "AI"
 * layer: it detects real mistakes, finds redundant gates, explains what the state
 * is doing, and gives the tutor grounded facts to talk about.
 */
import { bitString, circuitDepth, countGates, describeGate, validateCircuit, type Circuit, type Gate } from './quantum/circuit'
import { GATE_LIBRARY } from './quantum/core'
import type { SimResult } from './quantum/simulator'
import { concurrence, entanglementEntropy, summarizeState } from './quantum/analysis'

export type InsightLevel = 'error' | 'warning' | 'tip' | 'win'

export interface Insight {
  id: string
  level: InsightLevel
  title: string
  detail: string
  fix?: string
  gateIds?: string[]
}

/** Gates that are their own inverse (applying two in a row does nothing). */
const SELF_INVERSE = new Set(['H', 'X', 'Y', 'Z', 'CNOT', 'CZ', 'SWAP', 'CCX', 'CSWAP'])

const sameTargets = (a: Gate, b: Gate) =>
  a.kind === b.kind &&
  a.qubits.length === b.qubits.length &&
  a.qubits.every((q, i) => q === b.qubits[i]) &&
  a.params.every((p, i) => Math.abs(p - (b.params[i] ?? 0)) < 1e-9)

/** Pairs of identical self-inverse gates that cancel each other out. */
export function cancellingPairs(circuit: Circuit): Array<[Gate, Gate]> {
  const pairs: Array<[Gate, Gate]> = []
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column)
  const pending = new Map<string, Gate>()
  for (const gate of ordered) {
    if (!SELF_INVERSE.has(gate.kind)) continue
    const key = `${gate.kind}:${gate.qubits.join(',')}:${gate.params.join(',')}`
    const previous = pending.get(key)
    if (previous) {
      // Only a cancelling pair when nothing else touched those qubits in between.
      const blocked = circuit.gates.some(
        (g) =>
          g.column > previous.column &&
          g.column < gate.column &&
          g.qubits.some((q) => gate.qubits.includes(q)),
      )
      if (!blocked) {
        pairs.push([previous, gate])
        pending.delete(key)
        continue
      }
    }
    pending.set(key, gate)
  }
  return pairs
}

export interface ComplexityScore {
  gates: number
  depth: number
  twoQubit: number
  /** Rough hardware cost: T gates and 2-qubit gates dominate. */
  cost: number
  removable: number
}

export function scoreComplexity(circuit: Circuit): ComplexityScore {
  const twoQubit = circuit.gates.filter((g) => g.qubits.length >= 2).length
  const tGates = circuit.gates.filter((g) => g.kind === 'T' || g.kind === 'Tdg').length
  return {
    gates: countGates(circuit),
    depth: circuitDepth(circuit),
    twoQubit,
    cost: twoQubit * 10 + tGates * 3 + (countGates(circuit) - twoQubit - tGates),
    removable: cancellingPairs(circuit).length * 2,
  }
}

/** Delete cancelling gate pairs. Returns the simplified circuit and what changed. */
export function optimizeCircuit(circuit: Circuit): { circuit: Circuit; removed: Gate[] } {
  const pairs = cancellingPairs(circuit)
  if (!pairs.length) return { circuit, removed: [] }
  const doomed = new Set(pairs.flat().map((g) => g.id))
  const removed = circuit.gates.filter((g) => doomed.has(g.id))
  // Preserve simultaneity: compact only the distinct surviving columns. Mapping
  // every gate to its array index would turn parallel gates into a deeper
  // sequential circuit (H on q0 and X on q1 share one moment before optimisation).
  const kept = circuit.gates.filter((g) => !doomed.has(g.id))
  const columns = [...new Set(kept.map((g) => g.column))].sort((a, b) => a - b)
  const compact = new Map(columns.map((column, index) => [column, index]))
  const gates = kept
    .sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
    .map((g) => ({ ...g, column: compact.get(g.column) ?? g.column }))
  return { circuit: { ...circuit, gates }, removed }
}

/**
 * Full review of a circuit. `sim` is optional so the panel can render insights
 * before the user has run the experiment.
 */
export function analyzeCircuit(circuit: Circuit, sim?: SimResult): Insight[] {
  const insights: Insight[] = []
  const n = circuit.numQubits

  for (const issue of validateCircuit(circuit)) {
    if (issue.level === 'error') {
      insights.push({
        id: `struct-${issue.gateId ?? issue.message}`,
        level: 'error',
        title: issue.message,
        detail: 'This will stop the circuit from simulating correctly.',
        fix: 'Edit the gate so every qubit is in range and each moment uses distinct qubits.',
        gateIds: issue.gateId ? [issue.gateId] : undefined,
      })
    }
  }

  const pairs = cancellingPairs(circuit)
  if (pairs.length) {
    const ids = pairs.flat().map((g) => g.id)
    insights.push({
      id: 'cancel-pairs',
      level: 'warning',
      title: `${pairs.length} gate pair${pairs.length > 1 ? 's' : ''} cancel out`,
      detail: pairs
        .map(([a, b]) => `${describeGate(a)} at step ${a.column + 1} is undone by step ${b.column + 1}`)
        .join('; '),
      fix: 'Remove the highlighted gates — the final state is identical without them.',
      gateIds: ids,
    })
  }

  const measured = new Set(circuit.gates.filter((g) => g.kind === 'M').map((g) => g.qubits[0]))
  const untouched = Array.from({ length: n }, (_, i) => i).filter(
    (q) => !circuit.gates.some((g) => g.qubits.includes(q)),
  )
  if (untouched.length && circuit.gates.length) {
    insights.push({
      id: 'idle-qubits',
      level: 'tip',
      title: `q${untouched.join(', q')} never do${untouched.length > 1 ? '' : 'es'} anything`,
      detail: 'Idle qubits stay in |0⟩, so they add noise on real hardware without adding power.',
      fix: 'Either use them (more lanes = more entanglement) or reduce the register size.',
    })
  }

  // Only an *unconditional* gate on a qubit that has already been measured is
  // invalid. Classically controlled corrections are the whole point of
  // feed-forward (teleportation), and gates on other, unmeasured qubits remain
  // perfectly valid after a mid-circuit measurement.
  const firstMeasureByQubit = new Map<number, number>()
  for (const g of circuit.gates) {
    if (g.kind !== 'M') continue
    const q = g.qubits[0]
    firstMeasureByQubit.set(q, Math.min(firstMeasureByQubit.get(q) ?? Infinity, g.column))
  }
  const after = circuit.gates.filter((g) => {
    if (g.kind === 'M' || g.condition) return false
    return g.qubits.some((q) => {
      const measuredAt = firstMeasureByQubit.get(q)
      return measuredAt !== undefined && g.column > measuredAt
    })
  })
  if (after.length) {
    insights.push({
      id: 'after-measure',
      level: 'error',
      title: `${after.length} gate(s) act on a measured qubit`,
      detail: 'An unconditional gate after a measurement acts on a collapsed state.',
      fix: 'Move the measurement to the end, or make the gate classically controlled.',
      gateIds: after.map((g) => g.id),
    })
  }

  if (!measured.size && circuit.gates.some((g) => g.kind !== 'M')) {
    insights.push({
      id: 'no-measure',
      level: 'tip',
      title: 'No measurements yet',
      detail: 'The simulator still shows the exact statevector, but a real device only returns bitstrings.',
      fix: 'Add M gates (or press Run — the sampler measures everything at the end).',
    })
  }

  if (!circuit.gates.length) {
    insights.push({
      id: 'empty',
      level: 'tip',
      title: 'Empty circuit',
      detail: 'Drag a gate from the palette onto a wire, or load a template to explore a known circuit.',
    })
    return insights
  }

  const complexity = scoreComplexity(circuit)
  if (complexity.twoQubit > 12) {
    insights.push({
      id: 'deep',
      level: 'tip',
      title: `Depth ${complexity.depth} with ${complexity.twoQubit} two-qubit gates`,
      detail: 'Two-qubit gates dominate error rates on real hardware — every one is a chance for the state to decohere.',
      fix: 'Look for a decomposition with fewer entangling gates, or reduce the qubit count.',
    })
  }

  if (!sim) return insights

  const total = sim.probabilities.reduce((a, b) => a + b, 0) || 1
  if (Math.abs(total - 1) > 1e-6) {
    insights.push({
      id: 'norm',
      level: 'error',
      title: 'State is not normalised',
      detail: `Probabilities sum to ${total.toFixed(4)} instead of 1.`,
      fix: 'This usually means a gate matrix is degenerate — reset the circuit and rebuild the step.',
    })
  }

  const live = sim.probabilities.filter((p) => p > 1e-6)
  const summary = summarizeState(sim.state, n)

  if (live.length === 1 && n > 1 && circuit.gates.some((g) => g.kind !== 'M')) {
    insights.push({
      id: 'deterministic',
      level: 'tip',
      title: `Output is deterministic: |${bitString(sim.probabilities.indexOf(1), n)}⟩`,
      detail: 'Every run gives the same bitstring, so no superposition survives to the measurement.',
      fix: 'Add a Hadamard before the first entangling gate to create branches.',
    })
  }

  if (n === 2 && summary.concurrence > 0.9 && sim.steps.length > 2) {
    insights.push({
      id: 'entangled',
      level: 'win',
      title: 'Maximally entangled pair',
      detail: `Concurrence ${summary.concurrence.toFixed(2)} — the two qubits no longer have independent states.`,
    })
  } else if (n === 2 && summary.concurrence > 0.05) {
    insights.push({
      id: 'partial-entanglement',
      level: 'tip',
      title: `Partially entangled (C = ${summary.concurrence.toFixed(2)})`,
      detail: 'Only some of the amplitude is in correlated branches. A clean Bell pair reaches C = 1.',
    })
  }

  if (summary.maxEntanglementEntropy > 0.9) {
    insights.push({
      id: 'entropy-max',
      level: 'win',
      title: 'Maximum entanglement entropy',
      detail: `A ${summary.maxEntanglementEntropy.toFixed(2)}-bit cut means the reduced state is completely mixed.`,
    })
  }

  if (sim.noisy && sim.purity < 0.95) {
    insights.push({
      id: 'noise',
      level: 'warning',
      title: `Noise has mixed the state (purity ${sim.purity.toFixed(2)})`,
      detail: 'Depolarising and damping channels have leaked information into the environment.',
      fix: 'Switch the backend to ideal to separate algorithmic error from hardware error.',
    })
  }

  const dominant = summary.dominant[0]
  if (dominant && dominant.probability > 0.05 && dominant.probability < 0.95) {
    insights.push({
      id: 'dominant',
      level: 'tip',
      title: `Most likely outcome: |${dominant.label}⟩ at ${(dominant.probability * 100).toFixed(1)}%`,
      detail: summary.description,
    })
  }

  return insights
}

/** One-line verdict used in the composer footer and in tutor prompts. */
export function circuitVerdict(circuit: Circuit, sim?: SimResult): string {
  const errors = analyzeCircuit(circuit, sim).filter((i) => i.level === 'error')
  if (errors.length) return `${errors.length} problem${errors.length > 1 ? 's' : ''} to fix`
  if (!circuit.gates.length) return 'Ready when you are'
  const complexity = scoreComplexity(circuit)
  return `${complexity.gates} gates · depth ${complexity.depth} · ${complexity.twoQubit} entangling`
}

/** Which template best matches what the user seems to be building. */
export function matchTemplate(circuit: Circuit, templates: Array<{ id: string; build: () => Circuit }>): string | null {
  const key = (c: Circuit) =>
    [...c.gates]
      .sort((a, b) => a.column - b.column)
      .map((g) => `${g.kind}:${g.qubits.join(',')}:${g.params.map((p) => p.toFixed(3)).join(',')}`)
      .join('|')
  const target = key(circuit)
  for (const t of templates) if (key(t.build()) === target) return t.id
  return null
}

/** Human-readable gate inventory, used in the educator CSV and tutor context. */
export function gateInventory(circuit: Circuit): Array<{ kind: string; name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const g of circuit.gates) counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1)
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, name: GATE_LIBRARY[kind as keyof typeof GATE_LIBRARY]?.name ?? kind, count }))
    .sort((a, b) => b.count - a.count)
}
