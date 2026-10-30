import { describe, expect, it } from 'vitest'
import { emptyBoard, gateCount, gradeMission, MISSIONS, type Board } from '../missions'

const mission = (id: string) => MISSIONS.find((m) => m.id === id)!

const withCells = (cells: Array<[number, number, Board[number][number]]>): Board => {
  const board = emptyBoard()
  cells.forEach(([c, r, cell]) => {
    board[c][r] = cell
  })
  return board
}

describe('Qubit Lab missions', () => {
  it('clears "Light the bulb" with one X on qubit 0', () => {
    const board = withCells([[0, 0, 'X']])
    expect(gradeMission(mission('flip'), board)).toEqual({ passed: true, gates: 1, perfect: true })
  })

  it('fails "Light the bulb" with nothing on the board', () => {
    expect(gradeMission(mission('flip'), emptyBoard()).passed).toBe(false)
  })

  it('clears "Fair coin" with H on qubit 0', () => {
    expect(gradeMission(mission('coin'), withCells([[0, 0, 'H']])).passed).toBe(true)
  })

  it('does not clear "Fair coin" with a plain X', () => {
    expect(gradeMission(mission('coin'), withCells([[0, 0, 'X']])).passed).toBe(false)
  })

  it('clears "Matching pair" with H then CNOT, within par', () => {
    const board = withCells([
      [0, 0, 'H'],
      [1, 0, 'C'],
      [1, 1, 'T'],
    ])
    expect(gradeMission(mission('bell'), board)).toEqual({ passed: true, gates: 2, perfect: true })
  })

  it('fails "Matching pair" with H alone', () => {
    expect(gradeMission(mission('bell'), withCells([[0, 0, 'H']])).passed).toBe(false)
  })

  it('counts a CNOT as one gate and a lone control as none', () => {
    expect(gateCount(withCells([[0, 0, 'C'], [0, 1, 'T']]))).toBe(1)
    expect(gateCount(withCells([[0, 0, 'C']]))).toBe(0)
  })
})
