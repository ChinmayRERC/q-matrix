/**
 * Qubit Lab: a small grid game for learning the first quantum ideas.
 * Place gates on two qubit wires, press Run, and the level is graded on the
 * exact simulated probabilities. Prototype: progress is kept in this page only.
 */
import { useMemo, useState } from 'react'
import { ArrowRight, RotateCcw, Play, Trophy, X } from 'lucide-react'
import { bitString } from '../lib/quantum/circuit'
import { simulate } from '../lib/quantum/simulator'
import {
  boardToCircuit,
  COLUMNS,
  emptyBoard,
  gateCount,
  gradeMission,
  MISSIONS,
  ROWS,
  type Board,
  type Cell,
  type Tool,
} from '../lib/game/missions'
import { Btn, Panel } from './ui'

const TOOLS: Array<{ id: Tool | 'erase'; label: string }> = [
  { id: 'H', label: 'H' },
  { id: 'X', label: 'X' },
  { id: 'Z', label: 'Z' },
  { id: 'CNOT', label: 'CNOT' },
  { id: 'erase', label: 'Erase' },
]

const CELL_LABEL: Record<Exclude<Cell, null>, string> = { H: 'H', X: 'X', Z: 'Z', C: '●', T: '⊕' }

export function QuantumGame() {
  const [missionIndex, setMissionIndex] = useState(0)
  const [board, setBoard] = useState<Board>(emptyBoard)
  const [tool, setTool] = useState<Tool | 'erase'>('H')
  const [cleared, setCleared] = useState<Set<string>>(() => new Set())
  const [checked, setChecked] = useState<{ passed: boolean; perfect: boolean; gates: number } | null>(null)

  const mission = MISSIONS[missionIndex]
  const gates = gateCount(board)

  const outcomes = useMemo(() => {
    if (checked === null) return null
    const result = simulate(boardToCircuit(board), { shots: 1024 })
    return result.probabilities.map((p, i) => ({ label: bitString(i, ROWS), p }))
  }, [board, checked])

  const changeBoard = (next: Board) => {
    setBoard(next)
    setChecked(null)
  }

  const place = (c: number, r: number) => {
    const next = board.map((column) => [...column]) as Board
    const cell = next[c][r]
    const pair = cell === 'C' || cell === 'T'
    if (tool === 'erase' || pair) {
      if (pair) {
        next[c][0] = null
        next[c][1] = null
      } else {
        next[c][r] = null
      }
      return changeBoard(next)
    }
    if (tool === 'CNOT') {
      if (next[c][0] !== null || next[c][1] !== null) return
      next[c][0] = 'C'
      next[c][1] = 'T'
      return changeBoard(next)
    }
    next[c][r] = tool
    changeBoard(next)
  }

  const run = () => {
    const grade = gradeMission(mission, board)
    setChecked({ passed: grade.passed, perfect: grade.perfect, gates: grade.gates })
    if (grade.passed) setCleared((prev) => new Set(prev).add(mission.id))
  }

  const reset = () => {
    setBoard(emptyBoard())
    setChecked(null)
  }

  const chooseMission = (index: number) => {
    setMissionIndex(index)
    reset()
  }

  const isCleared = cleared.has(mission.id)

  return (
    <div className="stack gap-16 fade-in">
      <Panel title="Qubit Lab" sub="Place gates, press Run, and make the level come true.">
        <div className="qg-missions" role="tablist" aria-label="Missions">
          {MISSIONS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === missionIndex}
              className={`qg-mission ${i === missionIndex ? 'on' : ''}`}
              onClick={() => chooseMission(i)}
            >
              {cleared.has(m.id) && <Trophy size={12} />}
              {m.title}
            </button>
          ))}
        </div>
        <p className="qg-brief">
          <strong>{mission.title}:</strong> {mission.brief}
        </p>
        <p className="tiny dim">
          Gates: {gates} · par {mission.par}
        </p>
      </Panel>

      <Panel title="Your circuit" sub="Click a wire to place the selected gate. Click a gate to remove it.">
        <div className="qg-tools" role="group" aria-label="Gate tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`qg-tool ${tool === t.id ? 'on' : ''}`}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="qg-board" style={{ gridTemplateColumns: `56px repeat(${COLUMNS}, minmax(0, 1fr))` }}>
          {Array.from({ length: ROWS }, (_, r) => (
            <div className="qg-row" key={`row-${r}`} style={{ display: 'contents' }}>
              <span className="qg-wire-label">q{r}</span>
              {Array.from({ length: COLUMNS }, (_, c) => {
                const cell = board[c][r]
                return (
                  <button
                    key={`${c}-${r}`}
                    type="button"
                    className={`qg-cell ${cell ? `filled filled-${cell}` : ''}`}
                    aria-label={`Column ${c + 1}, qubit ${r}${cell ? `, ${CELL_LABEL[cell]}` : ''}`}
                    onClick={() => place(c, r)}
                  >
                    {cell ? CELL_LABEL[cell] : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="qg-actions">
          <Btn variant="primary" onClick={run} disabled={gates === 0}>
            <Play size={13} /> Run
          </Btn>
          <Btn variant="ghost" onClick={reset}>
            <RotateCcw size={13} /> Clear board
          </Btn>
        </div>

        {checked && (
          <div className={`qg-result ${checked.passed ? 'win' : 'miss'}`} role="status">
            {checked.passed ? (
              <>
                <strong>
                  <Trophy size={14} /> {checked.perfect ? 'Perfect!' : 'Level cleared.'}
                </strong>
                <span>{mission.why}</span>
                {mission.id !== MISSIONS[MISSIONS.length - 1].id && (
                  <Btn variant="cyan" onClick={() => chooseMission(missionIndex + 1)}>
                    Next level <ArrowRight size={13} />
                  </Btn>
                )}
              </>
            ) : (
              <>
                <strong>
                  <X size={14} /> Not yet.
                </strong>
                <span>{mission.hint}</span>
              </>
            )}
            {outcomes && (
              <div className="qg-bars" aria-label="Outcome probabilities">
                {outcomes.map((o) => (
                  <div key={o.label} className="qg-bar">
                    <span className="mono tiny">|{o.label}⟩</span>
                    <div className="qg-track">
                      <i style={{ width: `${Math.round(o.p * 100)}%` }} />
                    </div>
                    <span className="mono tiny dim">{Math.round(o.p * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isCleared && <p className="tiny dim">Cleared: {cleared.size} of {MISSIONS.length} levels.</p>}
      </Panel>
    </div>
  )
}
