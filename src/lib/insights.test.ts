import { describe, expect, it } from 'vitest'
import { addGate, emptyCircuit, type Circuit } from './quantum/circuit'
import { TEMPLATES } from './quantum/templates'
import {
  analyzeCircuit,
  cancellingPairs,
  circuitVerdict,
  gateInventory,
  matchTemplate,
  optimizeCircuit,
  scoreComplexity,
} from './insights'

const bell = (): Circuit => {
  let c = emptyCircuit(2, 'Bell')
  c = addGate(c, 'H', [0], 0)
  c = addGate(c, 'CNOT', [0, 1], 1)
  return c
}

describe('cancellingPairs', () => {
  it('finds two identical self-inverse gates in a row', () => {
    let c = emptyCircuit(1)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'H', [0], 1)
    const pairs = cancellingPairs(c)
    expect(pairs).toHaveLength(1)
    expect(pairs[0][0].column).toBe(0)
    expect(pairs[0][1].column).toBe(1)
  })

  it('does not pair gates when another gate touches the qubit in between', () => {
    let c = emptyCircuit(1)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'X', [0], 1)
    c = addGate(c, 'H', [0], 2)
    expect(cancellingPairs(c)).toHaveLength(0)
  })

  it('ignores non-self-inverse rotations', () => {
    let c = emptyCircuit(1)
    c = addGate(c, 'RX', [0], 0, [Math.PI / 2])
    c = addGate(c, 'RX', [0], 1, [Math.PI / 2])
    expect(cancellingPairs(c)).toHaveLength(0)
  })

  it('pairs multi-qubit gates with identical targets', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'CNOT', [0, 1], 0)
    c = addGate(c, 'CNOT', [0, 1], 1)
    expect(cancellingPairs(c)).toHaveLength(1)
  })
})

describe('optimizeCircuit', () => {
  it('removes cancelling pairs and compacts the columns', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'H', [0], 1)
    c = addGate(c, 'X', [1], 2)
    const { circuit, removed } = optimizeCircuit(c)
    expect(removed).toHaveLength(2)
    expect(circuit.gates).toHaveLength(1)
    expect(circuit.gates[0].kind).toBe('X')
    expect(circuit.gates[0].column).toBe(0)
  })

  it('returns the original circuit when there is nothing to remove', () => {
    const c = bell()
    const result = optimizeCircuit(c)
    expect(result.removed).toHaveLength(0)
    expect(result.circuit).toBe(c)
  })
})

describe('scoreComplexity', () => {
  it('counts gates, depth and two-qubit cost', () => {
    const score = scoreComplexity(bell())
    expect(score.gates).toBe(2)
    expect(score.depth).toBe(2)
    expect(score.twoQubit).toBe(1)
    expect(score.cost).toBe(11)
    expect(score.removable).toBe(0)
  })

  it('prices T gates above single-qubit gates', () => {
    let c = emptyCircuit(1)
    c = addGate(c, 'T', [0], 0)
    const withT = scoreComplexity(c)
    c = emptyCircuit(1)
    c = addGate(c, 'H', [0], 0)
    const withH = scoreComplexity(c)
    expect(withT.cost).toBeGreaterThan(withH.cost)
  })
})

describe('analyzeCircuit', () => {
  it('reports no errors for a valid Bell circuit', () => {
    const insights = analyzeCircuit(bell())
    expect(insights.filter((i) => i.level === 'error')).toHaveLength(0)
  })

  it('warns about cancelling pairs with a suggested fix', () => {
    let c = emptyCircuit(1)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'H', [0], 1)
    const insight = analyzeCircuit(c).find((i) => i.id === 'cancel-pairs')
    expect(insight).toBeDefined()
    expect(insight!.level).toBe('warning')
    expect(insight!.gateIds).toHaveLength(2)
    expect(insight!.fix).toMatch(/remove/i)
  })

  it('flags a structurally invalid gate', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'H', [0], 0)
    c = { ...c, gates: c.gates.map((g) => ({ ...g, qubits: [5] })) }
    const errors = analyzeCircuit(c).filter((i) => i.level === 'error')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].detail.length).toBeGreaterThan(0)
  })

  it('gives a verdict string for empty and populated circuits', () => {
    expect(circuitVerdict(emptyCircuit(2))).toBe('Ready when you are')
    expect(circuitVerdict(bell())).toContain('2 gates')
  })
})

describe('identity helpers', () => {
  it('matches a rebuilt template by gate sequence', () => {
    const built = TEMPLATES.find((t) => t.id === 'bell')!.build()
    expect(matchTemplate(built, TEMPLATES)).toBe('bell')
    expect(matchTemplate(addGate(emptyCircuit(1), 'X', [0], 0), TEMPLATES)).toBeNull()
  })

  it('inventories gates by kind, most frequent first', () => {
    let c = bell()
    c = addGate(c, 'H', [1], 2)
    const inventory = gateInventory(c)
    expect(inventory.find((g) => g.kind === 'H')!.count).toBe(2)
    expect(inventory.find((g) => g.kind === 'CNOT')!.count).toBe(1)
    expect(inventory[0].count).toBeGreaterThanOrEqual(inventory[inventory.length - 1].count)
    expect(inventory.every((g) => g.name.length > 0)).toBe(true)
  })
})


describe('optimizer and measurement analysis', () => {
  it('preserves parallel columns when compacting after a cancellation', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'H', [0], 1)
    c = addGate(c, 'X', [1], 0)
    const { circuit } = optimizeCircuit(c)
    expect(circuit.gates).toHaveLength(1)
    expect(circuit.gates[0].column).toBe(0)
  })

  it('does not flag classically controlled feed-forward as an error', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'M', [0], 1)
    c = addGate(c, 'X', [1], 2, undefined, { qubit: 0, value: 1 })
    expect(analyzeCircuit(c).filter((i) => i.level === 'error')).toHaveLength(0)
  })

  it('still flags an unconditional gate on a measured qubit', () => {
    let c = emptyCircuit(2)
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'M', [0], 1)
    c = addGate(c, 'X', [0], 2)
    expect(analyzeCircuit(c).find((i) => i.id === 'after-measure')).toBeDefined()
  })
})
