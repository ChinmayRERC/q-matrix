/**
 * Optional classroom sync.
 *
 * Local-first: the app keeps teaching with no network. Joining a class uploads a
 * compact snapshot (mastery, lessons, challenges, XP, badges) so a teacher can
 * see the roster, and lets a learner pull their own progress onto another device.
 */
import { API_BASE } from './api'
import { useAppStore } from '../store/useAppStore'

const KEY = 'qmatrix-class-v1'

export interface Membership {
  classCode: string
  learnerId: string
  token: string
  name: string
}

export interface Snapshot {
  name: string
  xp: number
  badges: string[]
  mastery: Record<string, unknown>
  lessons: Record<string, unknown>
  challenges: Record<string, unknown>
  counters: Record<string, unknown>
}

export interface RosterRow {
  id: string
  name: string
  xp: number
  topicsTouched: number
  mastered: number
  meanMastery: number
  lessonsCompleted: number
  meanGain: number
  challengesSolved: number
  badges: number
  syncedAt: number | null
}

export interface Roster {
  classCode: string
  className: string
  learners: RosterRow[]
  topics: Array<{ id: string; meanMastery: number; learners: number }>
  masteredThreshold: number
}

export const membership = (): Membership | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') as Membership | null
  } catch {
    return null
  }
}

export const setMembership = (value: Membership | null): void => {
  if (value) localStorage.setItem(KEY, JSON.stringify(value))
  else localStorage.removeItem(KEY)
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = (await response.json().catch(() => ({}))) as { detail?: string }
  if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`)
  return body as T
}

export function localSnapshot(): Snapshot {
  const s = useAppStore.getState()
  return {
    name: s.name,
    xp: s.xp,
    badges: s.badges,
    mastery: s.mastery,
    lessons: s.lessons,
    challenges: s.challenges,
    counters: s.counters,
  }
}

export function applySnapshot(payload: Snapshot): void {
  useAppStore.setState({
    name: payload.name,
    xp: payload.xp,
    badges: payload.badges,
    mastery: payload.mastery as never,
    lessons: payload.lessons as never,
    challenges: payload.challenges as never,
    counters: payload.counters as never,
  })
}

export const createClass = (name: string, pin: string) =>
  call<{ code: string; name: string }>('/class', { method: 'POST', body: JSON.stringify({ name, pin }) })

export const joinClass = (code: string, name: string) =>
  call<{ learnerId: string; token: string; classCode: string; name: string }>('/class/join', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  })

export const pushState = (m: Membership) =>
  call<{ ok: boolean; savedAt: number }>('/learner/state', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${m.token}` },
    body: JSON.stringify({ payload: localSnapshot() }),
  })

export const pullState = (m: Membership) =>
  call<{ payload: Snapshot | null; updatedAt?: number }>('/learner/state', {
    headers: { Authorization: `Bearer ${m.token}` },
  })

export const educatorLogin = (code: string, pin: string) =>
  call<{ token: string; classCode: string; className: string }>('/educator/login', {
    method: 'POST',
    body: JSON.stringify({ code, pin }),
  })

export const fetchClass = (token: string) =>
  call<Roster>('/educator/class', { headers: { Authorization: `Bearer ${token}` } })
