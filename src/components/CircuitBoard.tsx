/**
 * SVG circuit diagram with drag-and-drop, click-to-place, selection and a live
 * drop preview. The board is pure presentation; all mutations are reported to
 * the Composer so undo/redo and validation live in one place.
 */
import { useMemo, useRef, useState } from 'react'
import { GATE_LIBRARY, type GateKind } from '../lib/quantum/core'
import { canPlace, type Circuit, type Gate } from '../lib/quantum/circuit'

const COL_W = 60
const ROW_H = 58
const PAD_L = 66
const PAD_T = 42

const TONE: Record<string, string> = {
  violet: '#9b7cff',
  cyan: '#62e0f2',
  amber: '#ffc46b',
  rose: '#ff8f8f',
  pink: '#ff7aa8',
  lime: '#c9f27a',
  green: '#5ee2a8',
  slate: '#8b93b5',
}

export const GATE_MIME = 'application/x-qgate'
export const MOVE_MIME = 'application/x-qmove'

const fmtAngle = (v: number): string => {
  if (Math.abs(v) < 1e-9) return '0'
  const pi = v / Math.PI
  const table: Array<[number, number]> = [
    [1, 1], [-1, 1], [1, 2], [-1, 2], [1, 4], [-1, 4], [1, 8], [-1, 8],
    [3, 4], [3, 2], [2, 1], [-2, 1],
  ]
  for (const [num, den] of table) {
    if (Math.abs(pi - num / den) < 1e-6) {
      const n = Math.abs(num) === 1 ? '' : String(Math.abs(num))
      const sign = num < 0 ? '−' : ''
      return `${sign}${n}π${den === 1 ? '' : `/${den}`}`
    }
  }
  return v.toFixed(2)
}

/** Default qubit span for a gate dropped on `q`. */
export function qubitsFor(kind: GateKind, q: number, n: number): number[] {
  const arity = GATE_LIBRARY[kind].arity
  if (arity === 1) return [q]
  const out = [q]
  let next = q + 1
  while (out.length < arity && out.length < n) {
    out.push(next % n)
    next++
    if (next > q + n) break
  }
  return out
}

interface BoardProps {
  circuit: Circuit
  selectedId: string | null
  armed: GateKind | null
  onSelect: (id: string | null) => void
  onPlace: (kind: GateKind, qubits: number[], column: number) => void
  onMove: (id: string, qubits: number[], column: number) => void
  onDelete: (id: string) => void
  onArmedUsed?: () => void
}

interface Preview {
  kind: GateKind
  qubits: number[]
  column: number
  ok: boolean
  reason?: string
}

export function CircuitBoard({ circuit, selectedId, armed, onSelect, onPlace, onMove, onDelete, onArmedUsed }: BoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const n = circuit.numQubits
  const columns = Math.max(10, Math.max(0, ...circuit.gates.map((g) => g.column)) + 4)
  const width = PAD_L + columns * COL_W + 26
  const height = PAD_T + n * ROW_H + 26

  const gateAt = useMemo(() => {
    const map = new Map<string, Gate>()
    for (const g of circuit.gates) map.set(g.id, g)
    return map
  }, [circuit.gates])

  const cx = (col: number) => PAD_L + col * COL_W + COL_W / 2
  const cy = (q: number) => PAD_T + q * ROW_H + ROW_H / 2

  const cell = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { column: 0, qubit: 0 }
    const x = clientX - rect.left
    const y = clientY - rect.top
    return {
      column: Math.max(0, Math.min(columns - 1, Math.floor((x - PAD_L) / COL_W))),
      qubit: Math.max(0, Math.min(n - 1, Math.floor((y - PAD_T) / ROW_H))),
    }
  }

  /** Find the nearest column where the gate actually fits. */
  const fitColumn = (kind: GateKind, qubits: number[], column: number) => {
    for (let c = column; c < column + 6; c++) {
      if (canPlace(circuit, kind, qubits, c).ok) return c
    }
    return column
  }

  const makePreview = (kind: GateKind, column: number, qubit: number, movingId?: string): Preview => {
    const qubits = qubitsFor(kind, qubit, n)
    let target = fitColumn(kind, qubits, column)
    // Moving a gate must ignore its own occupancy.
    if (movingId) {
      const stripped: Circuit = { ...circuit, gates: circuit.gates.filter((g) => g.id !== movingId) }
      target = column
      for (let c = column; c < column + 6; c++) {
        if (canPlace(stripped, kind, qubits, c).ok) {
          target = c
          break
        }
      }
      const check = canPlace(stripped, kind, qubits, target)
      return { kind, qubits, column: target, ok: check.ok, reason: check.reason }
    }
    const check = canPlace(circuit, kind, qubits, target)
    return { kind, qubits, column: target, ok: check.ok, reason: check.reason }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    const { column, qubit } = cell(e.clientX, e.clientY)
    setHoverCol(column)
    const kind = e.dataTransfer.types.includes(GATE_MIME)
      ? (window as unknown as { __qgate?: GateKind }).__qgate
      : undefined
    const moveId = (window as unknown as { __qmove?: string }).__qmove
    if (kind) setPreview(makePreview(kind, column, qubit))
    else if (moveId) {
      const g = gateAt.get(moveId)
      if (g) setPreview(makePreview(g.kind, column, qubit, moveId))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const { column, qubit } = cell(e.clientX, e.clientY)
    const kind = (window as unknown as { __qgate?: GateKind }).__qgate
    const moveId = (window as unknown as { __qmove?: string }).__qmove
    setPreview(null)
    setHoverCol(null)
    if (kind) {
      const p = makePreview(kind, column, qubit)
      if (p.ok) onPlace(kind, p.qubits, p.column)
    } else if (moveId) {
      const g = gateAt.get(moveId)
      if (g) {
        const p = makePreview(g.kind, column, qubit, moveId)
        if (p.ok) onMove(moveId, p.qubits, p.column)
      }
    }
    ;(window as unknown as { __qgate?: GateKind }).__qgate = undefined
    ;(window as unknown as { __qmove?: string }).__qmove = undefined
  }

  const placeArmed = (column: number, qubit: number) => {
    if (!armed) {
      onSelect(null)
      return
    }
    const p = makePreview(armed, column, qubit)
    if (p.ok) {
      onPlace(armed, p.qubits, p.column)
      onArmedUsed?.()
    }
  }

  return (
    <div
      className={`board-wrap scroll-thin ${preview ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setPreview(null)
        setHoverCol(null)
      }}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', minWidth: width, cursor: armed ? 'copy' : 'default' }}
        onClick={(e) => {
          if (e.target === svgRef.current) onSelect(null)
        }}
      >
        <defs>
          <radialGradient id="gate-glow" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* column highlight */}
        {hoverCol !== null && (
          <rect
            x={PAD_L + hoverCol * COL_W + 3}
            y={PAD_T - 14}
            width={COL_W - 6}
            height={n * ROW_H + 8}
            rx={9}
            fill={armed ? 'rgba(155,124,255,.07)' : 'rgba(255,255,255,.03)'}
            pointerEvents="none"
          />
        )}

        {/* wires */}
        {Array.from({ length: n }, (_, q) => (
          <g key={`wire-${q}`}>
            <line
              x1={PAD_L - 12}
              y1={cy(q)}
              x2={PAD_L + columns * COL_W}
              y2={cy(q)}
              stroke="rgba(255,255,255,.13)"
              strokeWidth={1}
            />
            <text x={PAD_L - 22} y={cy(q) + 4} textAnchor="end" className="board-qubit-label">
              q{q}
            </text>
            <text x={PAD_L - 46} y={cy(q) + 4} textAnchor="end" className="board-col-label" opacity={0.55}>
              |0⟩
            </text>
            {/* generous hit area for click-to-place */}
            <rect
              x={PAD_L}
              y={cy(q) - ROW_H / 2}
              width={columns * COL_W}
              height={ROW_H}
              className="board-wire-hit"
              onDragOver={(e) => {
                e.preventDefault()
                const { column } = cell(e.clientX, e.clientY)
                setHoverCol(column)
              }}
              onClick={(e) => {
                const { column } = cell(e.clientX, e.clientY)
                placeArmed(column, q)
              }}
            />
          </g>
        ))}

        {/* column labels */}
        {Array.from({ length: columns }, (_, c) => (
          <text key={`col-${c}`} x={cx(c)} y={PAD_T - 22} textAnchor="middle" className="board-col-label" opacity={c % 2 === 0 ? 0.8 : 0.35}>
            {c}
          </text>
        ))}

        {/* preview */}
        {preview && (
          <g pointerEvents="none" opacity={0.95}>
            <rect
              x={cx(preview.column) - 21}
              y={cy(Math.min(...preview.qubits)) - 17}
              width={42}
              height={cy(Math.max(...preview.qubits)) - cy(Math.min(...preview.qubits)) + 34}
              rx={9}
              className="drop-preview"
              stroke={preview.ok ? 'rgba(155,124,255,.8)' : 'rgba(255,122,168,.85)'}
              fill={preview.ok ? 'rgba(155,124,255,.16)' : 'rgba(255,122,168,.12)'}
            />
            <text x={cx(preview.column)} y={cy(Math.min(...preview.qubits)) - 24} textAnchor="middle" className="gate-param" fill={preview.ok ? '#cbbcff' : '#ffb3c9'}>
              {GATE_LIBRARY[preview.kind].short}
            </text>
          </g>
        )}

        {/* gates */}
        {[...circuit.gates]
          .sort((a, b) => a.column - b.column)
          .map((gate) => (
            <GateGlyph
              key={gate.id}
              gate={gate}
              x={cx(gate.column)}
              ys={gate.qubits.map(cy)}
              selected={gate.id === selectedId}
              onSelect={() => onSelect(gate.id)}
              onDelete={() => onDelete(gate.id)}
              n={n}
            />
          ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual gate rendering
// ---------------------------------------------------------------------------

function GateGlyph({
  gate,
  x,
  ys,
  selected,
  onSelect,
  onDelete,
  n,
}: {
  gate: Gate
  x: number
  ys: number[]
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  n: number
}) {
  const spec = GATE_LIBRARY[gate.kind]
  const color = TONE[spec.tone] ?? '#8b93b5'
  const [first, ...rest] = ys
  const last = ys[ys.length - 1] ?? first

  const startMove = (e: React.DragEvent) => {
    e.stopPropagation()
    ;(window as unknown as { __qmove?: string }).__qmove = gate.id
    e.dataTransfer.setData(MOVE_MIME, gate.id)
    e.dataTransfer.effectAllowed = 'move'
    onSelect()
  }

  if (gate.kind === 'BARRIER') {
    return (
      <g className="gate" onClick={onSelect} onDoubleClick={onDelete}>
        <line x1={x} y1={PAD_T - 8} x2={x} y2={PAD_T + n * ROW_H - 4} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
        <text x={x} y={PAD_T - 14} textAnchor="middle" className="gate-param" fill={color}>
          barrier
        </text>
        <rect x={x - 6} y={PAD_T - 8} width={12} height={n * ROW_H + 4} fill="transparent" style={{ cursor: 'grab' }} />
      </g>
    )
  }

  const isMeasure = gate.kind === 'M'
  const controlled = spec.arity > 1
  const arrowTarget = gate.kind === 'CNOT' || gate.kind === 'CCX'
  const swap = gate.kind === 'SWAP' || gate.kind === 'CSWAP'

  return (
    <g
      className={`gate ${selected ? 'sel' : ''}`}
      {...({ draggable: true } as unknown as React.SVGProps<SVGGElement>)}
      onDragStart={startMove}
      onDragEnd={() => {
        ;(window as unknown as { __qmove?: string }).__qmove = undefined
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDelete()
      }}
    >
      {/* connecting line for multi-qubit gates */}
      {controlled && <line x1={x} y1={first} x2={x} y2={last} stroke={color} strokeWidth={1.5} opacity={0.75} />}

      {/* control dots */}
      {gate.kind === 'CNOT' && <circle cx={x} cy={first} r={5} fill={color} />}
      {gate.kind === 'CZ' && (
        <>
          <circle cx={x} cy={first} r={5} fill={color} />
          <circle cx={x} cy={last} r={5} fill={color} />
        </>
      )}
      {gate.kind === 'CCX' && (
        <>
          <circle cx={x} cy={ys[0]} r={5} fill={color} />
          <circle cx={x} cy={ys[1]} r={5} fill={color} />
        </>
      )}
      {gate.kind === 'CSWAP' && <circle cx={x} cy={ys[0]} r={5} fill={color} />}

      {/* target symbols */}
      {arrowTarget && (
        <g>
          <circle cx={x} cy={last} r={11} fill="rgba(5,7,15,.9)" stroke={color} strokeWidth={1.6} />
          <line x1={x - 11} y1={last} x2={x + 11} y2={last} stroke={color} strokeWidth={1.4} />
          <line x1={x} y1={last - 11} x2={x} y2={last + 11} stroke={color} strokeWidth={1.4} />
        </g>
      )}
      {swap &&
        (gate.kind === 'SWAP' ? ys : ys.slice(1)).map((y, i) => (
          <g key={i}>
            <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={color} strokeWidth={1.8} />
            <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} stroke={color} strokeWidth={1.8} />
          </g>
        ))}

      {/* boxed single-qubit / rotation / controlled-rotation gates */}
      {!(arrowTarget || swap || gate.kind === 'CZ') && (
        <g>
          <rect
            x={x - 21}
            y={(controlled ? last : first) - 17}
            width={42}
            height={34}
            rx={9}
            className="gate-body"
            fill={color}
            fillOpacity={isMeasure ? 0.2 : 0.15}
            stroke={color}
            strokeOpacity={selected ? 1 : 0.72}
            strokeWidth={selected ? 1.8 : 1.1}
          />
          <rect x={x - 21} y={(controlled ? last : first) - 17} width={42} height={34} rx={9} fill="url(#gate-glow)" pointerEvents="none" />
          <text x={x} y={(controlled ? last : first) + 4} textAnchor="middle" className="gate-label" fill={color}>
            {isMeasure ? 'M' : spec.short}
          </text>
          {isMeasure && (
            <path
              d={`M ${x - 12} ${(controlled ? last : first) + 10} A 12 12 0 0 1 ${x + 12} ${(controlled ? last : first) + 10}`}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              opacity={0.8}
            />
          )}
        </g>
      )}

      {/* parameter label */}
      {gate.params.length > 0 && gate.kind !== 'U' && (
        <text
          x={x}
          y={(controlled ? last : first) + 30}
          textAnchor="middle"
          className="gate-param"
          fill={color}
          opacity={0.9}
        >
          {fmtAngle(gate.params[0])}
        </text>
      )}
      {gate.kind === 'U' && (
        <text x={x} y={first + 30} textAnchor="middle" className="gate-param" fill={color} opacity={0.9}>
          {gate.params.map(fmtAngle).join(',')}
        </text>
      )}

      {/* classical condition */}
      {gate.condition && (
        <g>
          <rect x={x - 20} y={(controlled ? last : first) - 31} width={40} height={12} rx={4} fill="rgba(255,196,107,.14)" stroke="rgba(255,196,107,.45)" strokeWidth={0.8} />
          <text x={x} y={(controlled ? last : first) - 22} textAnchor="middle" className="gate-cond">
            c{gate.condition.qubit}={gate.condition.value}
          </text>
        </g>
      )}

      {/* delete affordance on selection */}
      {selected && (
        <g
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <circle cx={x + 23} cy={(controlled ? last : first) - 20} r={7.5} fill="#2a1020" stroke="rgba(255,122,168,.7)" strokeWidth={1} />
          <line x1={x + 20} y1={(controlled ? last : first) - 23} x2={x + 26} y2={(controlled ? last : first) - 17} stroke="#ff7aa8" strokeWidth={1.4} />
          <line x1={x + 26} y1={(controlled ? last : first) - 23} x2={x + 20} y2={(controlled ? last : first) - 17} stroke="#ff7aa8" strokeWidth={1.4} />
        </g>
      )}
    </g>
  )
}
