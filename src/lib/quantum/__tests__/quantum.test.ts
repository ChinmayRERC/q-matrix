import { describe, expect, it } from 'vitest'
import { addGate, bitString, emptyCircuit, ketLabel, validateCircuit, type Circuit } from '../circuit'
import { simulate, NOISE_PRESETS, marginalProbabilities } from '../simulator'
import { parseQasm, toCirqPython, toPennyLanePython, toQasm, toQiskitPython } from '../qasm'
import { concurrence, entanglementEntropy, fidelity, summarizeDensity, summarizeState } from '../analysis'
import { TEMPLATES, templateById } from '../templates'

// All indices are little-endian: qubit 0 is the least significant bit.
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol

function build(numQubits: number, steps: Array<[string, number[]]>): Circuit {
  let c = emptyCircuit(numQubits, 'test')
  steps.forEach(([kind, qubits], i) => {
    c = addGate(c, kind as never, qubits, i)
  })
  return c
}

/** Parse a "q2 q1 q0" histogram key back into a little-endian basis index. */
const indexOfKey = (key: string): number => parseInt([...key].reverse().join(''), 2)

/** Probability that qubit `q` reads 1 in a histogram. */
function probOne(counts: Record<string, number>, q: number): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  let one = 0
  for (const [key, n] of Object.entries(counts)) if ((indexOfKey(key) >> q) & 1) one += n
  return one / total
}

describe('single-qubit gates', () => {
  it('H|0> = (|0>+|1>)/sqrt(2)', () => {
    const r = simulate(build(1, [['H', [0]]]))
    expect(close(r.probabilities[0], 0.5)).toBe(true)
    expect(close(r.probabilities[1], 0.5)).toBe(true)
    expect(close(r.state[0].re, Math.SQRT1_2)).toBe(true)
    expect(close(r.state[1].re, Math.SQRT1_2)).toBe(true)
  })

  it('X flips the basis state', () => {
    const r = simulate(build(1, [['X', [0]]]))
    expect(close(r.probabilities[0], 0)).toBe(true)
    expect(close(r.probabilities[1], 1)).toBe(true)
  })

  it('Z leaves |0> and flips the sign of |1>', () => {
    const r = simulate(build(1, [['X', [0]], ['Z', [0]]]))
    expect(close(r.probabilities[1], 1)).toBe(true)
    expect(close(r.state[1].re, -1)).toBe(true)
    expect(close(r.state[1].im, 0)).toBe(true)
  })

  it('HZH maps |0> to |1>', () => {
    const r = simulate(build(1, [['H', [0]], ['Z', [0]], ['H', [0]]]))
    expect(close(r.probabilities[1], 1)).toBe(true)
  })

  it('S then T accumulates the right phase', () => {
    const r = simulate(build(1, [['H', [0]], ['S', [0]], ['T', [0]]]))
    // |+> -> (|0> + i|1>)/sqrt(2) -> (|0> + e^{i3pi/4}|1>)/sqrt(2)
    expect(close(r.probabilities[0], 0.5)).toBe(true)
    expect(close(r.probabilities[1], 0.5)).toBe(true)
    expect(close(Math.atan2(r.state[1].im, r.state[1].re), (3 * Math.PI) / 4)).toBe(true)
  })

  it('RX(pi) flips |0> to |1>', () => {
    const r = simulate({
      ...emptyCircuit(1, 'rx'),
      gates: [{ id: 'x', kind: 'RX', qubits: [0], params: [Math.PI], column: 0 }],
    })
    expect(close(r.probabilities[1], 1)).toBe(true)
  })

  it('RY(theta) prepares cos(theta/2)|0> + sin(theta/2)|1>', () => {
    const r = simulate({
      ...emptyCircuit(1, 'ry'),
      gates: [{ id: 'y', kind: 'RY', qubits: [0], params: [Math.PI / 2], column: 0 }],
    })
    expect(close(r.probabilities[0], 0.5)).toBe(true)
    expect(close(r.state[1].re, Math.SQRT1_2)).toBe(true)
  })

  it('RZ changes only the phase', () => {
    const r = simulate({
      ...emptyCircuit(1, 'rz'),
      gates: [{ id: 'z', kind: 'RZ', qubits: [0], params: [Math.PI / 2], column: 0 }],
    })
    expect(close(r.probabilities[0], 1)).toBe(true)
    // RZ(theta) = diag(e^{-i theta/2}, e^{i theta/2})
    expect(close(r.state[0].re, Math.cos(Math.PI / 4))).toBe(true)
    expect(close(r.state[0].im, -Math.sin(Math.PI / 4))).toBe(true)
  })
})

describe('multi-qubit gates', () => {
  it('CNOT flips the target only when the control is |1>', () => {
    const r = simulate(build(2, [['X', [0]], ['CNOT', [0, 1]]]))
    expect(close(r.probabilities[3], 1)).toBe(true) // q1 = q0 = 1
    expect(close(r.probabilities[2], 0)).toBe(true)
  })

  it('CNOT is its own inverse', () => {
    const once = simulate(build(2, [['X', [0]], ['CNOT', [0, 1]]]))
    const twice = simulate(build(2, [['X', [0]], ['CNOT', [0, 1]], ['CNOT', [0, 1]]]))
    expect(close(once.probabilities[3], 1)).toBe(true)
    expect(close(twice.probabilities[1], 1)).toBe(true)
  })

  it('SWAP exchanges the two qubits', () => {
    const r = simulate(build(2, [['X', [0]], ['SWAP', [0, 1]]]))
    expect(close(r.probabilities[2], 1)).toBe(true) // q1 = 1
  })

  it('Toffoli fires only when both controls are |1>', () => {
    const r = simulate(build(3, [['X', [0]], ['X', [1]], ['CCX', [0, 1, 2]]]))
    expect(close(r.probabilities[7], 1)).toBe(true) // q2 = q1 = q0 = 1
  })

  it('Toffoli does not fire with one control', () => {
    const r = simulate(build(3, [['X', [0]], ['CCX', [0, 1, 2]]]))
    expect(close(r.probabilities[1], 1)).toBe(true) // only q0 = 1
  })

  it('Fredkin swaps the targets only when the control is |1>', () => {
    const r = simulate(build(3, [['X', [0]], ['X', [1]], ['CSWAP', [0, 1, 2]]]))
    // control q0 = 1, so |q1=1,q2=0> becomes |q1=0,q2=1> -> index 5
    expect(close(r.probabilities[5], 1)).toBe(true)
  })
})

describe('Bell state and entanglement', () => {
  const bell = build(2, [['H', [0]], ['CNOT', [0, 1]]])

  it('produces the equal superposition', () => {
    const r = simulate(bell)
    expect(close(r.probabilities[0], 0.5)).toBe(true)
    expect(close(r.probabilities[1], 0)).toBe(true)
    expect(close(r.probabilities[2], 0)).toBe(true)
    expect(close(r.probabilities[3], 0.5)).toBe(true)
  })

  it('is maximally entangled by every measure', () => {
    const r = simulate(bell)
    expect(close(entanglementEntropy(r.state, 2, [0]), 1)).toBe(true)
    expect(close(concurrence(r.state), 1)).toBe(true)
    const summary = summarizeState(r.state, 2)
    expect(summary.entangled).toBe(true)
    expect(close(summary.purity, 1)).toBe(true)
  })

  it('samples only 00 and 11', () => {
    const r = simulate(bell, { shots: 4000, seed: 7 })
    expect(Object.keys(r.counts).sort()).toEqual(['00', '11'])
    const ratio = r.counts['00'] / (r.counts['00'] + r.counts['11'])
    expect(Math.abs(ratio - 0.5)).toBeLessThan(0.05)
  })
})

describe('GHZ and W states', () => {
  it('GHZ on 3 qubits is fully entangled', () => {
    const r = simulate(build(3, [['H', [0]], ['CNOT', [0, 1]], ['CNOT', [1, 2]]]))
    expect(close(r.probabilities[0], 0.5)).toBe(true)
    expect(close(r.probabilities[7], 0.5)).toBe(true)
    expect(close(r.probabilities[1], 0)).toBe(true)
    expect(close(entanglementEntropy(r.state, 3, [0, 1]), 1)).toBe(true)
  })

  it('W state spreads over exactly three basis states', () => {
    const r = simulate(templateById('w-state')!.build())
    expect(close(r.probabilities[1], 1 / 3)).toBe(true) // q0 = 1
    expect(close(r.probabilities[2], 1 / 3)).toBe(true) // q1 = 1
    expect(close(r.probabilities[4], 1 / 3)).toBe(true) // q2 = 1
    const live = r.probabilities.filter((p) => p > 1e-9)
    expect(live.length).toBe(3)
  })
})

describe('algorithms', () => {
  it('Grover amplifies the marked state on 2 qubits', () => {
    const r = simulate(templateById('grover')!.build())
    expect(close(r.probabilities[3], 1, 1e-9)).toBe(true) // |11>
  })

  it('Deutsch-Jozsa reads a balanced function as non-zero', () => {
    const r = simulate(templateById('deutsch-jozsa')!.build())
    // f = x0 XOR x1 is balanced -> the input register reads 11 (index 3).
    expect(close(r.probabilities[3], 1, 1e-9)).toBe(true)
  })

  it('Bernstein-Vazirani recovers the hidden string 01', () => {
    const r = simulate(templateById('bernstein-vazirani')!.build())
    // Hidden bits: q0 = 1, q1 = 0 -> index 1, i.e. |10> with q0 leftmost.
    expect(close(r.probabilities[1], 1, 1e-9)).toBe(true)
  })

  it('QFT on 3 qubits maps |000> to the uniform superposition', () => {
    const r = simulate(templateById('qft')!.build())
    for (let i = 0; i < 8; i++) expect(close(r.probabilities[i], 1 / 8)).toBe(true)
  })

  it('teleportation moves RY(pi/3) from q0 to q2', () => {
    const r = simulate(templateById('teleportation')!.build(), { shots: 4000, seed: 11 })
    // cos^2(pi/6) = 0.75 on |0>, so q2 reads 1 about 25% of the time.
    expect(Math.abs(probOne(r.counts, 2) - 0.25)).toBeLessThan(0.03)
    expect(r.counts).toBeDefined()
    expect(r.steps.length).toBe(10)
  })

  it('teleportation corrections are classically controlled', () => {
    const circuit = templateById('teleportation')!.build()
    const conditional = circuit.gates.filter((g) => g.condition)
    expect(conditional.length).toBe(2)
    expect(conditional.map((g) => `${g.kind}:${g.condition!.qubit}=${g.condition!.value}`).sort()).toEqual([
      'X:1=1',
      'Z:0=1',
    ])
    // Both corrections sit after the measurements that drive them.
    const lastMeasureCol = Math.max(
      ...circuit.gates.filter((g) => g.kind === 'M' && g.qubits[0] !== 2).map((g) => g.column),
    )
    for (const gate of conditional) expect(gate.column).toBeGreaterThan(lastMeasureCol)
    expect(validateCircuit(circuit).filter((i) => i.level === 'error')).toEqual([])
  })

  it('SWAP test distinguishes |1> from |+>', () => {
    const r = simulate(templateById('swap-test')!.build())
    // P(q0 = 0) = (1 + |<1|+>|^2) / 2 = 0.75, so P(q0 = 1) = 0.25.
    expect(close(probOne(r.counts, 0), 0.25, 0.05)).toBe(true)
  })

  it('phase kickback leaves a negative amplitude on |11>', () => {
    const r = simulate(templateById('phase-kickback')!.build())
    expect(close(r.state[1].re, Math.SQRT1_2)).toBe(true)
    expect(close(r.state[3].re, -Math.SQRT1_2)).toBe(true)
  })
})

describe('analysis helpers', () => {
  it('computes fidelity between identical states', () => {
    const a = simulate(build(1, [['H', [0]]])).state
    expect(close(fidelity(a, a), 1)).toBe(true)
  })

  it('reports zero concurrence for a product state', () => {
    const r = simulate(build(2, [['H', [0]], ['H', [1]]]))
    expect(close(concurrence(r.state), 0)).toBe(true)
  })

  it('reports partial concurrence for a weighted Bell state', () => {
    const r = simulate({
      ...emptyCircuit(2, 'partial'),
      gates: [
        { id: 'a', kind: 'RY', qubits: [0], params: [Math.PI / 3], column: 0 },
        { id: 'b', kind: 'CNOT', qubits: [0, 1], params: [], column: 1 },
      ],
    })
    // (cos(pi/6)|00> + sin(pi/6)|11>) -> C = 2 * cos * sin = sin(pi/3)
    expect(close(concurrence(r.state), Math.sin(Math.PI / 3))).toBe(true)
  })

  it('computes marginal distributions', () => {
    const probs = [0.25, 0.25, 0.25, 0.25]
    const m = marginalProbabilities(probs, 4, [1])
    expect(close(m[0], 0.5)).toBe(true)
    expect(close(m[1], 0.5)).toBe(true)
  })
})

describe('noise models', () => {
  it('depolarising noise reduces the purity of a state', () => {
    const bell = build(2, [['H', [0]], ['CNOT', [0, 1]]])
    const ideal = simulate(bell)
    const noisy = simulate(bell, { noise: NOISE_PRESETS.heavy, seed: 3 })
    expect(close(ideal.purity, 1)).toBe(true)
    expect(noisy.noisy).toBe(true)
    expect(noisy.purity).toBeLessThan(0.999)
    expect(noisy.rho).toBeDefined()
  })

  it('readout error perturbs the measurement distribution', () => {
    const bell = build(2, [['H', [0]], ['CNOT', [0, 1]]])
    const r = simulate(bell, { shots: 2000, seed: 5, noise: NOISE_PRESETS.heavy })
    expect(Object.keys(r.counts).length).toBeGreaterThan(2)
  })
})

describe('QASM round-trip', () => {
  it('serialises and parses back to an equivalent circuit', () => {
    const original = build(2, [['H', [0]], ['CNOT', [0, 1]], ['M', [0]], ['M', [1]]])
    const qasm = toQasm(original)
    const { circuit, errors } = parseQasm(qasm)
    expect(errors).toEqual([])
    expect(circuit.numQubits).toBe(2)
    expect(circuit.gates.length).toBe(original.gates.length)

    const before = simulate(original)
    const after = simulate(circuit)
    for (let i = 0; i < before.probabilities.length; i++) {
      expect(close(before.probabilities[i], after.probabilities[i], 1e-9)).toBe(true)
    }
  })

  it('parses rotation angles', () => {
    const { circuit, errors } = parseQasm('OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[1];\nrx(pi/2) q[0];')
    expect(errors).toEqual([])
    expect(circuit.gates[0].kind).toBe('RX')
    expect(close(circuit.gates[0].params[0], Math.PI / 2)).toBe(true)
  })

  it('round-trips ry, rz and u', () => {
    const src = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[1];\nry(pi/3) q[0];\nrz(pi/4) q[0];\nu(pi/2,0,pi) q[0];'
    const { circuit, errors } = parseQasm(src)
    expect(errors).toEqual([])
    expect(circuit.gates.map((g) => g.kind)).toEqual(['RY', 'RZ', 'U'])
  })

  it('maps multiple quantum register declarations onto distinct qubits', () => {
    const src = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[2];',
      'qreg r[2];',
      'h q[0];',
      'x r[0];',
      'measure r -> c;',
    ].join('\n')
    const { circuit, errors, warnings } = parseQasm(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(circuit.numQubits).toBe(4)
    expect(circuit.gates.map((g) => [g.kind, g.qubits[0]])).toEqual([
      ['H', 0],
      ['X', 2],
      ['M', 2],
      ['M', 3],
    ])
  })

  it('parses whole-register measurement into one gate per qubit', () => {
    const src = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\ncreg c[3];\nmeasure q -> c;'
    const { circuit, errors, warnings } = parseQasm(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(circuit.gates.map((g) => g.kind)).toEqual(['M', 'M', 'M'])
    expect(circuit.gates.map((g) => g.qubits[0])).toEqual([0, 1, 2])
  })

  it('warns instead of silently dropping an unresolvable measurement', () => {
    const { circuit, warnings } = parseQasm('OPENQASM 2.0;\nqreg q[1];\nmeasure nope -> c;')
    expect(circuit.gates).toHaveLength(0)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('round-trips classical feed-forward through per-bit registers', () => {
    let original = emptyCircuit(2, 'feed-forward')
    original = addGate(original, 'H', [0], 0)
    original = addGate(original, 'M', [0], 1)
    original = addGate(original, 'X', [1], 2, undefined, { qubit: 0, value: 1 })

    const qasm = toQasm(original)
    expect(qasm).toContain('creg c0[1];')
    expect(qasm).toContain('if(c0==1) x q[1];')

    const { circuit, errors, warnings } = parseQasm(qasm)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(circuit.gates).toHaveLength(3)
    expect(circuit.gates[2].condition).toEqual({ qubit: 0, value: 1 })
  })

  it('imports the standard single-register if(c==n) form', () => {
    const src = [
      'OPENQASM 2.0;',
      'include "qelib1.inc";',
      'qreg q[2];',
      'creg c[2];',
      'h q[0];',
      'measure q[0] -> c[0];',
      'if(c==1) x q[1];',
    ].join('\n')
    const { circuit, errors, warnings } = parseQasm(src)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(circuit.gates.at(-1)?.condition).toEqual({ qubit: 0, value: 1 })
  })

  it('reports unknown instructions', () => {
    const { errors } = parseQasm('foo q[0];')
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('step-through execution', () => {
  it('records one snapshot per gate', () => {
    const c = build(2, [['H', [0]], ['CNOT', [0, 1]]])
    const r = simulate(c)
    expect(r.steps.length).toBe(2)
    expect(close(r.steps[0].probabilities[0], 0.5)).toBe(true)
    expect(close(r.steps[1].probabilities[3], 0.5)).toBe(true)
  })

  it('exposes every template as a valid circuit', () => {
    for (const t of TEMPLATES) {
      const circuit = t.build()
      const errors = validateCircuit(circuit).filter((i) => i.level === 'error')
      expect({ id: t.id, errors }).toEqual({ id: t.id, errors: [] })
      const r = simulate(circuit, { shots: 100, seed: 1 })
      const total = r.probabilities.reduce((a, b) => a + b, 0)
      expect({ id: t.id, total: close(total, 1, 1e-9) }).toEqual({ id: t.id, total: true })
    }
  })
})


describe('basis labels', () => {
  it('uses little-endian labels consistently for kets and histograms', () => {
    expect(bitString(1, 2)).toBe('10')
    expect(ketLabel(1, 2)).toBe('|10⟩')
    expect(bitString(6, 3)).toBe('011')
    expect(ketLabel(6, 3)).toBe('|011⟩')
  })
})

describe('mixed-state concurrence', () => {
  it('reports one for a noisy Bell state and zero for a classically correlated mixture', () => {
    const bell = new Array(16).fill({ re: 0, im: 0 })
    bell[0] = { re: 0.5, im: 0 }
    bell[3] = { re: 0.5, im: 0 }
    bell[12] = { re: 0.5, im: 0 }
    bell[15] = { re: 0.5, im: 0 }
    expect(close(summarizeDensity(bell, 2).concurrence, 1, 1e-6)).toBe(true)

    const classical = new Array(16).fill({ re: 0, im: 0 })
    classical[0] = { re: 0.5, im: 0 }
    classical[15] = { re: 0.5, im: 0 }
    expect(summarizeDensity(classical, 2).concurrence).toBeLessThan(1e-6)
  })
})

describe('SDK export snippets', () => {
  it('uses valid Qiskit methods and parameter order', () => {
    let c = emptyCircuit(2, 'exports')
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'CNOT', [0, 1], 1)
    c = addGate(c, 'CRX', [0, 1], 2, [Math.PI / 2])
    const code = toQiskitPython(c)
    expect(code).toContain('qc.h(q[0])')
    expect(code).toContain('qc.cx(q[0], q[1])')
    expect(code).toContain('qc.crx(math.pi / 2, q[0], q[1])')
    expect(code).not.toContain('qc.Hadamard')
  })

  it('uses valid Cirq and PennyLane calls', () => {
    let c = emptyCircuit(1, 'rotations')
    c = addGate(c, 'RX', [0], 0, [Math.PI / 2])
    c = addGate(c, 'Sdg', [0], 1)
    expect(toCirqPython(c)).toContain('cirq.rx(math.pi / 2)(q0)')
    expect(toPennyLanePython(c)).toContain('qml.RX(math.pi / 2, wires=0)')
    expect(toPennyLanePython(c)).toContain('qml.adjoint(qml.S)(wires=0)')
  })
})

describe('QASM column reconstruction', () => {
  it('keeps independent gates in the same moment after a round trip', () => {
    let c = emptyCircuit(2, 'parallel')
    c = addGate(c, 'H', [0], 0)
    c = addGate(c, 'X', [1], 0)
    const parsed = parseQasm(toQasm(c)).circuit
    expect(parsed.gates.map((g) => g.column)).toEqual([0, 0])
  })
})
