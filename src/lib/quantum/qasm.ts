import { GATE_LIBRARY, uMat, type GateKind } from './core'
import { addGate, emptyCircuit, type Circuit, type Gate, type GateCondition } from './circuit'

// ---------------------------------------------------------------------------
// OpenQASM 2.0 serialisation
// ---------------------------------------------------------------------------

const QASM_NAME: Record<string, GateKind> = {
  h: 'H',
  x: 'X',
  y: 'Y',
  z: 'Z',
  s: 'S',
  sdg: 'Sdg',
  t: 'T',
  tdg: 'Tdg',
  id: 'I',
  cx: 'CNOT',
  cnot: 'CNOT',
  cz: 'CZ',
  swap: 'SWAP',
  ccx: 'CCX',
  toffoli: 'CCX',
  cswap: 'CSWAP',
  fredkin: 'CSWAP',
  crx: 'CRX',
  cry: 'CRY',
  crz: 'CRZ',
  rx: 'RX',
  ry: 'RY',
  rz: 'RZ',
  u: 'U',
}

export function toQasm(circuit: Circuit, options: { creg?: boolean } = {}): string {
  const lines: string[] = ['OPENQASM 2.0;', 'include "qelib1.inc";']
  lines.push(`qreg q[${circuit.numQubits}];`)

  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  // Feed-forward needs one classical bit per measured qubit so conditions can be
  // expressed with the standard `if (creg == value)` form.
  const perBitRegisters = ordered.some((gate) => gate.condition)
  if (options.creg !== false) {
    if (perBitRegisters) {
      for (let i = 0; i < circuit.numQubits; i++) lines.push(`creg c${i}[1];`)
    } else {
      lines.push(`creg c[${circuit.numQubits}];`)
    }
  }

  for (const gate of ordered) {
    if (gate.kind === 'M') {
      const target = perBitRegisters
        ? `c${gate.qubits[0]}[0]`
        : `c[${gate.qubits[0]}]`
      lines.push(`measure q[${gate.qubits[0]}] -> ${target};`)
      continue
    }
    if (gate.kind === 'BARRIER') {
      lines.push(`barrier q[${gate.qubits[0]}];`)
      continue
    }
    const name = Object.keys(QASM_NAME).find((k) => QASM_NAME[k] === gate.kind) ?? gate.kind.toLowerCase()
    const args = gate.qubits.map((q) => `q[${q}]`).join(',')
    const params = gate.params.length ? `(${gate.params.map(fmtParam).join(', ')})` : ''
    const condition = gate.condition ? `if(c${gate.condition.qubit}==${gate.condition.value}) ` : ''
    lines.push(`${condition}${name}${params} ${args};`)
  }
  return lines.join('\n')
}

function fmtParam(rad: number): string {
  if (Math.abs(rad - Math.PI) < 1e-9) return 'pi'
  if (Math.abs(rad - Math.PI / 2) < 1e-9) return 'pi/2'
  if (Math.abs(rad - Math.PI / 4) < 1e-9) return 'pi/4'
  if (Math.abs(rad + Math.PI) < 1e-9) return '-pi'
  if (Math.abs(rad + Math.PI / 2) < 1e-9) return '-pi/2'
  return String(Number(rad.toFixed(6)))
}

// ---------------------------------------------------------------------------
// OpenQASM 2.0 parsing
// ---------------------------------------------------------------------------

export interface QasmParseResult {
  circuit: Circuit
  errors: string[]
  warnings: string[]
}

const PARAM_RE = /^([a-zA-Z_][\w]*)\s*(?:\(([^)]*)\))?\s*(.*)$/

export function parseQasm(source: string): QasmParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  let circuit = emptyCircuit(2, 'Imported circuit')

  const stripped = source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').replace(/#.*$/, '').trim())
    .filter(Boolean)

  let numQubits = 0
  let numClbits = 0
  // OpenQASM permits multiple quantum registers. Keep their offsets so
  // `r[0]` in a four-qubit program addresses q2, not q0.
  const qregs = new Map<string, { base: number; size: number }>()
  const pending: { kind: GateKind; qubits: number[]; params: number[]; condition?: GateCondition }[] = []
  // Classical register name → first qubit it stores, and its width. Needed to
  // translate `if (creg == value)` into a single-qubit gate condition.
  const cregBase = new Map<string, number>()
  const cregWidth = new Map<string, number>()

  for (const line of stripped) {
    let statement = line.replace(/;$/, '').trim()
    if (!statement) continue

    // Classical feed-forward: `if (c==1) x q[2];`
    let condition: GateCondition | undefined
    const conditional = /^if\s*\(\s*([A-Za-z_]\w*)\s*==\s*(\d+)\s*\)\s*(.+)$/.exec(statement)
    if (conditional) {
      const [, register, rawValue, rest] = conditional
      const value = Number(rawValue)
      const base = cregBase.get(register)
      const width = cregWidth.get(register) ?? 1
      if (base === undefined) {
        warnings.push(`Classical condition references unknown register "${register}"; applied unconditionally.`)
      } else if (value === 0) {
        condition = { qubit: base, value: 0 }
      } else if ((value & (value - 1)) === 0) {
        const bit = Math.log2(value)
        if (bit < width) condition = { qubit: base + bit, value: 1 }
        else warnings.push(`Classical condition ${register}==${value} refers to a bit outside the register.`)
      } else {
        warnings.push(`Multi-bit condition ${register}==${value} cannot be represented; applied unconditionally.`)
      }
      statement = rest.trim()
    }

    if (!statement) continue
    if (/^OPENQASM/i.test(statement)) continue
    if (/^include/i.test(statement)) continue

    // Register declarations.
    const qreg = /^qreg\s+([\w]+)\s*\[\s*(\d+)\s*\]$/.exec(statement)
    if (qreg) {
      const name = qreg[1]
      const size = Number(qreg[2])
      qregs.set(name, { base: numQubits, size })
      numQubits += size
      continue
    }
    const creg = /^creg\s+([\w]+)\s*\[\s*(\d+)\s*\]$/.exec(statement)
    if (creg) {
      numClbits = Math.max(numClbits, Number(creg[2]))
      cregWidth.set(creg[1], Number(creg[2]))
      continue
    }
    if (/^gate\b/i.test(statement)) {
      warnings.push('Custom gate definitions are not imported; only the invocation is used.')
      continue
    }
    if (/^barrier\b/i.test(statement)) {
      const targets = parseQubitRefs(statement.replace(/^barrier\b/i, ''), qregs)
      pending.push({ kind: 'BARRIER', qubits: targets.length ? targets : [0], params: [] })
      continue
    }

    const measure = /^measure\s+(.+?)\s*->\s*(.+)$/.exec(statement)
    if (measure) {
      const lhs = measure[1].trim()
      const dest = measure[2].trim()
      // Whole-register form: `measure q -> c;` measures every qubit in order.
      if (/^[A-Za-z_]\w*$/.test(lhs)) {
        const register = qregs.get(lhs)
        if (!register) {
          warnings.push(`Unknown quantum register "${lhs}"; measurement skipped.`)
        } else {
          for (let i = 0; i < register.size; i++) pending.push({ kind: 'M', qubits: [register.base + i], params: [] })
          const destName = /^([A-Za-z_]\w*)$/.exec(dest)?.[1]
          if (destName) {
            cregBase.set(destName, register.base)
            cregWidth.set(destName, Math.max(cregWidth.get(destName) ?? 0, register.size))
          }
        }
        continue
      }
      const targets = parseQubitRefs(lhs, qregs)
      if (!targets.length) {
        warnings.push(`Could not resolve measurement target "${lhs}"; statement skipped.`)
        continue
      }
      for (const t of targets) pending.push({ kind: 'M', qubits: [t], params: [], condition })
      // Record where the result lands so later `if (creg == value)` resolves.
      const destRef = /^([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/.exec(dest)
      if (destRef && targets.length === 1) {
        const offset = Number(destRef[2] ?? 0)
        const width = cregWidth.get(destRef[1]) ?? 1
        // A multi-bit register is addressed from c[0]; a per-bit cN register
        // starts at the measured qubit's index.
        if (width > 1 || offset === 0) cregBase.set(destRef[1], width > 1 ? 0 : targets[0])
        cregWidth.set(destRef[1], Math.max(width, offset + 1))
      }
      continue
    }

    const m = PARAM_RE.exec(statement)
    if (!m) {
      errors.push(`Could not parse statement: "${statement}"`)
      continue
    }

    const op = m[1].toLowerCase()
    const rawParams = m[2]
    const operands = m[3].trim()

    // QASM 2.0 aliases: u1/u2/u3.
    if (op === 'u1' || op === 'u2' || op === 'u3') {
      const ps = parseParams(rawParams)
      const targets = parseQubitRefs(operands, qregs)
      const theta = ps[0] ?? 0
      const phi = op === 'u1' ? 0 : ps[1] ?? 0
      const lambda = op === 'u1' ? 0 : op === 'u2' ? Math.PI / 2 : ps[2] ?? 0
      pending.push({ kind: 'U', qubits: [targets[0] ?? 0], params: [theta, phi, lambda], condition })
      continue
    }

    const kind = QASM_NAME[op]
    if (!kind) {
      errors.push(`Unknown instruction "${m[1]}"`)
      continue
    }

    const spec = GATE_LIBRARY[kind]
    const params = parseParams(rawParams)

    // Single-qubit gates may carry a rotation angle (rx/ry/rz/crx/cry/crz).
    let targetParams = params
    if (kind === 'RX' || kind === 'RY' || kind === 'RZ' || kind === 'CRX' || kind === 'CRY' || kind === 'CRZ') {
      targetParams = [params[0] ?? Math.PI / 2]
    }

    const targets = parseQubitRefs(operands, qregs)
    if (targets.length < spec.arity) {
      errors.push(`${spec.name} needs ${spec.arity} qubit operand(s), found ${targets.length}`)
      continue
    }
    pending.push({ kind, qubits: targets.slice(0, spec.arity), params: targetParams, condition })
  }

  if (numQubits === 0) {
    const inferred = pending.reduce((max, g) => Math.max(max, ...g.qubits.map((q) => q + 1)), 0)
    numQubits = inferred || 2
    if (inferred === 0) warnings.push('No qubit register found; defaulting to 2 qubits.')
  }

  // QASM has no notion of a moment/column, so reconstruct one by list
  // scheduling. Per-qubit availability preserves the original instruction
  // order, while independent gates share a column exactly as they did before
  // export. Conditions wait for the measurement that produces their bit.
  circuit = emptyCircuit(numQubits, 'Imported circuit')
  const nextFree = Array.from({ length: numQubits }, () => 0)
  const lastMeasure = Array.from({ length: numQubits }, () => -1)
  for (const g of pending) {
    const base = Math.max(0, ...g.qubits.map((q) => nextFree[q] ?? 0))
    const column = g.condition ? Math.max(base, (lastMeasure[g.condition.qubit] ?? -1) + 1) : base
    circuit = addGate(circuit, g.kind, g.qubits, column, g.params, g.condition)
    for (const q of g.qubits) nextFree[q] = column + 1
    if (g.kind === 'M') lastMeasure[g.qubits[0]] = column
    if (g.kind === 'BARRIER') for (let q = 0; q < numQubits; q++) nextFree[q] = column + 1
  }

  return { circuit, errors, warnings }
}

function parseParams(raw?: string): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => evalExpr(s))
}

function evalExpr(expr: string): number {
  const cleaned = expr.replace(/\bpi\b/g, 'Math.PI')
  try {
    // The expression is limited to arithmetic over numbers and Math.PI.
    if (!/^[-+*/().\d\sMathPI]*$/.test(cleaned)) return 0
    const value = Function(`"use strict";return (${cleaned});`)() as unknown
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function parseQubitRefs(text: string, qregs: Map<string, { base: number; size: number }>): number[] {
  const refs: number[] = []
  const re = /([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const register = qregs.get(m[1])
    refs.push((register?.base ?? 0) + Number(m[2]))
  }
  return refs
}

// ---------------------------------------------------------------------------
// Export to other quantum SDKs
// ---------------------------------------------------------------------------

/** Python angle literal. `pi` is only valid inside OpenQASM, not Python. */
function fmtPyParam(rad: number): string {
  if (Math.abs(rad - Math.PI) < 1e-9) return 'math.pi'
  if (Math.abs(rad - Math.PI / 2) < 1e-9) return 'math.pi / 2'
  if (Math.abs(rad - Math.PI / 4) < 1e-9) return 'math.pi / 4'
  if (Math.abs(rad + Math.PI) < 1e-9) return '-math.pi'
  if (Math.abs(rad + Math.PI / 2) < 1e-9) return '-math.pi / 2'
  return String(Number(rad.toFixed(9)))
}

const qiskitGate: Partial<Record<GateKind, string>> = {
  H: 'h', X: 'x', Y: 'y', Z: 'z', S: 's', T: 't', Sdg: 'sdg', Tdg: 'tdg', I: 'id',
  CNOT: 'cx', CZ: 'cz', SWAP: 'swap', CCX: 'ccx', CSWAP: 'cswap',
  RX: 'rx', RY: 'ry', RZ: 'rz', CRX: 'crx', CRY: 'cry', CRZ: 'crz',
}

function qiskitCall(gate: Gate): string {
  const qubits = gate.qubits.map((q) => `q[${q}]`)
  const params = gate.params.map(fmtPyParam)
  if (gate.kind === 'U') return `qc.u(${[...params, qubits[0]].join(', ')})`
  if (gate.kind === 'RX' || gate.kind === 'RY' || gate.kind === 'RZ') {
    return `qc.${qiskitGate[gate.kind]}(${[params[0] ?? '0', qubits[0]].join(', ')})`
  }
  if (gate.kind === 'CRX' || gate.kind === 'CRY' || gate.kind === 'CRZ') {
    return `qc.${qiskitGate[gate.kind]}(${[params[0] ?? '0', ...qubits].join(', ')})`
  }
  const method = qiskitGate[gate.kind]
  if (!method) return `# unsupported gate ${gate.kind}`
  return `qc.${method}(${qubits.join(', ')})`
}

export function toQiskitPython(circuit: Circuit): string {
  const n = circuit.numQubits
  const lines = [
    'import math',
    'from qiskit import QuantumCircuit',
    '',
    `qc = QuantumCircuit(${n}, ${n})`,
    'q = qc.qubits',
    '',
  ]
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  for (const gate of ordered) {
    if (gate.kind === 'M') {
      lines.push(`qc.measure(${gate.qubits[0]}, ${gate.qubits[0]})`)
      continue
    }
    if (gate.kind === 'BARRIER') {
      const targets = gate.qubits.map((q) => `q[${q}]`).join(', ')
      lines.push(targets ? `qc.barrier(${targets})` : 'qc.barrier()')
      continue
    }
    const call = qiskitCall(gate)
    if (gate.condition) {
      // Qiskit ≥ 1.0 represents feed-forward with an if_test context manager.
      lines.push(`with qc.if_test((qc.clbits[${gate.condition.qubit}], ${gate.condition.value})):`)
      lines.push(`    ${call}`)
    } else {
      lines.push(call)
    }
  }
  if (circuit.gates.some((g) => g.kind === 'M' || g.condition)) {
    lines.push('', 'from qiskit_aer import AerSimulator', '', 'result = AerSimulator().run(qc, shots=1024).result()', 'print(result.get_counts())')
  } else {
    lines.push('', 'from qiskit.quantum_info import Statevector', '', 'print(Statevector.from_instruction(qc))')
  }
  return lines.join('\n')
}

const cirqGate: Partial<Record<GateKind, string>> = {
  H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', T: 'T', I: 'I',
  CNOT: 'CNOT', CZ: 'CZ', SWAP: 'SWAP', CCX: 'CCX',
}

function cirqCall(gate: Gate): string {
  const qs = gate.qubits.map((q) => `q${q}`)
  const p = gate.params.map(fmtPyParam)
  if (gate.kind === 'Sdg') return `cirq.S(${qs[0]})**-1`
  if (gate.kind === 'Tdg') return `cirq.T(${qs[0]})**-1`
  if (gate.kind === 'RX' || gate.kind === 'RY' || gate.kind === 'RZ') {
    return `cirq.${gate.kind.toLowerCase()}(${p[0] ?? '0'})(${qs[0]})`
  }
  if (gate.kind === 'CRX' || gate.kind === 'CRY' || gate.kind === 'CRZ') {
    return `cirq.ControlledGate(cirq.${gate.kind.slice(1).toLowerCase()}(${p[0] ?? '0'})).on(${qs.join(', ')})`
  }
  if (gate.kind === 'U') {
    const m = uMat(gate.params[0] ?? 0, gate.params[1] ?? 0, gate.params[2] ?? 0)
    const cells = [m[0], m[1], m[2], m[3]].map((c) => `complex(${Number(c.re.toFixed(12))}, ${Number(c.im.toFixed(12))})`)
    return `cirq.MatrixGate(np.array([[${cells[0]}, ${cells[1]}], [${cells[2]}, ${cells[3]}]], dtype=complex))(${qs[0]})`
  }
  if (gate.kind === 'CSWAP') return `cirq.ControlledGate(cirq.SWAP).on(${qs.join(', ')})`
  const name = cirqGate[gate.kind]
  if (!name) return `# unsupported gate ${gate.kind}`
  return `cirq.${name}(${qs.join(', ')})`
}

export function toCirqPython(circuit: Circuit): string {
  const n = circuit.numQubits
  const qs = Array.from({ length: n }, (_, i) => `q${i}`)
  const lines = [
    'import math',
    'import cirq',
    'import numpy as np',
    '',
    `qubits = [cirq.LineQubit(i) for i in range(${n})]`,
    `${qs.join(', ')} = qubits`,
    '',
    'circuit = cirq.Circuit(',
  ]
  if (circuit.gates.some((g) => g.condition)) {
    lines.unshift('# NOTE: classical feed-forward is exported as unconditional gates; use cirq.ClassicallyControlledOperation manually.')
  }
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  for (const gate of ordered) {
    if (gate.kind === 'M') {
      const key = `m_${gate.id.replace(/[^a-zA-Z0-9]/g, '_')}`
      lines.push(`    cirq.measure(${qs[gate.qubits[0]]}, key='${key}'),`)
      continue
    }
    if (gate.kind === 'BARRIER') continue
    lines.push(`    ${cirqCall(gate)},`)
  }
  lines.push(')', '', 'print(cirq.Simulator().simulate(circuit).final_state_vector)')
  return lines.join('\n')
}

const pennylaneGate: Partial<Record<GateKind, string>> = {
  H: 'Hadamard', X: 'PauliX', Y: 'PauliY', Z: 'PauliZ', S: 'S', T: 'T', I: 'Identity',
  CNOT: 'CNOT', CZ: 'CZ', SWAP: 'SWAP', CCX: 'Toffoli', CSWAP: 'CSWAP',
}

function pennylaneCall(gate: Gate): string {
  const wires = gate.qubits.length === 1 ? `wires=${gate.qubits[0]}` : `wires=[${gate.qubits.join(', ')}]`
  const p = gate.params.map(fmtPyParam)
  if (gate.kind === 'Sdg') return `qml.adjoint(qml.S)(${wires})`
  if (gate.kind === 'Tdg') return `qml.adjoint(qml.T)(${wires})`
  if (gate.kind === 'RX' || gate.kind === 'RY' || gate.kind === 'RZ') {
    return `qml.${gate.kind}(${p[0] ?? '0'}, ${wires})`
  }
  if (gate.kind === 'CRX' || gate.kind === 'CRY' || gate.kind === 'CRZ') {
    return `qml.${gate.kind}(${p[0] ?? '0'}, ${wires})`
  }
  if (gate.kind === 'U') {
    return `qml.U3(${[...p, wires].join(', ')})`
  }
  const name = pennylaneGate[gate.kind]
  if (!name) return `# unsupported gate ${gate.kind}`
  return `qml.${name}(${wires})`
}

export function toPennyLanePython(circuit: Circuit): string {
  const n = circuit.numQubits
  const lines = [
    'import math',
    'import pennylane as qml',
    '',
    `dev = qml.device("default.qubit", wires=${n})`,
    '',
    '@qml.qnode(dev)',
    'def circuit():',
  ]
  if (circuit.gates.some((g) => g.condition)) {
    lines.unshift('# NOTE: classical feed-forward is exported as unconditional gates; use qml.cond with mid-circuit measurements.')
  }
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  for (const gate of ordered) {
    if (gate.kind === 'M' || gate.kind === 'BARRIER') continue
    lines.push(`    ${pennylaneCall(gate)}`)
  }
  lines.push(`    return qml.probs(wires=[${Array.from({ length: n }, (_, i) => i).join(', ')}])`)
  lines.push('', 'print(circuit())')
  return lines.join('\n')
}
