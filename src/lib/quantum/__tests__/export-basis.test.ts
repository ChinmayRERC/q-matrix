import { describe, expect, it } from 'vitest'
import { toQiskitPython } from '../qasm'
import { emptyCircuit, addGate } from '../circuit'

describe('ideal export basis', () => {
  it('never emits the placeholder "any" basis gate', () => {
    let c = emptyCircuit(2, 'bell')
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'CNOT', [0, 1], 1)
    const code = toQiskitPython(c, 'ideal')
    expect(code).not.toContain('"any"')
    expect(code).toContain('basis_gates=["rz", "sx", "x", "cx"]')
  })
})
