/**
 * Gamification core: XP curve, levels, streaks, badges and daily quests.
 * Pure functions so the rules can be unit-tested and replayed deterministically.
 */

export interface LevelInfo {
  level: number
  title: string
  xpIntoLevel: number
  xpForLevel: number
  progress: number
  nextLevelXp: number
}

const LEVEL_TITLES = [
  'Observer',
  'Superposition',
  'Entangler',
  'Circuit Smith',
  'Oracle',
  'Algorithmist',
  'State Whisperer',
  'Quantum Architect',
  'Field Theorist',
  'Error Corrector',
  'Fault Tolerant',
  'Quantum Advantage',
]

/** XP needed to *reach* level n (1-indexed). Grows quadratically so early wins feel fast. */
export const xpForLevel = (level: number): number => {
  if (level <= 1) return 0
  const n = level - 1
  return 60 * n + 25 * n * (n - 1)
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const span = Math.max(1, next - base)
  return {
    level,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, level - 1)],
    xpIntoLevel: xp - base,
    xpForLevel: span,
    progress: Math.min(1, Math.max(0, (xp - base) / span)),
    nextLevelXp: next,
  }
}

// ---------------------------------------------------------------------------
// XP awards
// ---------------------------------------------------------------------------

export const XP = {
  correctAnswer: 12,
  wrongAnswer: 3,
  lessonComplete: 60,
  perfectQuiz: 40,
  challengeSolved: 90,
  challengeFirstTry: 45,
  newTopic: 25,
  dailyStreak: 20,
  teachingMoment: 15,
} as const

/** Difficulty multiplier so frontier content pays more. */
export const levelMultiplier = (level: 'B' | 'I' | 'A' | 'F'): number =>
  ({ B: 1, I: 1.25, A: 1.6, F: 2 })[level]

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export interface StreakState {
  count: number
  best: number
  /** Local calendar day key, e.g. "2026-10-22". */
  lastDay: string | null
}

export const dayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function daysBetween(a: string, b: string): number {
  const toDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toDate(b) - toDate(a)) / 86_400_000)
}

/** Advance the streak for today's activity. Idempotent within a day. */
export function touchStreak(state: StreakState, today = dayKey()): { state: StreakState; extended: boolean } {
  if (state.lastDay === today) return { state, extended: false }
  const gap = state.lastDay ? daysBetween(state.lastDay, today) : Infinity
  const count = gap === 1 ? state.count + 1 : 1
  return {
    state: { count, best: Math.max(state.best, count), lastDay: today },
    extended: true,
  }
}

/** Streak value as it should be displayed — a missed day resets it to zero. */
export function liveStreak(state: StreakState, today = dayKey()): number {
  if (!state.lastDay) return 0
  const gap = daysBetween(state.lastDay, today)
  return gap <= 1 ? state.count : 0
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeStats {
  xp: number
  lessonsCompleted: number
  challengesSolved: number
  topicsMastered: number
  streakBest: number
  perfectQuizzes: number
  entanglingCircuits: number
  algorithmsRun: number
  domainsTouched: number
  tutorQuestions: number
  noiseRuns: number
  nightOwl: boolean
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'legendary'
  test: (s: BadgeStats) => boolean
  progress?: (s: BadgeStats) => number
}

export const BADGES: Badge[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first Virtual Lab lesson.',
    icon: 'sparkles',
    tier: 'bronze',
    test: (s) => s.lessonsCompleted >= 1,
    progress: (s) => Math.min(1, s.lessonsCompleted),
  },
  {
    id: 'entangler',
    name: 'Entangler',
    description: 'Build a circuit that produces genuine entanglement (concurrence > 0.9).',
    icon: 'git-fork',
    tier: 'bronze',
    test: (s) => s.entanglingCircuits >= 1,
    progress: (s) => Math.min(1, s.entanglingCircuits),
  },
  {
    id: 'groverite',
    name: 'Amplitude Amplifier',
    description: 'Run a Grover search circuit with >95% success probability.',
    icon: 'search',
    tier: 'silver',
    test: (s) => s.algorithmsRun >= 1,
    progress: (s) => Math.min(1, s.algorithmsRun),
  },
  {
    id: 'streak-7',
    name: 'Week of Wonders',
    description: 'Keep a 7-day learning streak.',
    icon: 'flame',
    tier: 'silver',
    test: (s) => s.streakBest >= 7,
    progress: (s) => Math.min(1, s.streakBest / 7),
  },
  {
    id: 'streak-30',
    name: 'Event Horizon',
    description: 'Keep a 30-day learning streak.',
    icon: 'flame',
    tier: 'legendary',
    test: (s) => s.streakBest >= 30,
    progress: (s) => Math.min(1, s.streakBest / 30),
  },
  {
    id: 'perfect-5',
    name: 'Flawless Five',
    description: 'Ace five quizzes with no mistakes.',
    icon: 'target',
    tier: 'gold',
    test: (s) => s.perfectQuizzes >= 5,
    progress: (s) => Math.min(1, s.perfectQuizzes / 5),
  },
  {
    id: 'challenger',
    name: 'Circuit Breaker',
    description: 'Solve 10 challenges.',
    icon: 'swords',
    tier: 'silver',
    test: (s) => s.challengesSolved >= 10,
    progress: (s) => Math.min(1, s.challengesSolved / 10),
  },
  {
    id: 'polymath',
    name: 'Polymath',
    description: 'Master topics in 6 different domains.',
    icon: 'globe',
    tier: 'gold',
    test: (s) => s.domainsTouched >= 6,
    progress: (s) => Math.min(1, s.domainsTouched / 6),
  },
  {
    id: 'noise-whisperer',
    name: 'Noise Whisperer',
    description: 'Run 5 experiments with a noisy backend.',
    icon: 'radio',
    tier: 'silver',
    test: (s) => s.noiseRuns >= 5,
    progress: (s) => Math.min(1, s.noiseRuns / 5),
  },
  {
    id: 'curious',
    name: 'Curious Mind',
    description: 'Ask Chinnu 25 questions.',
    icon: 'bot',
    tier: 'bronze',
    test: (s) => s.tutorQuestions >= 25,
    progress: (s) => Math.min(1, s.tutorQuestions / 25),
  },
  {
    id: 'level-5',
    name: 'Oracle',
    description: 'Reach level 5.',
    icon: 'crown',
    tier: 'gold',
    test: (s) => levelInfo(s.xp).level >= 5,
    progress: (s) => Math.min(1, (levelInfo(s.xp).level - 1) / 4),
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Study a lesson after midnight.',
    icon: 'moon',
    tier: 'bronze',
    test: (s) => s.nightOwl,
  },
]

/** Badges whose test just flipped to true, in stable order. */
export function newlyEarned(earned: string[], stats: BadgeStats): Badge[] {
  return BADGES.filter((b) => !earned.includes(b.id) && b.test(stats))
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export type QuestMetric =
  | 'lessonComplete'
  | 'challengeSolved'
  | 'correctAnswer'
  | 'newTopic'
  | 'noiseRun'
  | 'tutorQuestion'

export interface QuestDef {
  id: string
  label: string
  detail: string
  metric: QuestMetric
  target: number
  xp: number
  cadence: 'daily' | 'weekly'
}

export const QUESTS: QuestDef[] = [
  { id: 'daily-lesson', label: 'Enter the lab', detail: 'Complete one Virtual Lab lesson.', metric: 'lessonComplete', target: 1, xp: 40, cadence: 'daily' },
  { id: 'daily-answers', label: 'Ten sparks', detail: 'Answer 10 questions correctly.', metric: 'correctAnswer', target: 10, xp: 30, cadence: 'daily' },
  { id: 'daily-challenge', label: 'Crack a challenge', detail: 'Solve any circuit challenge.', metric: 'challengeSolved', target: 1, xp: 35, cadence: 'daily' },
  { id: 'daily-curiosity', label: 'Ask Chinnu', detail: 'Ask the AI tutor two questions.', metric: 'tutorQuestion', target: 2, xp: 20, cadence: 'daily' },
  { id: 'weekly-topics', label: 'New territory', detail: 'Start 7 topics this week.', metric: 'newTopic', target: 7, xp: 90, cadence: 'weekly' },
  { id: 'weekly-noise', label: 'Face the noise', detail: 'Run 3 noisy experiments.', metric: 'noiseRun', target: 3, xp: 60, cadence: 'weekly' },
]

export interface QuestProgress {
  id: string
  count: number
  claimed: boolean
}

export const questComplete = (def: QuestDef, progress?: QuestProgress): boolean =>
  (progress?.count ?? 0) >= def.target

/** Week key (ISO-ish) so weekly quests reset on Monday. */
export function weekKey(d: Date = new Date()): string {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return dayKey(date)
}
