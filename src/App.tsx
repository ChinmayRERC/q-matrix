/**
 * Application shell: hash routing, persistent sidebar, HUD and toasts.
 *
 * Hash routing (rather than a router dependency) keeps the build small and makes
 * deep links work on a static host without server rewrites.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Atom,
  Award,
  BookOpen,
  Cpu,
  Flame,
  Gamepad2,
  Info,
  LayoutDashboard,
  Orbit,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react'
import { levelInfo, liveStreak } from './lib/gamification'
import { touchTodayStreak, useAppStore, type Toast } from './store/useAppStore'
import { Dashboard } from './components/Dashboard'
import { Ring } from './components/ui'
import { QuantumGame } from './components/QuantumGame'

// Route-level code splitting: the dashboard ships immediately, while the
// three.js-heavy Galaxy/Workbench and the long lesson flows load on demand.
const Composer = lazy(() => import('./components/Composer').then((m) => ({ default: m.Composer })))
const Galaxy = lazy(() => import('./components/Galaxy').then((m) => ({ default: m.Galaxy })))
const Paths = lazy(() => import('./components/Paths').then((m) => ({ default: m.Paths })))
const LessonView = lazy(() => import('./components/LessonView').then((m) => ({ default: m.LessonView })))
const Challenges = lazy(() => import('./components/Challenges').then((m) => ({ default: m.Challenges })))
const Progress = lazy(() => import('./components/Progress').then((m) => ({ default: m.Progress })))
const Hardware = lazy(() => import('./components/Hardware').then((m) => ({ default: m.Hardware })))
const India = lazy(() => import('./components/India').then((m) => ({ default: m.India })))

interface Route {
  page: string
  param?: string
}

const parseHash = (): Route => {
  const raw = window.location.hash.replace(/^#/, '')
  const segments = raw.split('/').filter(Boolean)
  return { page: segments[0] ?? 'dashboard', param: segments[1] }
}

const TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Your next best move' },
  galaxy: { title: 'Quantum Galaxy', sub: 'Spatial knowledge map' },
  paths: { title: 'Learning paths', sub: 'Eight routes to quantum fluency' },
  game: { title: 'Qubit Lab', sub: 'Learn the first ideas by playing' },
  india: { title: "India's Quantum Future", sub: 'NQM, RRI and the machines being built' },
  hardware: { title: 'Hardware', sub: 'The physical stack behind the circuit' },
  lab: { title: 'Workbench', sub: 'Design, simulate, export' },
  lesson: { title: 'Virtual Lab', sub: 'Seven-stage guided lesson' },
  challenges: { title: 'Challenges', sub: 'Auto-graded circuit problems' },
  progress: { title: 'Progress & data', sub: 'Mastery, badges, educator export and settings' },
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const xp = useAppStore((s) => s.xp)
  const level = levelInfo(xp)
  const streak = useAppStore((s) => liveStreak(s.streak))
  const name = useAppStore((s) => s.name)

  useEffect(() => {
    touchTodayStreak()
    const onHash = () => {
      setRoute(parseHash())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (hash: string) => {
    const clean = hash.startsWith('#') ? hash.slice(1) : hash
    if (window.location.hash.replace(/^#/, '') === clean) return
    window.location.hash = clean
  }

  const openTopic = (id: string) => go(`/lesson/${id}`)

  const meta = useMemo(() => {
    if (route.page === 'lesson' && route.param) {
      return { title: 'Virtual Lab', sub: route.param }
    }
    return TITLES[route.page] ?? TITLES.dashboard
  }, [route])

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'galaxy', label: 'Galaxy', icon: <Orbit size={16} /> },
    { id: 'paths', label: 'Paths', icon: <BookOpen size={16} /> },
    { id: 'india', label: 'India', icon: <Sparkles size={16} /> },
    { id: 'hardware', label: 'Hardware', icon: <Cpu size={16} /> },
    { id: 'lab', label: 'Workbench', icon: <Atom size={16} /> },
    { id: 'challenges', label: 'Challenges', icon: <Gamepad2 size={16} /> },
    { id: 'game', label: 'Qubit Lab', icon: <Zap size={16} /> },
    { id: 'progress', label: 'Progress & data', icon: <Trophy size={16} /> },
  ]

  return (
    <>
      <div className="backdrop" aria-hidden />
      <div className="shell">
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => go('/dashboard')}
            style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
          >
            <span className="brand-mark">
              <Atom size={19} />
            </span>
            <span>
              <span className="brand-name">Q-matrix</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Quantum Space · Learn · Build · Collapse
              </span>
            </span>
          </button>

          <nav className="nav">
            <div className="nav-label">Explore</div>
            {nav.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${route.page === item.id || (route.page === 'lesson' && item.id === 'paths') ? 'active' : ''}`}
                onClick={() => go(`/${item.id}`)}
                title={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === 'challenges' && <span className="badge-dot">XP</span>}
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="level-card">
              <div className="level-top">
                <span className="level-title">{level.title}</span>
                <span className="level-num">Lv {level.level}</span>
              </div>
              <div className="meter thin">
                <i style={{ width: `${level.progress * 100}%` }} />
              </div>
              <div className="row gap-6" style={{ marginTop: 8 }}>
                <Zap size={11} color="var(--violet)" />
                <span className="tiny dim mono">
                  {xp.toLocaleString()} / {level.nextLevelXp.toLocaleString()}
                </span>
                <span className="grow" />
                <span className="tiny dim">{Math.round(level.progress * 100)}%</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="topbar-title">
              <h1>{meta.title}</h1>
              <span>{meta.sub}</span>
            </div>
            <div className="topbar-spacer" />
            <div className="hud">
              <span className="hud-chip xp hide-sm" title="Experience points">
                <Zap size={12} />
                <strong>{xp.toLocaleString()}</strong> XP
              </span>
              <span className="hud-chip flame" title="Current daily streak">
                <Flame size={12} />
                <strong>{streak}</strong>
              </span>
              <span className="hud-chip hide-sm" title="Level">
                <Award size={12} />
                <strong>Lv {level.level}</strong>
              </span>
              <button
                className="hud-chip"
                onClick={() => go('/progress')}
                title={`${name} — open profile`}
                style={{ paddingRight: 6 }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(140deg,#9b7cff,#6b47ff)',
                    color: '#fff',
                    fontSize: 9.5,
                    fontWeight: 700,
                  }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="tiny" style={{ color: 'var(--muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </span>
              </button>
            </div>
          </header>

          <div className="page">
            <Suspense fallback={<RouteFallback />}>
              {route.page === 'dashboard' && <Dashboard onOpenTopic={openTopic} onNavigate={go} />}
              {route.page === 'galaxy' && <Galaxy onOpen={openTopic} />}
              {route.page === 'paths' && <Paths onOpenTopic={openTopic} />}
              {route.page === 'india' && <India onNavigate={go} />}
              {route.page === 'hardware' && <Hardware />}
              {route.page === 'lesson' && route.param && (
                <LessonView key={route.param} topicId={route.param} onOpenTopic={openTopic} onBack={() => go('/paths')} />
              )}
              {route.page === 'lab' && <Composer />}
              {route.page === 'challenges' && <Challenges onOpenTopic={openTopic} />}
              {route.page === 'game' && <QuantumGame />}
              {route.page === 'progress' && <Progress />}
              {!TITLES[route.page] && route.page !== 'lesson' && (
                <div className="empty">
                  <div className="glyph">
                    <Sparkles size={18} />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--muted)' }}>Page not found</div>
                  <button className="btn primary" onClick={() => go('/dashboard')}>
                    Back to dashboard
                  </button>
                </div>
              )}
            </Suspense>
          </div>
        </main>
      </div>
      <Toasts />
    </>
  )
}

// ---------------------------------------------------------------------------
// Route loading state
// ---------------------------------------------------------------------------

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-spinner" aria-hidden />
      <span className="tiny dim">Loading workspace…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

const TOAST_ICON = {
  xp: <Zap size={13} />,
  badge: <Award size={13} />,
  quest: <Trophy size={13} />,
  error: <AlertTriangle size={13} />,
  info: <Info size={13} />,
} as const

function Toasts() {
  const toasts = useAppStore((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((s) => s.dismissToast)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 4800)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div className={`toast ${toast.tone}`}>
      <span className="glyph">{TOAST_ICON[toast.tone]}</span>
      <div className="grow">
        <div className="t">{toast.title}</div>
        {toast.detail && <div className="d">{toast.detail}</div>}
      </div>
      <button className="icon-btn x" onClick={() => dismiss(toast.id)} aria-label="Dismiss" style={{ width: 22, height: 22 }}>
        ×
      </button>
    </div>
  )
}
