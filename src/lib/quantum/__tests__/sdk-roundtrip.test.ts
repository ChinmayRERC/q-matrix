/**
 * Round-trip the exported Cirq / PennyLane programs through the real SDKs.
 *
 * Each exporter emits Python that prints the final state (Cirq) or the outcome
 * probabilities (PennyLane). This test runs that Python and compares it with the
 * browser engine on the same circuit, so an export cannot silently drift from
 * the simulator it claims to mirror.
 *
 * Both SDKs are optional. The tests skip when the package is not installed, so
 * CI without a quantum stack still runs the rest of the suite; the skip is
 * reported, not hidden.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { Circuit, Gate, GateCondition } from '../circuit'
import type { GateKind } from '../core'
import { toCirqPython, toPennyLanePython } from '../qasm'
import { simulate } from '../simulator'

const gate = (
  kind: GateKind,
  qubits: number[],
  params: number[] = [],
  column = 0,
  condition?: GateCondition,
): Gate => ({ id: `${kind}-${column}-${qubits.join('')}`, kind, qubits, params, column, condition })

const circuit = (id: string, numQubits: number, gates: Gate[]): Circuit => ({
  id,
  name: id,
  numQubits,
  gates: gates.map((g, i) => ({ ...g, column: i })),
})

const CASES: Circuit[] = [
  circuit('bell', 2, [gate('H', [0]), gate('CNOT', [0, 1])]),
  circuit('rotations', 2, [gate('RX', [0], [0.7]), gate('RY', [1], [1.1]), gate('CNOT', [1, 0])]),
  circuit('phases', 2, [gate('H', [0]), gate('S', [0]), gate('T', [1]), gate('CZ', [0, 1]), gate('SWAP', [0, 1])]),
  circuit('three-qubit', 3, [
    gate('H', [0]),
    gate('CNOT', [0, 1]),
    gate('CCX', [0, 1, 2]),
    gate('RZ', [2], [0.3]),
    gate('Sdg', [1]),
  ]),
]

const has = (module: string) => {
  try {
    execFileSync('python3', ['-c', `import ${module}`], { timeout: 30_000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

const hasCirq = has('cirq')
const hasPennyLane = has('pennylane')
const workdir = mkdtempSync(join(tmpdir(), 'qmatrix-roundtrip-'))
afterAll(() => rmSync(workdir, { recursive: true, force: true }))

/** Replace the exporter's trailing print with one that emits little-endian probs. */
function runProgram(name: string, source: string, n: number, lastLine: string, replacement: string): number[] {
  const lines = source.split('\n')
  const index = lines.lastIndexOf(lastLine)
  expect(index, `${name}: exporter shape changed`).toBeGreaterThan(-1)
  lines.splice(index, 1, replacement)

  const file = join(workdir, `${name}.py`)
  writeFileSync(file, lines.join('\n'))
  const output = execFileSync('python3', [file], { encoding: 'utf8', timeout: 120_000 })
  const last = output.trim().split('\n').pop() ?? '[]'
  const probs = JSON.parse(last) as number[]
  expect(probs).toHaveLength(1 << n)
  return probs
}

const littleEndian = (n: number) =>
  `[float(p[int(format(i, '0${n}b')[::-1], 2)]) for i in range(${1 << n})]`

describe('Cirq round-trip', () => {
  for (const c of CASES) {
    it.skipIf(!hasCirq)(`matches the browser engine: ${c.id}`, () => {
      const source = toCirqPython(c)
      const probs = runProgram(
        `cirq-${c.id}`,
        source,
        c.numQubits,
        'print(cirq.Simulator().simulate(circuit).final_state_vector)',
        `_p = abs(cirq.Simulator().simulate(circuit).final_state_vector) ** 2\nprint(${littleEndian(c.numQubits)})`,
      )
      const expected = simulate(c, { shots: 1 }).probabilities
      probs.forEach((p, i) => expect(p).toBeCloseTo(expected[i], 6))
    })
  }
})

describe('PennyLane round-trip', () => {
  for (const c of CASES) {
    it.skipIf(!hasPennyLane)(`matches the browser engine: ${c.id}`, () => {
      const source = toPennyLanePython(c)
      const probs = runProgram(
        `pennylane-${c.id}`,
        source,
        c.numQubits,
        'print(circuit())',
        `_p = circuit()\nprint(${littleEndian(c.numQubits)})`,
      )
      const expected = simulate(c, { shots: 1 }).probabilities
      probs.forEach((p, i) => expect(p).toBeCloseTo(expected[i], 6))
    })
  }
})
