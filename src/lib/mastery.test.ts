import { describe, expect, it } from 'vitest'
import {
  bktParamsForLevel,
  decayedMastery,
  domainMastery,
  freshMastery,
  masteryStage,
  observe,
  observeAll,
  posterior,
  recommendTopics,
  MASTERED_THRESHOLD,
  type MasteryState,
} from './mastery'

const fake = (pKnown: number, attempts = 4): MasteryState => ({
  ...freshMastery(),
  pKnown,
  attempts,
  lastSeen: Date.now(),
})

describe('Bayesian Knowledge Tracing', () => {
  it('moves the posterior up on a correct answer and down on a wrong one', () => {
    const prior = 0.4
    const up = posterior(prior, true, { pSlip: 0.1, pGuess: 0.22 })
    const down = posterior(prior, false, { pSlip: 0.1, pGuess: 0.22 })
    expect(up).toBeGreaterThan(prior)
    expect(down).toBeLessThan(prior)
    // A correct answer on a low prior is strong evidence; a wrong one on a high prior is stronger.
    expect(up).toBeLessThan(0.95)
    expect(down).toBeGreaterThan(0.01)
  })

  it('stays inside the probability bounds after many observations', () => {
    let state = freshMastery()
    for (let i = 0; i < 40; i++) state = observe(state, true)
    expect(state.pKnown).toBeLessThanOrEqual(0.995)
    expect(state.pKnown).toBeGreaterThan(MASTERED_THRESHOLD)
    expect(state.correct).toBe(40)

    let failing = freshMastery()
    for (let i = 0; i < 40; i++) failing = observe(failing, false)
    expect(failing.pKnown).toBeGreaterThan(0)
    expect(failing.pKnown).toBeLessThan(0.4)
    expect(failing.correct).toBe(0)
  })

  it('increments attempts and tracks fluency', () => {
    const state = observe(observe(freshMastery(), true), false)
    expect(state.attempts).toBe(2)
    expect(state.correct).toBe(1)
    expect(state.fluency).toBeGreaterThan(0)
    expect(state.fluency).toBeLessThan(1)
  })

  it('observeAll matches sequential observation', () => {
    const sequential = observe(observe(observe(freshMastery(), true), false), true)
    const batched = observeAll(freshMastery(), [true, false, true])
    expect(batched.pKnown).toBeCloseTo(sequential.pKnown, 12)
    expect(batched.attempts).toBe(sequential.attempts)
  })

  it('uses harder priors for advanced levels', () => {
    expect(bktParamsForLevel('B').pInit).toBeGreaterThan(bktParamsForLevel('F').pInit)
    expect(bktParamsForLevel('B').pTransit).toBeGreaterThan(bktParamsForLevel('A').pTransit)
  })

  it('classifies mastery stages at the documented thresholds', () => {
    expect(masteryStage(undefined)).toBe('unseen')
    expect(masteryStage(fake(0.9, 0))).toBe('unseen')
    expect(masteryStage(fake(0.2))).toBe('novice')
    expect(masteryStage(fake(0.5))).toBe('developing')
    expect(masteryStage(fake(0.7))).toBe('proficient')
    expect(masteryStage(fake(0.9))).toBe('mastered')
  })

  it('returns zero for unseen topics and decays toward the prior over time', () => {
    const state = fake(0.9)
    expect(decayedMastery(undefined)).toBe(0)
    expect(decayedMastery(state, state.lastSeen)).toBeCloseTo(0.9, 6)

    const later = decayedMastery(state, state.lastSeen + 28 * 86_400_000)
    expect(later).toBeLessThan(0.9)
    expect(later).toBeGreaterThan(state.pInit)

    const muchLater = decayedMastery(state, state.lastSeen + 365 * 86_400_000)
    expect(muchLater).toBeCloseTo(state.pInit, 3)
  })
})

describe('recommendTopics', () => {
  const topics = [
    { id: 'A', title: 'A', domain: 'gates', level: 'B' as const, prerequisites: [], estimatedMinutes: 10 },
    { id: 'B', title: 'B', domain: 'gates', level: 'B' as const, prerequisites: ['A'], estimatedMinutes: 10 },
    { id: 'C', title: 'C', domain: 'algorithms', level: 'I' as const, prerequisites: ['B'], estimatedMinutes: 25 },
  ]

  it('reports locked topics with the missing prerequisite named', () => {
    const mastery = { A: fake(0.2), B: fake(0.1) }
    const result = recommendTopics(topics, { mastery }, 3)
    const rec = result.find((r) => r.topic.id === 'C')!
    expect(rec.unlocked).toBe(false)
    expect(rec.reason).toContain('B')
  })

  it('unlocks a topic once every prerequisite is mastered', () => {
    const mastery = { A: fake(0.9), B: fake(0.9) }
    const result = recommendTopics(topics, { mastery }, 3)
    const rec = result.find((r) => r.topic.id === 'C')!
    expect(rec.unlocked).toBe(true)
  })

  it('respects the limit and always returns fresh objects', () => {
    const result = recommendTopics(topics, { mastery: {} }, 2)
    expect(result).toHaveLength(2)
    expect(result[0]).not.toBe(result[1])
    expect(result.every((r) => r.topic)).toBe(true)
  })
})

describe('domainMastery', () => {
  it('averages mastered topics per domain and counts started ones', () => {
    const mastery = { a1: fake(0.9), a2: fake(0.3), b1: fake(0.6) }
    const result = domainMastery(mastery, [
      { id: 'a1', domain: 'alpha' },
      { id: 'a2', domain: 'alpha' },
      { id: 'b1', domain: 'beta' },
      { id: 'b2', domain: 'beta' },
    ])
    expect(result.alpha.total).toBe(2)
    expect(result.alpha.started).toBe(2)
    expect(result.alpha.mastery).toBeCloseTo(0.6, 6)
    expect(result.beta.started).toBe(1)
    expect(result.beta.total).toBe(2)
    expect(result.beta.mastery).toBeCloseTo(0.3, 6)
  })
})
