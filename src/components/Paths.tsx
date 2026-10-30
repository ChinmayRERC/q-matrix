/**
 * Curated learning paths. Progress here is deliberately *mastery* based, not
 * click based: a topic only counts once the BKT posterior crosses the threshold.
 */
import { useMemo, useState } from 'react'
import { ArrowRight, Check, Lock, Route, Search } from 'lucide-react'
import { LEVEL_NAMES, LEARNING_PATHS, TOPICS, TOPIC_BY_ID, type Level } from '../content/topics.generated'
import { MASTERED_THRESHOLD, decayedMastery } from '../lib/mastery'
import { START_HERE } from '../lib/lessons'
import { useAppStore } from '../store/useAppStore'
import { useLocale, t } from '../lib/i18n'
import { Btn, Meter, Panel, Pill } from './ui'

const LEVEL_TONE: Record<Level, 'green' | 'cyan' | 'amber' | 'pink'> = {
  B: 'green',
  I: 'cyan',
  A: 'amber',
  F: 'pink',
}

export function Paths({ onOpenTopic }: { onOpenTopic: (id: string) => void }) {
  const mastery = useAppStore((s) => s.mastery)
  const lessons = useAppStore((s) => s.lessons)
  const [selected, setSelected] = useState(LEARNING_PATHS[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const locale = useLocale()

  const mOf = (id: string) => decayedMastery(mastery[id], Date.now())

  const paths = useMemo(
    () =>
      LEARNING_PATHS.map((path) => {
        const total = path.topics.length
        const mastered = path.topics.filter((id) => mOf(id) >= MASTERED_THRESHOLD).length
        const started = path.topics.filter((id) => mastery[id]?.attempts).length
        return { ...path, total, mastered, started, progress: total ? mastered / total : 0 }
      }),
    [mastery],
  )

  const active = paths.find((p) => p.id === selected) ?? paths[0]
  const startTopic = TOPIC_BY_ID[START_HERE]

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return TOPICS.filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)).slice(0, 12)
  }, [query])

  return (
    <div className="stack gap-16 fade-in">
      <div className="row gap-16 wrap">
        <div className="grow">
          <div className="eyebrow">Curriculum</div>
          <h2 className="display" style={{ fontSize: 34, marginTop: 4 }}>Learning paths</h2>
          <p className="lead" style={{ marginTop: 6, maxWidth: 620 }}>
            Eight routes through 176 topics — from complex numbers to error-corrected algorithms. Progress counts mastery,
            not clicks.
          </p>
        </div>
        <div className="row gap-6" style={{ minWidth: 260 }}>
          <Search size={14} color="var(--dim)" />
          <input
            className="chat-input"
            style={{ minHeight: 34, padding: '6px 10px' }}
            placeholder="Find any topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {startTopic && (
        <Panel tight>
          <div className="row gap-12 wrap" style={{ padding: 4 }}>
            <Pill tone="green">START HERE</Pill>
            <span className="small grow" style={{ lineHeight: 1.5 }}>
              New to quantum computing? Begin with <strong>{startTopic.title}</strong> ({startTopic.id}) — one H gate, a
              50/50 histogram, and the measurement rule that explains it.
            </span>
            <Btn variant="primary" onClick={() => onOpenTopic(START_HERE)}>
              Open the first lab <ArrowRight size={13} />
            </Btn>
          </div>
        </Panel>
      )}

      {query.trim() && (
        <Panel title={`Search results for "${query.trim()}"`} tight>
          <div className="stack gap-6">
            {searchResults.map((t) => (
              <button
                key={t.id}
                className="row gap-8"
                style={{ background: 'none', border: 0, textAlign: 'left', padding: '6px 0', color: 'inherit' }}
                onClick={() => onOpenTopic(t.id)}
              >
                <Pill tone={LEVEL_TONE[t.level]}>{t.level}</Pill>
                <span className="small grow">{t.title}</span>
                <span className="tiny dim">{t.domainName}</span>
                <ArrowRight size={13} color="var(--dim)" />
              </button>
            ))}
            {searchResults.length === 0 && <div className="tiny dim">No topic matched. Try an id like A-04.</div>}
          </div>
        </Panel>
      )}

      <div className="paths-layout">
        <div className="stack gap-8">
          {paths.map((path) => {
            const on = path.id === active?.id
            return (
              <div
                key={path.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                className={`topic-card ${on ? 'complete' : ''}`}
                style={{
                  padding: 13,
                  borderColor: on ? 'rgba(155,124,255,.45)' : undefined,
                  background: on ? 'linear-gradient(160deg, rgba(155,124,255,.14), rgba(255,255,255,.02))' : undefined,
                }}
                onClick={() => setSelected(path.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(path.id)
                  }
                }}
              >
                <span className="row gap-8" style={{ display: 'flex' }}>
                  <Route size={14} color={on ? 'var(--violet)' : 'var(--dim)'} />
                  <span style={{ fontWeight: 700, fontSize: 13 }} className="grow">{t(`path.${path.id}`, locale, path.name)}</span>
                  <span className="tiny mono dim">{Math.round(path.progress * 100)}%</span>
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
                  {path.mastered}/{path.total} mastered · {path.started} started
                </span>
                <span style={{ display: 'block' }}>
                  <Meter value={path.progress} tone={path.progress >= 1 ? 'green' : undefined} className="thin" />
                </span>
              </div>
            )
          })}
        </div>

        {active && (
          <Panel
            title={t(`path.${active.id}`, locale, active.name)}
            sub={`${active.total} topics · ${active.mastered} mastered · ${Math.round(active.progress * 100)}% complete`}
            actions={<Pill tone="violet">{active.started} in progress</Pill>}
          >
            <div className="stack gap-10">
              {(['B', 'I', 'A', 'F'] as Level[]).map((level) => {
                const ids = active.topics.filter((id) => TOPIC_BY_ID[id]?.level === level)
                if (!ids.length) return null
                return (
                  <div key={level} className="stack gap-6">
                    <div className="row gap-8">
                      <Pill tone={LEVEL_TONE[level]}>{LEVEL_NAMES[level]}</Pill>
                      <span className="tiny dim">{ids.length} topics</span>
                      <div className="grow" />
                      <span className="tiny dim mono">
                        {ids.filter((id) => mOf(id) >= MASTERED_THRESHOLD).length}/{ids.length}
                      </span>
                    </div>
                    <div className="stack gap-4">
                      {ids.map((id) => {
                        const topic = TOPIC_BY_ID[id]
                        if (!topic) return null
                        const m = mOf(id)
                        const done = m >= MASTERED_THRESHOLD
                        const lesson = lessons[id]
                        const locked = topic.prerequisites.some((p) => {
                          const pm = mastery[p]
                          return pm ? decayedMastery(pm, Date.now()) < 0.55 : false
                        })
                        return (
                          <button
                            key={id}
                            className="row gap-10"
                            style={{
                              background: 'rgba(255,255,255,.02)',
                              border: '1px solid var(--line)',
                              borderRadius: 11,
                              padding: '9px 11px',
                              textAlign: 'left',
                              color: 'inherit',
                              opacity: m === 0 && locked ? 0.62 : 1,
                            }}
                            onClick={() => onOpenTopic(id)}
                          >
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                display: 'grid',
                                placeItems: 'center',
                                flex: 'none',
                                background: done ? 'rgba(94,226,168,.16)' : 'rgba(255,255,255,.05)',
                                color: done ? 'var(--green)' : 'var(--dim)',
                              }}
                            >
                              {done ? <Check size={11} /> : locked ? <Lock size={10} /> : <span style={{ width: 4, height: 4, borderRadius: 99, background: 'currentColor', display: 'block' }} />}
                            </span>
                            <span className="grow" style={{ minWidth: 0 }}>
                              <span className="small" style={{ display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {topic.title}
                              </span>
                              <span className="tiny dim">{topic.domainName} · {topic.estimatedMinutes} min</span>
                            </span>
                            {lesson?.completedAt && <Pill tone="green">{gainLabelSafe(lesson.gain)}</Pill>}
                            <span className="tiny mono dim" style={{ width: 34, textAlign: 'right' }}>{(m * 100).toFixed(0)}%</span>
                            <Meter value={m} className="thin" tone={done ? 'green' : undefined} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

function gainLabelSafe(gain: number): string {
  if (gain >= 0.7) return 'high gain'
  if (gain >= 0.3) return 'medium gain'
  if (gain > 0) return 'low gain'
  return 'no gain'
}
