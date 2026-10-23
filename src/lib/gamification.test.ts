import { describe, expect, it } from 'vitest'
import {
  BADGES,
  QUESTS,
  dayKey,
  daysBetween,
  levelInfo,
  liveStreak,
  newlyEarned,
  questComplete,
  touchStreak,
  weekKey,
  xpForLevel,
  type BadgeStats,
  type StreakState,
} from './gamification'

const zeroStats: BadgeStats = {
  xp: 0,
  lessonsCompleted: 0,
  challengesSolved: 0,
  topicsMastered: 0,
  streakBest: 0,
  perfectQuizzes: 0,
  entanglingCircuits: 0,
  algorithmsRun: 0,
  domainsTouched: 0,
  tutorQuestions: 0,
  noiseRuns: 0,
  nightOwl: false,
}

const empty: StreakState = { count: 0, best: 0, lastDay: null }

describe('XP curve and levels', () => {
  it('starts at zero and grows monotonically', () => {
    expect(xpForLevel(1)).toBe(0)
    for (let l = 1; l < 20; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l))
  })

  it('promotes exactly at the threshold', () => {
    const justBelow = levelInfo(xpForLevel(3) - 1)
    expect(justBelow.level).toBe(2)
    const atThreshold = levelInfo(xpForLevel(3))
    expect(atThreshold.level).toBe(3)
    expect(atThreshold.xpIntoLevel).toBe(0)
    expect(atThreshold.progress).toBe(0)
  })

  it('reports progress inside the level', () => {
    const base = xpForLevel(4)
    const span = xpForLevel(5) - base
    const info = levelInfo(base + span / 2)
    expect(info.level).toBe(4)
    expect(info.progress).toBeCloseTo(0.5, 6)
    expect(info.nextLevelXp).toBe(xpForLevel(5))
    expect(info.title.length).toBeGreaterThan(0)
  })

  it('never reports negative progress', () => {
    expect(levelInfo(0).progress).toBe(0)
    expect(levelInfo(0).level).toBe(1)
  })
})

describe('streaks', () => {
  it('counts calendar days, not elapsed hours', () => {
    expect(daysBetween('2026-10-20', '2026-10-22')).toBe(2)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('extends on the next day and is idempotent within one day', () => {
    const first = touchStreak(empty, '2026-10-21')
    expect(first.extended).toBe(true)
    expect(first.state.count).toBe(1)
    expect(first.state.best).toBe(1)

    const again = touchStreak(first.state, '2026-10-21')
    expect(again.extended).toBe(false)
    expect(again.state).toBe(first.state)

    const next = touchStreak(first.state, '2026-10-22')
    expect(next.extended).toBe(true)
    expect(next.state.count).toBe(2)
    expect(next.state.best).toBe(2)
  })

  it('resets to one after a missed day but keeps the best', () => {
    const state: StreakState = { count: 9, best: 12, lastDay: '2026-10-19' }
    const resumed = touchStreak(state, '2026-10-22')
    expect(resumed.state.count).toBe(1)
    expect(resumed.state.best).toBe(12)
    expect(resumed.state.lastDay).toBe('2026-10-22')
  })

  it('shows zero when today is missed', () => {
    const state: StreakState = { count: 4, best: 4, lastDay: '2026-10-20' }
    expect(liveStreak(state, '2026-10-20')).toBe(4)
    expect(liveStreak(state, '2026-10-21')).toBe(4)
    expect(liveStreak(state, '2026-10-22')).toBe(0)
    expect(liveStreak(empty, '2026-10-22')).toBe(0)
  })
})

describe('badges', () => {
  it('defines unique ids across all tiers', () => {
    const ids = BADGES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(BADGES.length).toBeGreaterThanOrEqual(12)
    expect(new Set(BADGES.map((b) => b.tier)).size).toBe(4)
  })

  it('awards nothing for a blank profile', () => {
    expect(newlyEarned([], zeroStats)).toHaveLength(0)
  })

  it('awards only newly earned badges', () => {
    const stats = { ...zeroStats, lessonsCompleted: 1, xp: 5000 }
    const earned = newlyEarned([], stats).map((b) => b.id)
    expect(earned).toContain('first-steps')
    expect(newlyEarned(earned, stats)).toHaveLength(0)
  })

  it('exposes bounded progress for locked badges', () => {
    for (const badge of BADGES) {
      if (!badge.progress) continue
      for (const value of [0, 25, 1000]) {
        const p = badge.progress({ ...zeroStats, streakBest: value, tutorQuestions: value, xp: value * 100 })
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    }
  })

  it('includes night owl only when reported by the clock', () => {
    const night = BADGES.find((b) => b.id === 'night-owl')!
    expect(night.test({ ...zeroStats, nightOwl: false })).toBe(false)
    expect(night.test({ ...zeroStats, nightOwl: true })).toBe(true)
  })
})

describe('quests', () => {
  it('has positive targets and XP', () => {
    for (const q of QUESTS) {
      expect(q.target).toBeGreaterThan(0)
      expect(q.xp).toBeGreaterThan(0)
    }
  })

  it('completes at the target count', () => {
    const quest = QUESTS[0]
    expect(questComplete(quest, { id: quest.id, count: quest.target - 1, claimed: false })).toBe(false)
    expect(questComplete(quest, { id: quest.id, count: quest.target, claimed: false })).toBe(true)
    expect(questComplete(quest, undefined)).toBe(false)
  })

  it('keys weeks by Monday', () => {
    // 2026-10-22 is a Thursday; the week starts Monday 2026-10-19.
    expect(weekKey(new Date(2026, 9, 22))).toBe('2026-10-19')
    expect(weekKey(new Date(2026, 9, 19))).toBe('2026-10-19')
  })
})
