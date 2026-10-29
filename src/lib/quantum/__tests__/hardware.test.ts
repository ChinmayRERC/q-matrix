import { describe, expect, it } from 'vitest'
import { addGate, emptyCircuit } from '../circuit'
import {
  couplingDistance,
  couplingFor,
  DEVICES,
  deviceNoise,
  evaluateHardware,
  formatDuration,
  HERON_EDGES,
  nativeTwoQubitCost,
} from '../hardware'
import { toQiskitPython } from '../qasm'

const bell = (q0 = 0, q1 = 1) => {
  let c = emptyCircuit(6, 'bell')
  c = addGate(c, 'H', [q0], 0)
  c = addGate(c, 'CNOT', [q0, q1], 1)
  return c
}

describe('hardware profiles', () => {
  it('routes distant pairs on a nearest-neighbour lattice', () => {
    const report = evaluateHardware(bell(0, 5), 'ibm-heron')
    // 0 - 1 - 3 - 4 - 5 is four hops, so three SWAPs and nine extra CXs.
    expect(couplingDistance(6, HERON_EDGES, 0, 5)).toBe(4)
    expect(report.swaps).toBe(3)
    expect(report.programTwoQubit).toBe(1)
    expect(report.nativeTwoQubit).toBe(1 + 3 * 3)
    expect(report.verdict).toContain('SWAP')
  })

  it('adds no routing on an all-to-all device', () => {
    const report = evaluateHardware(bell(0, 5), 'anviqa-ion')
    expect(report.swaps).toBe(0)
    expect(report.nativeTwoQubit).toBe(1)
    expect(report.overhead).toBe(0)
  })

  it('keeps the ideal profile exact', () => {
    const report = evaluateHardware(bell(), 'ideal')
    expect(report.device.id).toBe('ideal')
    expect(report.nativeTwoQubit).toBe(1)
    expect(report.estimatedMs).toBe(0)
    expect(deviceNoise('ideal')).toBeUndefined()
  })

  it('decomposes multi-qubit gates before routing', () => {
    let c = emptyCircuit(3, 'decompose')
    c = addGate(c, 'CCX', [0, 1, 2], 0)
    c = addGate(c, 'SWAP', [0, 1], 1)
    expect(nativeTwoQubitCost(c.gates[0])).toBe(6)
    expect(nativeTwoQubitCost(c.gates[1])).toBe(3)
    const report = evaluateHardware(c, 'ibm-heron')
    expect(report.programTwoQubit).toBe(2)
    // CCX on adjacent qubits stays 6; SWAP on adjacent qubits stays 3.
    expect(report.nativeTwoQubit).toBe(9)
  })

  it('builds a complete coupling map for all-to-all devices', () => {
    expect(couplingFor('anviqa-neutral', 3)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ])
    expect(couplingFor('ibm-heron', 3)).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(couplingFor('custom', 3)).toEqual([])
  })

  it('formats timings for humans', () => {
    expect(formatDuration(0)).toBe('instant')
    expect(formatDuration(0.0001)).toBe('100 ns')
    expect(formatDuration(0.2)).toBe('200 µs')
    expect(formatDuration(2.5)).toBe('2.50 ms')
  })

  it('keeps a one-qubit basis Qiskit can transpile H into', () => {
    // Without rx/sx, Qiskit cannot translate h and the generated script fails.
    for (const device of Object.values(DEVICES)) {
      if (device.id === 'ideal') continue // ideal falls back to Qiskit's default basis
      expect(device.basis.some((g) => g === 'rx' || g === 'sx')).toBe(true)
    }
  })
})

describe('Qiskit 2.x pattern export', () => {
  it('writes the four patterns and the device coupling map', () => {
    const code = toQiskitPython(bell(0, 2), 'ibm-heron')
    expect(code).toContain('1. MAP')
    expect(code).toContain('2. OPTIMIZE')
    expect(code).toContain('3. EXECUTE')
    expect(code).toContain('4. POST-PROCESS')
    expect(code).toContain('generate_preset_pass_manager(optimization_level=2')
    expect(code).toContain('coupling_map=[[0, 1], [1, 2], [1, 3], [3, 4], [4, 5]]')
    expect(code).toContain('SamplerV2 as Sampler')
    expect(code).toContain('Target: IBM Heron')
  })

  it('keeps a statevector post-process when there is no measurement', () => {
    const code = toQiskitPython(bell())
    expect(code).toContain('Statevector.from_instruction(isa)')
    expect(code).not.toContain('result.get_counts()')
  })
})
