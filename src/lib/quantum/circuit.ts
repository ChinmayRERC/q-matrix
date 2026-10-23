import { GATE_LIBRARY, type GateKind } from './core'

/** Classical condition: apply the gate only if `qubit` measured to `value`. */
export interface GateCondition {
  qubit: number
  value: 0 | 1
}

/** A gate placed on the circuit grid. `column` is the time step (moment). */
export interface Gate {
  id: string
  kind: GateKind
  /** Qubit indices. For 2-qubit gates: [control, target]. For 3-qubit: [c0, c1, target]. */
  qubits: number[]
  /** Rotation parameters in radians. */
  params: number[]
  /** Moment index — gates sharing a column act in parallel. */
  column: number
  /** Optional classical control (feed-forward), e.g. teleportation corrections. */
  condition?: GateCondition
}

export interface Circuit {
  id: string
  name: string
  numQubits: number
  gates: Gate[]
}

let gateSeq = 0
export const newGateId = (kind: GateKind): string => `${kind}-${Date.now().toString(36)}-${(gateSeq++).toString(36)}`

export const emptyCircuit = (numQubits = 2, name = 'Untitled circuit'): Circuit => ({
  id: `c-${Date.now().toString(36)}`,
  name,
  numQubits,
  gates: [],
})

export const columnCount = (circuit: Circuit): number =>
  circuit.gates.reduce((max, g) => Math.max(max, g.column + 1), 0)

export const gatesInColumn = (circuit: Circuit, column: number): Gate[] =>
  circuit.gates.filter((g) => g.column === column).sort((a, b) => a.qubits[0] - b.qubits[0])

/** Circuit depth = number of moments. */
export const circuitDepth = columnCount

export const countGates = (circuit: Circuit): number => circuit.gates.length

export const totalGateCost = (circuit: Circuit): number =>
  circuit.gates.reduce((sum, g) => sum + (g.kind === 'M' || g.kind === 'BARRIER' ? 1 : 10), 0)

export interface PlacementIssue {
  level: 'error' | 'warning'
  message: string
  gateId?: string
}

/** Can this gate be dropped on the given qubits/column without conflicting? */
export function canPlace(
  circuit: Circuit,
  kind: GateKind,
  qubits: number[],
  column: number,
): { ok: boolean; reason?: string } {
  const spec = GATE_LIBRARY[kind]
  if (qubits.length !== spec.arity) {
    return { ok: false, reason: `${spec.name} acts on ${spec.arity} qubit(s)` }
  }
  for (const q of qubits) {
    if (q < 0 || q >= circuit.numQubits) {
      return { ok: false, reason: `Qubit ${q} is outside the register (0…${circuit.numQubits - 1})` }
    }
  }
  if (new Set(qubits).size !== qubits.length) {
    return { ok: false, reason: 'Control and target qubits must be different' }
  }
  const occupied = new Set(
    gatesInColumn(circuit, column)
      .filter((g) => g.id !== undefined)
      .flatMap((g) => g.qubits),
  )
  const conflict = qubits.find((q) => occupied.has(q))
  if (conflict !== undefined) {
    return { ok: false, reason: `Qubit ${conflict} already has a gate in this column` }
  }
  return { ok: true }
}

export function addGate(
  circuit: Circuit,
  kind: GateKind,
  qubits: number[],
  column?: number,
  params?: number[],
  condition?: GateCondition,
): Circuit {
  const spec = GATE_LIBRARY[kind]
  const target = column ?? columnCount(circuit)
  const gate: Gate = {
    id: newGateId(kind),
    kind,
    qubits: [...qubits],
    params: params ?? [...spec.params],
    column: target,
    ...(condition ? { condition } : {}),
  }
  return { ...circuit, gates: [...circuit.gates, gate] }
}

export const removeGate = (circuit: Circuit, gateId: string): Circuit => ({
  ...circuit,
  gates: circuit.gates.filter((g) => g.id !== gateId),
})

export const updateGate = (circuit: Circuit, gateId: string, patch: Partial<Gate>): Circuit => ({
  ...circuit,
  gates: circuit.gates.map((g) => (g.id === gateId ? { ...g, ...patch } : g)),
})

export const moveGate = (circuit: Circuit, gateId: string, column: number, qubits?: number[]): Circuit => ({
  ...circuit,
  gates: circuit.gates.map((g) =>
    g.id === gateId ? { ...g, column, ...(qubits ? { qubits } : {}) } : g,
  ),
})

/** Structural validation surfaced inline in the composer and by the AI debugger. */
export function validateCircuit(circuit: Circuit): PlacementIssue[] {
  const issues: PlacementIssue[] = []
  const measured = new Set<number>()

  for (const gate of circuit.gates) {
    const spec = GATE_LIBRARY[gate.kind]
    if (gate.qubits.length !== spec.arity) {
      issues.push({
        level: 'error',
        message: `${spec.name} expects ${spec.arity} qubit(s) but got ${gate.qubits.length}`,
        gateId: gate.id,
      })
    }
    for (const q of gate.qubits) {
      if (q < 0 || q >= circuit.numQubits) {
        issues.push({
          level: 'error',
          message: `Gate ${spec.name} references qubit ${q}, outside the register`,
          gateId: gate.id,
        })
      }
    }
    if (new Set(gate.qubits).size !== gate.qubits.length) {
      issues.push({
        level: 'error',
        message: `${spec.name} uses the same qubit as control and target`,
        gateId: gate.id,
      })
    }
    if (gate.kind === 'M') measured.add(gate.qubits[0])

    if (gate.condition) {
      const { qubit, value } = gate.condition
      if (qubit < 0 || qubit >= circuit.numQubits) {
        issues.push({
          level: 'error',
          message: `${spec.name} is conditioned on qubit ${qubit}, outside the register`,
          gateId: gate.id,
        })
      } else if (gate.qubits.includes(qubit)) {
        issues.push({
          level: 'error',
          message: `${spec.name} is conditioned on qubit ${qubit}, which it also acts on`,
          gateId: gate.id,
        })
      } else {
        const measuredBefore = circuit.gates.some(
          (g) => g.kind === 'M' && g.qubits[0] === qubit && g.column < gate.column,
        )
        if (!measuredBefore) {
          issues.push({
            level: 'error',
            message: `${spec.name} is conditioned on q${qubit}=${value} but q${qubit} is not measured before it`,
            gateId: gate.id,
          })
        }
      }
    }
  }

  // Per-column qubit conflicts.
  const columns = new Map<number, Map<number, string>>()
  for (const gate of circuit.gates) {
    let map = columns.get(gate.column)
    if (!map) {
      map = new Map()
      columns.set(gate.column, map)
    }
    for (const q of gate.qubits) {
      const owner = map.get(q)
      if (owner) {
        issues.push({
          level: 'error',
          message: `Qubit ${q} has two gates in the same moment (${owner} and ${gate.kind})`,
          gateId: gate.id,
        })
      } else {
        map.set(q, gate.kind)
      }
    }
  }

  // Measurement ordering.
  const firstMeasureColumn = circuit.gates
    .filter((g) => g.kind === 'M')
    .reduce((min, g) => Math.min(min, g.column), Number.POSITIVE_INFINITY)
  if (Number.isFinite(firstMeasureColumn)) {
    const late = circuit.gates.filter((g) => g.kind !== 'M' && g.column > firstMeasureColumn)
    if (late.length) {
      issues.push({
        level: 'warning',
        message: `${late.length} gate(s) act after the first measurement; the classical bit is already fixed`,
      })
    }
  }

  // Unmeasured qubits.
  const unmeasured = Array.from({ length: circuit.numQubits }, (_, i) => i).filter(
    (i) => !measured.has(i),
  )
  if (unmeasured.length && circuit.gates.length > 0) {
    issues.push({
      level: 'warning',
      message: `Qubit${unmeasured.length > 1 ? 's' : ''} ${unmeasured.join(', ')} ${
        unmeasured.length > 1 ? 'are' : 'is'
      } never measured — its state is invisible in the histogram`,
    })
  }

  if (circuit.gates.length === 0) {
    issues.push({ level: 'warning', message: 'The circuit is empty — drag a gate onto a wire to begin' })
  }

  return issues
}

/** Human readable one-line description, used by the AI tutor and tooltips. */
export const describeGate = (gate: Gate): string => {
  const spec = GATE_LIBRARY[gate.kind]
  const prefix = gate.condition ? `if c${gate.condition.qubit}=${gate.condition.value}: ` : ''
  if (gate.kind === 'M') return `${prefix}measure q${gate.qubits[0]}`
  if (gate.kind === 'BARRIER') return 'barrier'
  const angles = gate.params.map((p) => `(${Math.round(p * 100) / 100})`).join('')
  if (gate.kind === 'CNOT' || gate.kind === 'CZ' || gate.kind === 'SWAP')
    return `${prefix}${spec.name} q${gate.qubits[0]},q${gate.qubits[1]}`
  if (gate.kind === 'CCX' || gate.kind === 'CSWAP')
    return `${prefix}${spec.name} q${gate.qubits[0]},q${gate.qubits[1]},q${gate.qubits[2]}`
  return `${prefix}${spec.name}${angles} q${gate.qubits[0]}`
}

/** Format a basis-state index as a little-endian ket, q0 leftmost (index 1 -> |10⟩). */
export const ketLabel = (index: number, numQubits: number): string => `|${bitString(index, numQubits)}⟩`

/** Bit string of a state index, little-endian: q0 is the leftmost character. */
export const bitString = (index: number, numQubits: number): string =>
  index.toString(2).padStart(numQubits, '0').split('').reverse().join('')
