/**
 * Auto-graded circuit challenges. Graders inspect the simulated state, not the
 * gate list, so any correct construction passes. Failure shows per-check detail
 * that becomes the tutor's next hint.
 */
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Gamepad2,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { CHALLENGES, hintFor, type Challenge, type GradeResult } from '../lib/challenges'
import { useAppStore } from '../store/useAppStore'
import { Btn, Meter, Panel, Pill, Tabs } from './ui'
import { Composer } from './Composer'
import { TOPIC_BY_ID } from '../content/topics.generated'

const DIFF_TONE = { starter: 'green', intermediate: 'amber', advanced: 'pink' } as const

export function Challenges({ onOpenTopic }: { onOpenTopic: (id: string) => void }) {
  const circuit = useAppStore((s) => s.circuit)
  const loadTemplate = useAppStore((s) => s.loadTemplate)
  const recordChallenge = useAppStore((s) => s.recordChallenge)
  const progress = useAppStore((s) => s.challenges)
  const toast = useAppStore((s) => s.toast)

  const [activeId, setActiveId] = useState(CHALLENGES[0].id)
  const [filter, setFilter] = useState<'all' | 'starter' | 'intermediate' | 'advanced'>('all')
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [result, setResult] = useState<GradeResult | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [showLab, setShowLab] = useState(false)

  const active = CHALLENGES.find((c) => c.id === activeId) ?? CHALLENGES[0]
  const filtered = CHALLENGES.filter((c) => filter === 'all' || c.difficulty === filter)
  const solved = Object.values(progress).filter((p) => p.solved).length
  const earned = Object.values(progress).reduce((s, p) => s + (p.solved ? 1 : 0), 0)

  const stats = useMemo(
    () => ({
      solved,
      total: CHALLENGES.length,
      xp: CHALLENGES.filter((c) => progress[c.id]?.solved).reduce((s, c) => s + c.xp, 0),
      attempts,
    }),
    [solved, progress, attempts],
  )

  const check = () => {
    const attempt = (attempts[active.id] ?? 0) + 1
    setAttempts((a) => ({ ...a, [active.id]: attempt }))
    let grade: GradeResult
    try {
      grade = active.grade(circuit)
    } catch (err) {
      grade = {
        passed: false,
        score: 0,
        checks: [{ label: 'Simulation', ok: false, detail: err instanceof Error ? err.message : 'Circuit failed to simulate' }],
        hint: 'Fix the structural problem before grading.',
      }
    }
    setResult(grade)
    recordChallenge(active.id, active.xp, grade, attempt)
    if (grade.passed) {
      toast({ title: `Challenge solved: ${active.title}`, detail: `+${active.xp} XP`, tone: 'xp' })
    } else {
      setHintLevel((h) => Math.min(active.hints.length - 1, h + 1))
    }
  }

  const reset = () => {
    setResult(null)
    setHintLevel(0)
    if (active.start) loadTemplate(active.start)
  }

  return (
    <div className="stack gap-16 fade-in">
      <div className="row gap-16 wrap">
        <div className="grow">
          <div className="eyebrow">Practice</div>
          <h1 className="display" style={{ fontSize: 34, marginTop: 4 }}>Circuit challenges</h1>
          <p className="lead" style={{ marginTop: 6, maxWidth: 620 }}>
            Eleven build-it-yourself problems, graded by running your circuit — not by matching a stored answer. Any correct
            construction wins.
          </p>
        </div>
        <div className="row gap-10">
          <div className="stat" style={{ minWidth: 110 }}>
            <div className="k">Solved</div>
            <div className="v">{stats.solved}<span className="dim" style={{ fontSize: 13 }}>/{stats.total}</span></div>
          </div>
          <div className="stat accent" style={{ minWidth: 110 }}>
            <div className="k">Challenge XP</div>
            <div className="v">{stats.xp}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,300px) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="stack gap-10">
          <Tabs
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'starter', label: 'Starter' },
              { id: 'intermediate', label: 'Mid' },
              { id: 'advanced', label: 'Hard' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <div className="stack gap-8">
            {filtered.map((c) => {
              const p = progress[c.id]
              const on = c.id === active.id
              return (
                <button
                  key={c.id}
                  className={`topic-card ${p?.solved ? 'complete' : ''}`}
                  style={{
                    padding: 12,
                    borderColor: on ? 'rgba(155,124,255,.45)' : undefined,
                    background: on ? 'linear-gradient(160deg, rgba(155,124,255,.13), rgba(255,255,255,.02))' : undefined,
                  }}
                  onClick={() => {
                    setActiveId(c.id)
                    setResult(null)
                    setHintLevel(0)
                    setShowLab(false)
                  }}
                >
                  <div className="row gap-6">
                    <Pill tone={DIFF_TONE[c.difficulty]}>{c.difficulty}</Pill>
                    <span className="grow" />
                    {p?.solved ? <CheckCircle2 size={13} color="var(--green)" /> : <span className="tiny mono dim">{c.xp} XP</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>{c.title}</div>
                  <div className="tiny dim">{c.qubits} qubit{c.qubits > 1 ? 's' : ''} · {c.hints.length} hints</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="stack gap-14" style={{ minWidth: 0 }}>
          <Panel
            title={active.title}
            sub={`${active.qubits} qubits · auto-graded · +${active.xp} XP`}
            actions={<Pill tone={DIFF_TONE[active.difficulty]}>{active.difficulty}</Pill>}
          >
            <div className="stack gap-14">
              <p className="lead" style={{ fontSize: 13.5 }}>{active.brief}</p>

              <div className="row gap-8 wrap">
                {active.topicIds.map((id) => {
                  const t = TOPIC_BY_ID[id]
                  return t ? (
                    <button className="chip" key={id} onClick={() => onOpenTopic(id)}>
                      <span className="mono" style={{ fontSize: 10 }}>{id}</span> {t.title}
                    </button>
                  ) : null
                })}
              </div>

              {result && (
                <div className="stack gap-6">
                  <div className={`insight ${result.passed ? 'win' : 'error'}`}>
                    <span className="dot" />
                    <div className="grow">
                      <div className="t">{result.passed ? 'Solved' : `Not yet — ${Math.round(result.score * 100)}% of checks passed`}</div>
                      <div className="d">{result.passed ? 'Every check passed against the live statevector.' : result.hint}</div>
                    </div>
                    <span className="pill" style={{ alignSelf: 'flex-start' }}>{result.checks.filter((c) => c.ok).length}/{result.checks.length}</span>
                  </div>
                  {result.checks.map((c, i) => (
                    <div className="row gap-8" key={i} style={{ paddingLeft: 4 }}>
                      <span style={{ color: c.ok ? 'var(--green)' : 'var(--pink)', display: 'grid', placeItems: 'center', marginTop: 1 }}>
                        {c.ok ? <Check size={13} /> : <X size={13} />}
                      </span>
                      <span className="small" style={{ color: c.ok ? 'var(--muted)' : '#e7c8d2' }}>
                        <strong style={{ fontWeight: 600 }}>{c.label}:</strong> {c.detail}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="panel sunken" style={{ padding: 13 }}>
                <div className="row gap-8" style={{ marginBottom: 6 }}>
                  <Lightbulb size={13} color="var(--amber)" />
                  <span className="eyebrow" style={{ color: 'var(--amber)' }}>Socratic ladder</span>
                  <span className="grow" />
                  <span className="tiny dim mono">hint {Math.min(hintLevel + 1, active.hints.length)}/{active.hints.length}</span>
                </div>
                <p className="small" style={{ lineHeight: 1.6 }}>{hintFor(active, hintLevel)}</p>
                {hintLevel < active.hints.length - 1 && (
                  <button className="chip" style={{ marginTop: 8, fontSize: 11 }} onClick={() => setHintLevel((h) => h + 1)}>
                    <Sparkles size={10} /> Give me another nudge
                  </button>
                )}
              </div>

              <div className="row gap-8 wrap">
                <Btn variant="primary" icon={<Play size={13} />} onClick={() => setShowLab(true)}>
                  Open workbench
                </Btn>
                <Btn icon={<CheckCircle2 size={13} />} onClick={check}>
                  Check my circuit
                </Btn>
                <Btn variant="ghost" icon={<RotateCcw size={13} />} onClick={reset}>
                  Reset
                </Btn>
                <span className="grow" />
                {(attempts[active.id] ?? 0) > 0 && <span className="tiny dim">{attempts[active.id]} attempt(s) this session</span>}
              </div>
            </div>
          </Panel>

          {showLab ? (
            <div className="stack gap-10">
              <div className="row gap-8">
                <Pill tone="cyan">live workbench</Pill>
                <span className="tiny dim">Your circuit is shared with the lab and the tutor.</span>
                <span className="grow" />
                <Btn size="sm" variant="ghost" onClick={() => setShowLab(false)}>Hide</Btn>
              </div>
              <Composer embedded key={active.id} initialTemplate={active.start} />
            </div>
          ) : (
            <Panel tight sunken>
              <div className="row gap-10 wrap" style={{ padding: 4 }}>
                <Gamepad2 size={16} color="var(--violet)" />
                <span className="small muted grow">
                  The workbench is where you build. This summary stays visible while you work.
                </span>
                <Btn size="sm" variant="primary" onClick={() => setShowLab(true)}>Open workbench</Btn>
              </div>
            </Panel>
          )}

          <Panel title="All challenges" sub={`${earned} solved`} tight>
            <div className="row gap-6 wrap">
              {CHALLENGES.map((c) => {
                const p = progress[c.id]
                return (
                  <button
                    key={c.id}
                    className={`chip ${p?.solved ? 'on' : ''}`}
                    onClick={() => {
                      setActiveId(c.id)
                      setResult(null)
                      setHintLevel(0)
                      setShowLab(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    style={{ fontSize: 11 }}
                  >
                    {p?.solved ? <Trophy size={10} color="var(--amber)" /> : <Circle size={9} />}
                    {c.title}
                  </button>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
