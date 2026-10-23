import { GATE_LIBRARY, type GateKind } from './core'
import { addGate, emptyCircuit, type Circuit, type GateCondition } from './circuit'

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
  let qregName = ''
  let column = 0
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
      qregName = qreg[1]
      numQubits = Math.max(numQubits, Number(qreg[2]))
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
      const targets = parseQubitRefs(statement.replace(/^barrier\b/i, ''))
      pending.push({ kind: 'BARRIER', qubits: targets.length ? targets : [0], params: [] })
      continue
    }

    const measure = /^measure\s+(.+?)\s*->\s*(.+)$/.exec(statement)
    if (measure) {
      const lhs = measure[1].trim()
      const dest = measure[2].trim()
      // Whole-register form: `measure q -> c;` measures every qubit in order.
      if (/^[A-Za-z_]\w*$/.test(lhs)) {
        if (numQubits === 0) {
          errors.push('Cannot measure a register before declaring its size with qreg.')
        } else if (lhs !== qregName) {
          warnings.push(`Unknown quantum register "${lhs}"; measurement skipped.`)
        } else {
          for (let i = 0; i < numQubits; i++) pending.push({ kind: 'M', qubits: [i], params: [] })
          const destName = /^([A-Za-z_]\w*)$/.exec(dest)?.[1]
          if (destName) {
            cregBase.set(destName, 0)
            cregWidth.set(destName, Math.max(cregWidth.get(destName) ?? 0, numQubits))
          }
        }
        continue
      }
      const targets = parseQubitRefs(lhs)
      if (!targets.length) {
        warnings.push(`Could not resolve measurement target "${lhs}"; statement skipped.`)
        continue
      }
      for (const t of targets) pending.push({ kind: 'M', qubits: [t], params: [], condition })
      // Record where the result lands so later `if (creg == value)` resolves.
      const destRef = /^([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/.exec(dest)
      if (destRef && targets.length === 1) {
        const offset = Number(destRef[2] ?? 0)
        if (offset === 0) cregBase.set(destRef[1], targets[0])
        cregWidth.set(destRef[1], Math.max(cregWidth.get(destRef[1]) ?? 0, offset + 1))
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
      const targets = parseQubitRefs(operands)
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

    const targets = parseQubitRefs(operands)
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

  circuit = emptyCircuit(numQubits, 'Imported circuit')
  for (const g of pending) {
    circuit = addGate(circuit, g.kind, g.qubits, column, g.params, g.condition)
    column += 1
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

function parseQubitRefs(text: string): number[] {
  const refs: number[] = []
  const re = /\[\s*(\d+)\s*\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) refs.push(Number(m[1]))
  return refs
}

// ---------------------------------------------------------------------------
// Export to other quantum SDKs
// ---------------------------------------------------------------------------

export function toQiskitPython(circuit: Circuit): string {
  const n = circuit.numQubits
  const lines = [
    'from qiskit import QuantumCircuit',
    '',
    `qc = QuantumCircuit(${n}, ${n})`,
    '',
  ]
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  for (const gate of ordered) {
    if (gate.kind === 'M') {
      lines.push(`qc.measure(${gate.qubits[0]}, ${gate.qubits[0]})`)
      continue
    }
    if (gate.kind === 'BARRIER') continue
    const spec = GATE_LIBRARY[gate.kind]
    const method = spec.name.split(' ')[0].replace('†', 'dg').replace('(NOT)', '')
    const call =
      gate.qubits.length === 1
        ? `qc.${method}(${gate.qubits[0]}${gate.params.length ? `, ${gate.params.map(fmtParam).join(', ')}` : ''})`
        : `qc.${method}(${gate.qubits.join(', ')}${gate.params.length ? `, ${gate.params.map(fmtParam).join(', ')}` : ''})`
    if (gate.condition) {
      // Qiskit ≥ 1.0 represents feed-forward with an if_test context manager.
      lines.push(`with qc.if_test((c[${gate.condition.qubit}], ${gate.condition.value})):`)
      lines.push(`    ${call}`)
    } else {
      lines.push(call)
    }
  }
  lines.push('', 'from qiskit.quantum_info import Statevector', '', 'print(Statevector.from_instruction(qc))')
  return lines.join('\n')
}

export function toCirqPython(circuit: Circuit): string {
  const n = circuit.numQubits
  const qs = Array.from({ length: n }, (_, i) => `q${i}`)
  const lines = ['import cirq', '', `qubits = [cirq.LineQubit(i) for i in range(${n})]`, '', 'circuit = cirq.Circuit(']
  if (circuit.gates.some((g) => g.condition)) {
    lines.unshift('# NOTE: classical feed-forward is exported as unconditional gates; wire up with_classical_controls manually.')
  }
  const ordered = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubits[0] - b.qubits[0])
  for (const gate of ordered) {
    if (gate.kind === 'M') {
      lines.push(`    cirq.measure(${qs[gate.qubits[0]]}),`)
      continue
    }
    if (gate.kind === 'BARRIER') continue
    const spec = GATE_LIBRARY[gate.kind]
    const args = gate.qubits.map((q) => qs[q]).join(', ')
    const params = gate.params.length ? `, ${gate.params.map(fmtParam).join(', ')}` : ''
    lines.push(`    cirq.${cirqName(gate.kind)}(${args}${params}),`)
    void spec
  }
  lines.push(')', '', 'print(cirq.SimulationState(circuit).final_state_vector())')
  return lines.join('\n')
}

function cirqName(kind: GateKind): string {
  switch (kind) {
    case 'H':
      return 'H'
    case 'X':
      return 'X'
    case 'Y':
      return 'Y'
    case 'Z':
      return 'Z'
    case 'S':
      return 'S'
    case 'T':
      return 'T'
    case 'Sdg':
      return 'S'
    case 'Tdg':
      return 'T'
    case 'RX':
      return 'rx'
    case 'RY':
      return 'ry'
    case 'RZ':
      return 'rz'
    case 'CNOT':
      return 'CNOT'
    case 'CZ':
      return 'CZ'
    case 'SWAP':
      return 'SWAP'
    case 'CRX':
      return 'rx'
    case 'CRY':
      return 'ry'
    case 'CRZ':
      return 'rz'
    case 'CCX':
      return 'CCX'
    case 'CSWAP':
      return 'CSWAP'
    case 'I':
      return 'I'
    default:
      return 'H'
  }
}

export function toPennyLanePython(circuit: Circuit): string {
  const n = circuit.numQubits
  const lines = [
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
    if (gate.kind === 'M') continue
    if (gate.kind === 'BARRIER') continue
    const spec = GATE_LIBRARY[gate.kind]
    const name = pennylaneName(gate.kind)
    const params = gate.params.length ? `, ${gate.params.map(fmtParam).join(', ')}` : ''
    if (gate.qubits.length === 1) {
      lines.push(`    qml.${name}(wires=${gate.qubits[0]}${params})`)
    } else if (gate.qubits.length === 2) {
      lines.push(`    qml.${name}(wires=[${gate.qubits.join(', ')}]${params})`)
    } else {
      lines.push(`    qml.${name}(wires=[${gate.qubits.join(', ')}]${params})`)
    }
    void spec
  }
  lines.push(`    return qml.probs(wires=[${Array.from({ length: n }, (_, i) => i).join(', ')}])`)
  lines.push('', 'print(circuit())')
  return lines.join('\n')
}

function pennylaneName(kind: GateKind): string {
  switch (kind) {
    case 'H':
      return 'Hadamard'
    case 'X':
      return 'PauliX'
    case 'Y':
      return 'PauliY'
    case 'Z':
      return 'PauliZ'
    case 'S':
      return 'SPhase'
    case 'Sdg':
      return 'SPhase'
    case 'T':
      return 'TPhase'
    case 'Tdg':
      return 'TPhase'
    case 'RX':
      return 'RX'
    case 'RY':
      return 'RY'
    case 'RZ':
      return 'RZ'
    case 'U':
      return 'U3'
    case 'CNOT':
      return 'CNOT'
    case 'CZ':
      return 'CZ'
    case 'SWAP':
      return 'SWAP'
    case 'CRX':
      return 'CRX'
    case 'CRY':
      return 'CRY'
    case 'CRZ':
      return 'CRZ'
    case 'CCX':
      return 'Toffoli'
    case 'CSWAP':
      return 'CSWAP'
    default:
      return 'Hadamard'
  }
}
