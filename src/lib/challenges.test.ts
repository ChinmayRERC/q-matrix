import { describe, expect, it } from 'vitest'
import { addGate, emptyCircuit, type Circuit } from './quantum/circuit'
import { CHALLENGES, challengeById, hintFor } from './challenges'

const build = (n: number, steps: Array<[Parameters<typeof addGate>[1], number[], number?, number[]?]>) => {
  let c = emptyCircuit(n)
  for (const [kind, qubits, column, params] of steps) c = addGate(c, kind, qubits, column, params)
  return c
}

const grade = (id: string, circuit: Circuit) => {
  const challenge = challengeById(id)
  expect(challenge).toBeDefined()
  return challenge!.grade(circuit)
}

describe('challenge catalogue', () => {
  it('has unique ids, hints, and metadata', () => {
    const ids = CHALLENGES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(10)
    for (const challenge of CHALLENGES) {
      expect(challenge.hints.length).toBeGreaterThanOrEqual(2)
      expect(challenge.xp).toBeGreaterThan(0)
      expect(challenge.topicIds.length).toBeGreaterThan(0)
    }
  })

  it('escalates hints with each attempt and then plateaus', () => {
    const challenge = CHALLENGES[0]
    expect(hintFor(challenge, 0)).toBe(challenge.hints[0])
    expect(hintFor(challenge, 1)).toBe(challenge.hints[1])
    expect(hintFor(challenge, 99)).toBe(challenge.hints[challenge.hints.length - 1])
  })

  it('grades an empty circuit without throwing', () => {
    for (const challenge of CHALLENGES) {
      const result = challenge.grade(emptyCircuit(challenge.qubits))
      expect(result.passed).toBe(false)
      expect(result.checks.length).toBeGreaterThan(0)
      expect(result.hint.length).toBeGreaterThan(0)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }
  })
})

describe('starter challenges accept textbook solutions', () => {
  it('fair coin: H on one qubit', () => {
    const result = grade('coin-flip', build(1, [['H', [0], 0]]))
    expect(result.passed).toBe(true)
  })

  it('fair coin: rejects a deterministic circuit', () => {
    const result = grade('coin-flip', build(1, [['X', [0], 0]]))
    expect(result.passed).toBe(false)
    expect(result.checks.some((c) => !c.ok)).toBe(true)
  })

  it('Bell pair: H then CNOT', () => {
    const result = grade('bell-pair', build(2, [
      ['H', [0], 0],
      ['CNOT', [0, 1], 1],
    ]))
    expect(result.passed).toBe(true)
  })

  it('anti-Bell: Bell pair then X on q0', () => {
    const result = grade('anti-bell', build(2, [
      ['H', [0], 0],
      ['CNOT', [0, 1], 1],
      ['X', [0], 2],
    ]))
    expect(result.passed).toBe(true)
  })

  it('GHZ: spread the correlation across three qubits', () => {
    const result = grade('ghz', build(3, [
      ['H', [0], 0],
      ['CNOT', [0, 1], 1],
      ['CNOT', [1, 2], 2],
    ]))
    expect(result.passed).toBe(true)
  })

  it('phase wizard: H then S', () => {
    const result = grade('phase-wizard', build(1, [
      ['H', [0], 0],
      ['S', [0], 1],
    ]))
    expect(result.passed).toBe(true)
  })

  it('CZ entangler: H on both qubits then CZ', () => {
    const result = grade('cz-entangler', build(2, [
      ['H', [0], 0],
      ['H', [1], 0],
      ['CZ', [0, 1], 1],
    ]))
    expect(result.passed).toBe(true)
  })

  it('no-clone: reproduces the failure mode with H and CNOT', () => {
    const result = grade('no-clone', build(2, [
      ['H', [0], 0],
      ['CNOT', [0, 1], 1],
    ]))
    expect(result.passed).toBe(true)
  })
})

describe('advanced challenges', () => {
  it('Grover: one iteration marks |11>', () => {
    const steps: Array<[Parameters<typeof addGate>[1], number[], number?]> = [
      ['H', [0], 0],
      ['H', [1], 0],
      ['CZ', [0, 1], 1],
      ['H', [0], 2],
      ['H', [1], 2],
      ['X', [0], 3],
      ['X', [1], 3],
      ['CZ', [0, 1], 4],
      ['X', [0], 5],
      ['X', [1], 5],
      ['H', [0], 6],
      ['H', [1], 6],
    ]
    const result = grade('grover-hit', build(2, steps))
    expect(result.passed).toBe(true)
  })

  it('QFT on |000> gives a flat distribution', () => {
    const half = Math.PI / 2
    const quarter = Math.PI / 4
    const result = grade('qft-uniform', build(3, [
      ['H', [2], 0],
      ['CRZ', [2, 1], 1, [half]],
      ['H', [1], 2],
      ['CRZ', [2, 0], 3, [quarter]],
      ['CRZ', [1, 0], 4, [half]],
      ['H', [0], 5],
      ['SWAP', [2, 0], 6],
    ]))
    expect(result.passed).toBe(true)
  })

  it('teleportation: unconditional corrections fail the feed-forward check', () => {
    const result = grade('teleport', build(3, [
      ['RY', [0], 0, [Math.PI / 3]],
      ['H', [1], 1],
      ['CNOT', [1, 2], 2],
      ['CNOT', [0, 1], 3],
      ['H', [0], 4],
      ['M', [0], 5],
      ['M', [1], 6],
      ['X', [2], 7],
      ['Z', [2], 8],
      ['M', [2], 9],
    ]))
    expect(result.passed).toBe(false)
    expect(result.checks.find((c) => c.label === 'Classical feed-forward present')!.ok).toBe(false)
  })

  it('teleportation: classical feed-forward solves it', () => {
    let c = emptyCircuit(3)
    c = addGate(c, 'RY', [0], 0, [Math.PI / 3])
    c = addGate(c, 'H', [1], 1)
    c = addGate(c, 'CNOT', [1, 2], 2)
    c = addGate(c, 'CNOT', [0, 1], 3)
    c = addGate(c, 'H', [0], 4)
    c = addGate(c, 'M', [0], 5)
    c = addGate(c, 'M', [1], 6)
    c = addGate(c, 'X', [2], 7, undefined, { qubit: 1, value: 1 })
    c = addGate(c, 'Z', [2], 8, undefined, { qubit: 0, value: 1 })
    c = addGate(c, 'M', [2], 9)

    const result = grade('teleport', c)
    expect(result.passed).toBe(true)
    expect(result.checks.every((check) => check.ok)).toBe(true)
  })
})
