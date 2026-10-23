/**
 * Bayesian Knowledge Tracing (BKT) — the mastery model behind adaptive practice.
 *
 * Each topic carries four parameters from the classic Corbett & Anderson model:
 *   pInit    prior probability the learner already knows the skill
 *   pTransit chance of learning the skill on any opportunity
 *   pSlip    P(wrong | knows)
 *   pGuess   P(right | does not know)
 *
 * After every graded answer we compute the posterior P(knows | evidence) and
 * then apply the learning transition. That posterior becomes the mastery bar the
 * UI shows, and it feeds the recommendation engine.
 */

export interface BktParams {
  pInit: number
  pTransit: number
  pSlip: number
  pGuess: number
}

export interface MasteryState extends BktParams {
  /** Posterior P(learner knows this skill) after all evidence so far. */
  pKnown: number
  attempts: number
  correct: number
  /** Timestamp (ms) of the last graded attempt. */
  lastSeen: number
  /** Exponential moving average of response correctness — a pace signal. */
  fluency: number
}

export const DEFAULT_BKT: BktParams = {
  pInit: 0.15,
  pTransit: 0.12,
  pSlip: 0.1,
  pGuess: 0.22,
}

/** Harder topics get a lower prior and a slower learning rate. */
export function bktParamsForLevel(level: 'B' | 'I' | 'A' | 'F'): BktParams {
  switch (level) {
    case 'B':
      return { pInit: 0.18, pTransit: 0.16, pSlip: 0.08, pGuess: 0.25 }
    case 'I':
      return { ...DEFAULT_BKT }
    case 'A':
      return { pInit: 0.1, pTransit: 0.1, pSlip: 0.12, pGuess: 0.2 }
    case 'F':
      return { pInit: 0.06, pTransit: 0.08, pSlip: 0.15, pGuess: 0.18 }
  }
}

export function freshMastery(params: BktParams = DEFAULT_BKT, now = Date.now()): MasteryState {
  return { ...params, pKnown: params.pInit, attempts: 0, correct: 0, lastSeen: now, fluency: 0.5 }
}

const clamp01 = (v: number) => Math.max(0.001, Math.min(0.999, v))

/** Posterior P(knows | correct?) before the learning transition. */
export function posterior(pKnown: number, correct: boolean, p: Pick<BktParams, 'pSlip' | 'pGuess'>): number {
  const pK = clamp01(pKnown)
  if (correct) {
    const num = (1 - p.pSlip) * pK
    const den = num + p.pGuess * (1 - pK)
    return den === 0 ? pK : num / den
  }
  const num = p.pSlip * pK
  const den = num + (1 - p.pGuess) * (1 - pK)
  return den === 0 ? pK : num / den
}

/** One learning opportunity: observe an answer, update knowledge, then learn. */
export function observe(state: MasteryState, correct: boolean, now = Date.now()): MasteryState {
  const post = posterior(state.pKnown, correct, state)
  const learned = post + (1 - post) * state.pTransit
  const pKnown = Math.max(0.001, Math.min(0.995, learned))
  return {
    ...state,
    pKnown,
    attempts: state.attempts + 1,
    correct: state.correct + (correct ? 1 : 0),
    lastSeen: now,
    fluency: state.fluency * 0.7 + (correct ? 1 : 0) * 0.3,
  }
}

/** Fold a whole quiz result in at once (equivalent to sequential observation). */
export function observeAll(state: MasteryState, results: boolean[], now = Date.now()): MasteryState {
  return results.reduce((acc, correct) => observe(acc, correct, now), state)
}

export type MasteryStage = 'unseen' | 'novice' | 'developing' | 'proficient' | 'mastered'

export function masteryStage(state: MasteryState | undefined): MasteryStage {
  if (!state || state.attempts === 0) return 'unseen'
  if (state.pKnown < 0.35) return 'novice'
  if (state.pKnown < 0.6) return 'developing'
  if (state.pKnown < 0.85) return 'proficient'
  return 'mastered'
}

export const STAGE_LABEL: Record<MasteryStage, string> = {
  unseen: 'Not started',
  novice: 'Novice',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
}

export const MASTERED_THRESHOLD = 0.85

/** How much of a topic is left to learn, weighted by how recently it was seen. */
export function decayedMastery(state: MasteryState | undefined, now = Date.now()): number {
  if (!state) return 0
  const days = Math.max(0, (now - state.lastSeen) / 86_400_000)
  // Ebbinghaus-style retention: mastery fades towards the prior over weeks.
  const retention = Math.exp(-days / 28)
  return state.pKnown * retention + state.pInit * (1 - retention)
}

// ---------------------------------------------------------------------------
// Adaptive recommendation
// ---------------------------------------------------------------------------

export interface RecommendationInput {
  id: string
  title: string
  domain: string
  level: 'B' | 'I' | 'A' | 'F'
  prerequisites: string[]
  estimatedMinutes: number
}

export interface Recommendation {
  topic: RecommendationInput
  score: number
  reason: string
  unlocked: boolean
  mastery: number
}

export interface RecommendationContext {
  mastery: Record<string, MasteryState>
  /** Preferred session length in minutes; shorter topics win when time is short. */
  minutesAvailable?: number
  /** Recently visited topics, most recent first — used for variety. */
  recent?: string[]
  /** Domains the learner has shown an interest in. */
  focusDomains?: string[]
}

const LEVEL_RANK: Record<'B' | 'I' | 'A' | 'F', number> = { B: 0, I: 1, A: 2, F: 3 }

/**
 * Rank the next topics to study. Combines prerequisite readiness, the size of the
 * knowledge gap, difficulty fit against demonstrated mastery, and novelty.
 */
export function recommendTopics(
  topics: RecommendationInput[],
  ctx: RecommendationContext,
  limit = 6,
): Recommendation[] {
  const now = Date.now()
  const recent = new Set((ctx.recent ?? []).slice(0, 8))
  const avgMastery =
    topics.reduce((sum, t) => sum + decayedMastery(ctx.mastery[t.id], now), 0) / Math.max(1, topics.length)
  const learnerRank = LEVEL_RANK[avgMastery > 0.7 ? 'A' : avgMastery > 0.4 ? 'I' : 'B']

  return topics
    .map((topic) => {
      const state = ctx.mastery[topic.id]
      const m = decayedMastery(state, now)
      const prereqStates = topic.prerequisites.map((id) => {
        const p = ctx.mastery[id]
        return { id, m: p ? decayedMastery(p, now) : 0, started: !!p && p.attempts > 0 }
      })
      const weakestPrereq = prereqStates.reduce((min, p) => Math.min(min, p.m), 1)
      const unlocked = prereqStates.every((p) => p.m >= 0.55 || !ctx.mastery[p.id])

      // Knowledge gap: biggest payoff when the topic is neither known nor impossible.
      const gap = m === 0 ? 0.75 : 1 - m
      const readiness = prereqStates.length ? weakestPrereq : 0.8
      const levelFit = 1 - Math.abs(LEVEL_RANK[topic.level] - learnerRank) * 0.28
      const novelty = recent.has(topic.id) ? -0.35 : 0.12
      const interest = ctx.focusDomains?.includes(topic.domain) ? 0.1 : 0
      const timeFit =
        ctx.minutesAvailable && ctx.minutesAvailable < topic.estimatedMinutes
          ? -0.25 * (topic.estimatedMinutes / Math.max(1, ctx.minutesAvailable) - 1)
          : 0.05

      const score = gap * 1.5 + readiness * 1.2 + levelFit + novelty + interest + timeFit
      const reason = !unlocked
        ? `Finish ${prereqStates.filter((p) => p.m < 0.55).map((p) => p.id).join(', ')} first`
        : m === 0
          ? 'New ground — everything you need is already in place'
          : m < 0.5
            ? 'Shaky foundation — a short review will pay off'
            : m < 0.85
              ? 'Almost mastered — one more pass should lock it in'
              : 'Mastered — revisit to keep it fresh'

      return { topic, score, reason, unlocked, mastery: m }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Aggregate a learner profile per domain, for radar/heatmap views. */
export function domainMastery(
  mastery: Record<string, MasteryState>,
  topics: Array<{ id: string; domain: string }>,
): Record<string, { mastery: number; started: number; total: number }> {
  const out: Record<string, { mastery: number; started: number; total: number }> = {}
  const now = Date.now()
  for (const topic of topics) {
    const bucket = (out[topic.domain] ??= { mastery: 0, started: 0, total: 0 })
    bucket.total += 1
    const state = mastery[topic.id]
    if (state?.attempts) bucket.started += 1
    bucket.mastery += decayedMastery(state, now)
  }
  for (const key of Object.keys(out)) {
    out[key].mastery /= Math.max(1, out[key].total)
  }
  return out
}
