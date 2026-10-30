/**
 * Qubit Lab: the grid game's rules.
 *
 * The grid has two qubit rows and a few time columns. Each cell holds one
 * gate, and a CNOT takes a control cell on row 0 and a target cell on row 1 in
 * the same column. Missions are graded on the exact simulated probabilities, so
 * a shot-noise fluke can't pass or fail a level.
 */
import { addGate, emptyCircuit, type Circuit } from '../quantum/circuit'
import { simulate } from '../quantum/simulator'

export type Tool = 'H' | 'X' | 'Z' | 'CNOT'
export type Cell = null | 'H' | 'X' | 'Z' | 'C' | 'T'
export const ROWS = 2
export const COLUMNS = 4

/** columns[c][r] is the cell at time step c on qubit r. */
export type Board = Cell[][]

export const emptyBoard = (): Board => Array.from({ length: COLUMNS }, () => Array<Cell>(ROWS).fill(null))

export function boardToCircuit(board: Board): Circuit {
  let circuit = emptyCircuit(ROWS, 'Qubit Lab')
  board.forEach((column, c) => {
    column.forEach((cell, r) => {
      if (cell === 'H' || cell === 'X' || cell === 'Z') circuit = addGate(circuit, cell, [r], c)
    })
    if (column[0] === 'C' && column[1] === 'T') circuit = addGate(circuit, 'CNOT', [0, 1], c)
  })
  return circuit
}

/** Gates on the board. A CNOT counts once, however many cells it covers. */
export function gateCount(board: Board): number {
  return board.reduce((total, column) => {
    const singles = column.filter((cell) => cell === 'H' || cell === 'X' || cell === 'Z').length
    const cnot = column[0] === 'C' && column[1] === 'T' ? 1 : 0
    return total + singles + cnot
  }, 0)
}

export interface Mission {
  id: string
  title: string
  brief: string
  /** Gates allowed for the top rating. */
  par: number
  /** True when the exact outcome probabilities (index = bits, q0 is bit 0) meet the goal. */
  goal: (probs: number[]) => boolean
  /** Shown when the level isn't cleared. */
  hint: string
  /** Shown after the level is cleared. */
  why: string
}

export const MISSIONS: Mission[] = [
  {
    id: 'flip',
    title: 'Light the bulb',
    brief: 'Make qubit 0 read 1 every single time.',
    par: 1,
    goal: (p) => p[1] + p[3] >= 0.98,
    hint: 'A qubit starts at 0. Put one gate on qubit 0 that flips it.',
    why: 'X flips 0 to 1 with certainty. Measurement always returns 1.',
  },
  {
    id: 'coin',
    title: 'Fair coin',
    brief: 'Make qubit 0 read 0 or 1 with equal chance.',
    par: 1,
    goal: (p) => {
      const oneShare = p[1] + p[3]
      return oneShare >= 0.45 && oneShare <= 0.55
    },
    hint: 'Try H on qubit 0. It puts the qubit into an equal mix of 0 and 1.',
    why: 'H creates an equal superposition. Measuring it gives 0 or 1 at random, half each time.',
  },
  {
    id: 'bell',
    title: 'Matching pair',
    brief: 'Make both qubits always agree: only 00 or 11 may appear, about half each.',
    par: 2,
    goal: (p) => p[0] + p[3] >= 0.98 && p[0] >= 0.45 && p[3] >= 0.45,
    hint: 'Start with H on qubit 0 to create the coin. Then link qubit 1 to it with a CNOT.',
    why: 'CNOT copies the coin onto qubit 1. The two results are now locked together: 00 or 11, never 01 or 10.',
  },
]

export interface Grade {
  passed: boolean
  gates: number
  /** True when the level was cleared within par. */
  perfect: boolean
}

export function gradeMission(mission: Mission, board: Board): Grade {
  const gates = gateCount(board)
  if (gates === 0) return { passed: false, gates, perfect: false }
  const result = simulate(boardToCircuit(board), { shots: 1024 })
  const passed = mission.goal(result.probabilities)
  return { passed, gates, perfect: passed && gates <= mission.par }
}
