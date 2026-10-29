/**
 * Single source of truth for learner progress, the circuit workspace and the
 * gamification state. Persisted to localStorage so a refresh never loses work.
 *
 * Everything here is JSON-serialisable: the circuit is plain data, mastery is a
 * BKT posterior, and the quest ledger is keyed by calendar day / week.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DeviceId } from '../lib/quantum/hardware'
import {
  BADGES,
  QUESTS,
  XP as XP_AWARD,
  dayKey,
  levelInfo,
  liveStreak,
  newlyEarned,
  touchStreak,
  weekKey,
  type BadgeStats,
  type QuestMetric,
  type StreakState,
} from '../lib/gamification'
import { freshMastery, observe, type MasteryState } from '../lib/mastery'
import { learningGain } from '../lib/lessons'
import { emptyCircuit, type Circuit, type Gate } from '../lib/quantum/circuit'
import { TEMPLATES } from '../lib/quantum/templates'
import type { SimResult } from '../lib/quantum/simulator'
import { concurrence } from '../lib/quantum/analysis'
import type { NoiseConfig } from '../lib/quantum/simulator'

export interface LessonProgress {
  startedAt: number
  completedAt?: number
  pre: number
  post: number
  gain: number
  attempts: number
}

export interface ChallengeProgress {
  attempts: number
  solved: boolean
  firstTry: boolean
  bestScore: number
}

interface QuestLedger {
  key: string
  progress: Record<string, number>
  claimed: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  source?: 'nvidia' | 'claude' | 'local'
  at: number
}

export interface Toast {
  id: string
  title: string
  detail?: string
  tone: 'xp' | 'badge' | 'quest' | 'error' | 'info'
}

export interface Settings {
  shots: number
  noisy: boolean
  /** 0..1 depolarising strength when `noisy` is on. */
  noiseLevel: number
  /** Target hardware profile; `custom` uses the manual noise controls. */
  device: DeviceId
  reduceMotion: boolean
  /** Display order for multi-qubit kets. */
  showAmplitudes: boolean
  tutorEnabled: boolean
}

export interface AppState {
  // ---- learner ----
  name: string
  xp: number
  streak: StreakState
  badges: string[]
  mastery: Record<string, MasteryState>
  lessons: Record<string, LessonProgress>
  challenges: Record<string, ChallengeProgress>
  daily: QuestLedger
  weekly: QuestLedger
  counters: {
    entanglingCircuits: number
    algorithmsRun: number
    perfectQuizzes: number
    noiseRuns: number
    tutorQuestions: number
    nightOwl: boolean
  }
  recent: string[]

  // ---- workspace ----
  circuit: Circuit
  settings: Settings
  chat: ChatMessage[]
  toasts: Toast[]

  // ---- actions ----
  setName: (name: string) => void
  setCircuit: (circuit: Circuit) => void
  patchCircuit: (patch: Partial<Circuit>) => void
  addGateToCircuit: (gate: Gate) => void
  removeGate: (gateId: string) => void
  moveGate: (gateId: string, column: number) => void
  clearCircuit: () => void
  loadTemplate: (templateId: string) => void
  setSettings: (patch: Partial<Settings>) => void

  awardXp: (amount: number, reason?: string) => void
  recordAnswer: (topicId: string, correct: boolean) => void
  startLesson: (topicId: string) => void
  completeLesson: (topicId: string, pre: number, post: number, xp?: number) => void
  recordChallenge: (challengeId: string, xp: number, result: { passed: boolean; score: number }, attempt: number) => void
  recordTutorQuestion: () => void
  recordNoiseRun: () => void
  inspectCircuitResult: (sim: SimResult, templateId?: string | null) => void
  visitTopic: (topicId: string) => void

  pushChat: (message: Omit<ChatMessage, 'id' | 'at'>) => void
  clearChat: () => void

  claimQuest: (questId: string) => void
  toast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  resetProgress: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

const defaultSettings: Settings = {
  shots: 1024,
  noisy: false,
  noiseLevel: 0.02,
  device: 'ideal',
  reduceMotion: false,
  showAmplitudes: true,
  tutorEnabled: true,
}

const emptyLedger = (key: string): QuestLedger => ({ key, progress: {}, claimed: [] })

function ensureLedger(ledger: QuestLedger, key: string): QuestLedger {
  if (ledger.key === key) return ledger
  // A new day/week: keep nothing but the fresh key.
  return { key, progress: {}, claimed: [] }
}

const initialState = () => ({
  name: 'Explorer',
  xp: 0,
  streak: { count: 0, best: 0, lastDay: null } as StreakState,
  badges: [] as string[],
  mastery: {} as Record<string, MasteryState>,
  lessons: {} as Record<string, LessonProgress>,
  challenges: {} as Record<string, ChallengeProgress>,
  daily: emptyLedger(dayKey()),
  weekly: emptyLedger(weekKey()),
  counters: {
    entanglingCircuits: 0,
    algorithmsRun: 0,
    perfectQuizzes: 0,
    noiseRuns: 0,
    tutorQuestions: 0,
    nightOwl: false,
  },
  recent: [] as string[],
  circuit: TEMPLATES.find((t) => t.id === 'bell')!.build(),
  settings: defaultSettings,
  chat: [] as ChatMessage[],
  toasts: [] as Toast[],
})

/** Flatten persisted state into the badge stat shape. */
export function deriveStats(state: AppState): BadgeStats {
  const masteredIds = Object.entries(state.mastery).filter(([, m]) => m.pKnown >= 0.85).map(([id]) => id)
  return {
    xp: state.xp,
    lessonsCompleted: Object.values(state.lessons).filter((l) => l.completedAt).length,
    challengesSolved: Object.values(state.challenges).filter((c) => c.solved).length,
    topicsMastered: masteredIds.length,
    streakBest: state.streak.best,
    perfectQuizzes: state.counters.perfectQuizzes,
    entanglingCircuits: state.counters.entanglingCircuits,
    algorithmsRun: state.counters.algorithmsRun,
    domainsTouched: new Set(state.recent.map((id) => id.split('-')[0])).size,
    tutorQuestions: state.counters.tutorQuestions,
    noiseRuns: state.counters.noiseRuns,
    nightOwl: state.counters.nightOwl,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setName: (name) => set({ name: name.trim() || 'Explorer' }),

      setCircuit: (circuit) => set({ circuit }),
      patchCircuit: (patch) => set((s) => ({ circuit: { ...s.circuit, ...patch } })),
      addGateToCircuit: (gate) => set((s) => ({ circuit: { ...s.circuit, gates: [...s.circuit.gates, gate] } })),
      removeGate: (gateId) =>
        set((s) => ({ circuit: { ...s.circuit, gates: s.circuit.gates.filter((g) => g.id !== gateId) } })),
      moveGate: (gateId, column) =>
        set((s) => ({
          circuit: {
            ...s.circuit,
            gates: s.circuit.gates.map((g) => (g.id === gateId ? { ...g, column: Math.max(0, column) } : g)),
          },
        })),
      clearCircuit: () => set((s) => ({ circuit: emptyCircuit(s.circuit.numQubits, 'Untitled circuit') })),
      loadTemplate: (templateId) => {
        const template = TEMPLATES.find((t) => t.id === templateId)
        if (template) set({ circuit: template.build() })
      },
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      awardXp: (amount, reason) => {
        if (amount <= 0) return
        const before = levelInfo(get().xp).level
        const after = levelInfo(get().xp + amount).level
        set((s) => ({ xp: s.xp + amount }))
        if (after > before) {
          set({ toasts: [...get().toasts, { id: uid(), title: `Level ${after}`, detail: levelInfo(get().xp).title, tone: 'xp' }] })
        }
        void reason
      },

      recordAnswer: (topicId, correct) => {
        const prev = get().mastery[topicId] ?? freshMastery()
        const next = observe(prev, correct)
        set((s) => ({ mastery: { ...s.mastery, [topicId]: next } }))
        get().awardXp(correct ? XP_AWARD.correctAnswer : XP_AWARD.wrongAnswer)
        bumpQuest(set, get, 'correctAnswer')
        checkBadges(set, get)
      },

      startLesson: (topicId) => {
        const state = get()
        const existing = state.lessons[topicId]
        const firstTime = !existing
        set((s) => ({
          lessons: {
            ...s.lessons,
            [topicId]: existing ?? { startedAt: Date.now(), pre: 0, post: 0, gain: 0, attempts: 0 },
          },
        }))
        if (firstTime) {
          get().awardXp(XP_AWARD.newTopic)
          bumpQuest(set, get, 'newTopic')
        }
        get().visitTopic(topicId)
      },

      completeLesson: (topicId, pre, post, xp) => {
        const state = get()
        const existing = state.lessons[topicId]
        const gain = learningGain(pre, post)
        set((s) => ({
          lessons: {
            ...s.lessons,
            [topicId]: {
              startedAt: existing?.startedAt ?? Date.now(),
              completedAt: Date.now(),
              pre,
              post,
              gain,
              attempts: (existing?.attempts ?? 0) + 1,
            },
          },
        }))
        // The lesson card advertises an exact completion reward. Default to the
        // base award for older callers that do not pass one.
        const completionXp = xp ?? XP_AWARD.lessonComplete
        get().awardXp(completionXp + (post === 1 ? XP_AWARD.perfectQuiz : 0))
        if (post === 1) set((s) => ({ counters: { ...s.counters, perfectQuizzes: s.counters.perfectQuizzes + 1 } }))
        bumpQuest(set, get, 'lessonComplete')
        checkBadges(set, get)
      },

      recordChallenge: (challengeId, xp, result, attempt) => {
        const existing = get().challenges[challengeId]
        const firstTry = result.passed && !existing?.solved && attempt === 1
        set((s) => ({
          challenges: {
            ...s.challenges,
            [challengeId]: {
              attempts: (existing?.attempts ?? 0) + 1,
              solved: existing?.solved || result.passed,
              firstTry: existing?.firstTry || firstTry,
              bestScore: Math.max(existing?.bestScore ?? 0, result.score),
            },
          },
        }))
        if (result.passed && !existing?.solved) {
          get().awardXp(xp + (firstTry ? XP_AWARD.challengeFirstTry : 0))
          bumpQuest(set, get, 'challengeSolved')
          checkBadges(set, get)
        }
      },

      recordTutorQuestion: () => {
        set((s) => ({ counters: { ...s.counters, tutorQuestions: s.counters.tutorQuestions + 1 } }))
        bumpQuest(set, get, 'tutorQuestion')
        checkBadges(set, get)
      },

      recordNoiseRun: () => {
        set((s) => ({ counters: { ...s.counters, noiseRuns: s.counters.noiseRuns + 1 } }))
        bumpQuest(set, get, 'noiseRun')
        checkBadges(set, get)
      },

      inspectCircuitResult: (sim, templateId) => {
        if (sim.numQubits === 2 && concurrence(sim.state) > 0.9) {
          const already = get().counters.entanglingCircuits
          const algorithms = templateId === 'grover' || templateId === 'qft' || templateId === 'deutsch-jozsa'
          set((s) => ({
            counters: {
              ...s.counters,
              entanglingCircuits: Math.min(already + 1, 50),
              algorithmsRun: algorithms ? Math.min(s.counters.algorithmsRun + 1, 50) : s.counters.algorithmsRun,
            },
          }))
        } else if (templateId === 'grover' || templateId === 'qft' || templateId === 'deutsch-jozsa') {
          set((s) => ({ counters: { ...s.counters, algorithmsRun: Math.min(s.counters.algorithmsRun + 1, 50) } }))
        }
        checkBadges(set, get)
      },

      visitTopic: (topicId) => {
        const hour = new Date().getHours()
        set((s) => ({
          recent: [topicId, ...s.recent.filter((id) => id !== topicId)].slice(0, 24),
          counters: { ...s.counters, nightOwl: s.counters.nightOwl || hour < 5 },
        }))
        checkBadges(set, get)
      },

      pushChat: (message) =>
        set((s) => ({ chat: [...s.chat, { ...message, id: uid(), at: Date.now() }].slice(-60) })),
      clearChat: () => set({ chat: [] }),

      claimQuest: (questId) => {
        const quest = QUESTS.find((q) => q.id === questId)
        if (!quest) return
        const ledger = quest.cadence === 'daily' ? get().daily : get().weekly
        if (ledger.claimed.includes(questId)) return
        if ((ledger.progress[questId] ?? 0) < quest.target) return
        const next = { ...ledger, claimed: [...ledger.claimed, questId] }
        set(quest.cadence === 'daily' ? { daily: next } : { weekly: next })
        get().awardXp(quest.xp, quest.label)
      },

      toast: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: uid() }].slice(-4) })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      resetProgress: () => set({ ...initialState(), circuit: get().circuit, settings: get().settings }),
    }),
    {
      name: 'quantumspace-v1',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 had no hardware profile; keep every other saved field and fill the default.
      migrate: (persisted) => {
        const state = persisted as Partial<AppState>
        const old = state.settings
        // v1 learners who had already enabled noise keep the manual controls.
        const device: DeviceId = old && !old.device && old.noisy ? 'custom' : (old?.device ?? 'ideal')
        return { ...state, settings: { ...defaultSettings, ...(old ?? {}), device } } as AppState
      },
      partialize: (state) => {
        const { toasts, chat, ...rest } = state
        void toasts
        void chat
        return rest
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Roll the quest ledgers forward if the day/week changed while away.
        state.daily = ensureLedger(state.daily, dayKey())
        state.weekly = ensureLedger(state.weekly, weekKey())
      },
    },
  ),
)

// ---------------------------------------------------------------------------
// Internal helpers (kept out of the public store shape)
// ---------------------------------------------------------------------------

type SetFn = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void
type GetFn = () => AppState

function bumpQuest(set: SetFn, get: GetFn, metric: QuestMetric) {
  const state = get()
  const today = dayKey()
  const week = weekKey()
  const daily = ensureLedger(state.daily, today)
  const weekly = ensureLedger(state.weekly, week)
  const dq = QUESTS.filter((q) => q.cadence === 'daily' && q.metric === metric)
  const wq = QUESTS.filter((q) => q.cadence === 'weekly' && q.metric === metric)
  if (!dq.length && !wq.length) return
  const progress = { ...daily.progress }
  for (const q of dq) progress[q.id] = Math.min(q.target * 2, (progress[q.id] ?? 0) + 1)
  const wprogress = { ...weekly.progress }
  for (const q of wq) wprogress[q.id] = Math.min(q.target * 2, (wprogress[q.id] ?? 0) + 1)
  set({
    daily: ensureLedger({ ...daily, progress }, today),
    weekly: ensureLedger({ ...weekly, progress: wprogress }, week),
  })
}

function checkBadges(set: SetFn, get: GetFn) {
  const state = get()
  const stats = deriveStats(state)
  const earned = newlyEarned(state.badges, stats)
  if (!earned.length) return
  set({
    badges: [...state.badges, ...earned.map((b) => b.id)],
    toasts: [
      ...state.toasts,
      ...earned.map((b) => ({ id: uid(), title: `Badge: ${b.name}`, detail: b.description, tone: 'badge' as const })),
    ].slice(-4),
  })
}

/** Live streak for display (0 when a day was missed). */
export const useLiveStreak = () => useAppStore((s) => liveStreak(s.streak))

/** Extend the streak for today's activity; call once per session. */
export function touchTodayStreak() {
  const state = useAppStore.getState()
  const { state: next, extended } = touchStreak(state.streak)
  if (!extended) return
  useAppStore.setState({ streak: next })
  if (next.count > 1) useAppStore.getState().awardXp(XP_AWARD.dailyStreak, 'Daily streak')
}

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]))
