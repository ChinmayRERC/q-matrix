/**
 * Progress & educator view.
 *
 * The CSV export is deliberately plain: one row per topic the learner has
 * touched, with the BKT posterior, pretest/posttest, normalised gain and the
 * challenge record. That is enough for a teacher to see learning gain without
 * needing access to the app database.
 */
import { useMemo, useState } from 'react'
import {
  Award,
  Download,
  FileSpreadsheet,
  Flame,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react'
import { DOMAINS, TOPICS, TOPIC_BY_ID, type Level } from '../content/topics.generated'
import { BADGES, QUESTS, levelInfo, liveStreak } from '../lib/gamification'
import {
  MASTERED_THRESHOLD,
  STAGE_LABEL,
  decayedMastery,
  domainMastery,
  masteryStage,
} from '../lib/mastery'
import { gainLabel } from '../lib/lessons'
import { deriveStats, useAppStore } from '../store/useAppStore'
import { BadgeGlyph, Btn, Meter, Modal, Panel, Pill, Ring, Stat, Tabs } from './ui'

const LEVEL_TONE: Record<Level, 'green' | 'cyan' | 'amber' | 'pink'> = {
  B: 'green',
  I: 'cyan',
  A: 'amber',
  F: 'pink',
}

const TIER_TONE: Record<string, 'amber' | 'cyan' | 'violet' | 'pink'> = {
  bronze: 'amber',
  silver: 'cyan',
  gold: 'amber',
  legendary: 'pink',
}

const csvEscape = (value: string | number): string => {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Progress() {
  const state = useAppStore()
  const [tab, setTab] = useState<'mastery' | 'badges' | 'educator' | 'settings'>('mastery')
  const [query, setQuery] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const level = levelInfo(state.xp)
  const streak = liveStreak(state.streak)
  const stats = deriveStats(state)
  const now = Date.now()

  const started = useMemo(
    () =>
      Object.keys(state.mastery)
        .filter((id) => state.mastery[id]?.attempts > 0)
        .map((id) => {
          const topic = TOPIC_BY_ID[id]
          return {
            id,
            title: topic?.title ?? id,
            domain: topic?.domainName ?? '—',
            level: topic?.level ?? ('B' as Level),
            mastery: decayedMastery(state.mastery[id], now),
            stage: masteryStage(state.mastery[id]),
            attempts: state.mastery[id]?.attempts ?? 0,
            lesson: state.lessons[id],
          }
        })
        .sort((a, b) => b.mastery - a.mastery),
    [state.mastery, state.lessons, now],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return started
    return started.filter((row) => row.title.toLowerCase().includes(q) || row.id.toLowerCase().includes(q) || row.domain.toLowerCase().includes(q))
  }, [started, query])

  const mastered = started.filter((r) => r.mastery >= MASTERED_THRESHOLD)
  const averageMastery = started.length ? started.reduce((s, r) => s + r.mastery, 0) / started.length : 0
  const domains = useMemo(() => domainMastery(state.mastery, TOPICS), [state.mastery])

  const lessonRows = useMemo(
    () =>
      Object.entries(state.lessons)
        .filter(([, l]) => l.completedAt)
        .map(([id, l]) => ({
          id,
          title: TOPIC_BY_ID[id]?.title ?? id,
          domain: TOPIC_BY_ID[id]?.domainName ?? '—',
          pre: l.pre,
          post: l.post,
          gain: l.gain,
          attempts: l.attempts,
          completedAt: l.completedAt!,
        }))
        .sort((a, b) => b.completedAt - a.completedAt),
    [state.lessons],
  )

  const exportCsv = () => {
    const header = [
      'learner',
      'topic_id',
      'topic_title',
      'domain',
      'level',
      'mastery_pct',
      'stage',
      'answers',
      'pretest_pct',
      'posttest_pct',
      'normalised_gain',
      'lesson_completed',
      'completed_at',
    ]
    const rows = started.map((row) => [
      state.name,
      row.id,
      row.title,
      row.domain,
      row.level,
      Math.round(row.mastery * 100),
      STAGE_LABEL[row.stage],
      row.attempts,
      row.lesson ? Math.round(row.lesson.pre * 100) : '',
      row.lesson?.completedAt ? Math.round(row.lesson.post * 100) : '',
      row.lesson?.completedAt ? row.lesson.gain.toFixed(4) : '',
      row.lesson?.completedAt ? 'yes' : 'no',
      row.lesson?.completedAt ? new Date(row.lesson.completedAt).toISOString() : '',
    ])
    const body = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
    download(`q-matrix-${state.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, body, 'text/csv;charset=utf-8')
    state.toast({ title: 'CSV exported', detail: `${rows.length} topic rows written.`, tone: 'info' })
  }

  const exportJson = () => {
    const payload = {
      learner: state.name,
      exportedAt: new Date().toISOString(),
      xp: state.xp,
      level: level.level,
      streak: state.streak,
      mastery: state.mastery,
      lessons: state.lessons,
      challenges: state.challenges,
      badges: state.badges,
      counters: state.counters,
    }
    download(`q-matrix-${state.name.toLowerCase().replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json')
    state.toast({ title: 'JSON exported', detail: 'Full progress snapshot downloaded.', tone: 'info' })
  }

  return (
    <div className="stack gap-16 fade-in">
      <div className="row gap-16 wrap">
        <div className="grow">
          <div className="eyebrow">Learner record</div>
          <h1 className="display" style={{ fontSize: 34, marginTop: 4 }}>Progress</h1>
          <p className="lead" style={{ marginTop: 6, maxWidth: 620 }}>
            Mastery is a Bayesian Knowledge Tracing posterior, not a completion checkbox. It rises when you answer
            correctly and decays when you don't revisit a topic.
          </p>
        </div>
        <div className="row gap-8 wrap">
          <Btn icon={<FileSpreadsheet size={14} />} onClick={exportCsv} variant="primary">
            Export CSV
          </Btn>
          <Btn icon={<Download size={14} />} variant="ghost" onClick={exportJson}>
            JSON
          </Btn>
        </div>
      </div>

      <div className="cols-4">
        <Stat label="Level" value={`${level.level}`} hint={level.title} accent />
        <Stat label="XP" value={state.xp.toLocaleString()} hint={`${Math.round(level.progress * 100)}% to next level`} />
        <Stat label="Mastered" value={mastered.length} hint={`${started.length} topics touched · avg ${(averageMastery * 100).toFixed(0)}%`} tone="var(--green)" />
        <Stat label="Streak" value={`${streak}d`} hint={`best ${state.streak.best} · ${state.badges.length}/${BADGES.length} badges`} tone="var(--amber)" />
      </div>

      <div className="row gap-10 wrap">
        <Tabs
          tabs={[
            { id: 'mastery', label: 'Mastery' },
            { id: 'badges', label: `Badges (${state.badges.length}/${BADGES.length})` },
            { id: 'educator', label: 'Educator' },
            { id: 'settings', label: 'Settings' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="grow" />
        {tab === 'mastery' && (
          <div className="row gap-6" style={{ minWidth: 230 }}>
            <Search size={13} color="var(--dim)" />
            <input
              className="chat-input"
              style={{ minHeight: 32, padding: '5px 9px' }}
              placeholder="Filter topics…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {tab === 'mastery' && (
        <div className="split">
          <div className="stack gap-16">
            <Panel title="Topic mastery" sub={`${filtered.length} rows · threshold ${Math.round(MASTERED_THRESHOLD * 100)}%`} tight>
              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="glyph"><Target size={17} /></div>
                  <div style={{ color: 'var(--muted)', fontWeight: 600 }}>No mastery data yet</div>
                  <div>Answer a question in any Virtual Lab to begin the model.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Domain</th>
                        <th style={{ width: 100 }}>Stage</th>
                        <th style={{ width: 130 }}>Mastery</th>
                        <th style={{ width: 70 }}>Answers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="row gap-6">
                              <span className="tiny mono dim">{row.id}</span>
                              <span style={{ fontWeight: 500 }}>{row.title}</span>
                            </div>
                          </td>
                          <td className="tiny dim">{row.domain}</td>
                          <td>
                            <Pill tone={row.stage === 'mastered' ? 'green' : row.stage === 'proficient' ? 'cyan' : row.stage === 'developing' ? 'amber' : 'slate'}>
                              {STAGE_LABEL[row.stage]}
                            </Pill>
                          </td>
                          <td>
                            <div className="row gap-6">
                              <Meter value={row.mastery} tone={row.mastery >= MASTERED_THRESHOLD ? 'green' : undefined} className="thin" />
                              <span className="tiny mono dim" style={{ width: 30, textAlign: 'right' }}>{(row.mastery * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="tiny mono dim">{row.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Learning gain" sub="Normalised gain per completed Virtual Lab" tight>
              {lessonRows.length === 0 ? (
                <div className="empty">
                  <div className="glyph"><Sparkles size={17} /></div>
                  <div style={{ color: 'var(--muted)', fontWeight: 600 }}>No completed labs yet</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Pre</th>
                        <th>Post</th>
                        <th>Gain</th>
                        <th>Attempts</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessonRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="row gap-6">
                              <span className="tiny mono dim">{row.id}</span>
                              <span>{row.title}</span>
                            </div>
                          </td>
                          <td className="mono">{Math.round(row.pre * 100)}%</td>
                          <td className="mono">{Math.round(row.post * 100)}%</td>
                          <td>
                            <Pill tone={row.gain >= 0.7 ? 'green' : row.gain >= 0.3 ? 'amber' : 'cyan'}>
                              {gainLabel(row.gain)} {Math.round(row.gain * 100)}%
                            </Pill>
                          </td>
                          <td className="mono dim">{row.attempts}</td>
                          <td className="tiny dim">{new Date(row.completedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="stack gap-16">
            <Panel title="By domain" sub="Average mastery across all topics" tight>
              <div className="stack gap-10">
                {DOMAINS.map((d) => {
                  const bucket = domains[d.slug]
                  if (!bucket) return null
                  return (
                    <div key={d.slug} className="stack gap-4">
                      <div className="row gap-6">
                        <span className="tiny grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <span className="tiny mono dim">{bucket.started}/{bucket.total}</span>
                        <span className="tiny mono" style={{ width: 32, textAlign: 'right' }}>{(bucket.mastery * 100).toFixed(0)}%</span>
                      </div>
                      <Meter value={bucket.mastery} tone={bucket.mastery >= MASTERED_THRESHOLD ? 'green' : undefined} className="thin" />
                    </div>
                  )
                })}
              </div>
            </Panel>

            <Panel title="Quests" sub="Today and this week" tight>
              <div className="stack gap-8">
                {QUESTS.map((quest) => {
                  const ledger = quest.cadence === 'daily' ? state.daily : state.weekly
                  const count = ledger.progress[quest.id] ?? 0
                  const claimed = ledger.claimed.includes(quest.id)
                  return (
                    <div className="row gap-8" key={quest.id}>
                      <span style={{ color: claimed ? 'var(--green)' : 'var(--dim)', display: 'grid', placeItems: 'center' }}>
                        {claimed ? <Trophy size={12} /> : <Target size={12} />}
                      </span>
                      <span className="tiny grow">{quest.label}</span>
                      <span className="tiny mono dim">{Math.min(count, quest.target)}/{quest.target}</span>
                      <Pill tone={claimed ? 'green' : count >= quest.target ? 'amber' : 'slate'}>
                        {claimed ? 'claimed' : `${quest.xp} XP`}
                      </Pill>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <div className="stack gap-16">
          <Panel title="Badges" sub={`${state.badges.length} of ${BADGES.length} unlocked`} tight>
            <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {BADGES.map((badge) => {
                const has = state.badges.includes(badge.id)
                const progress = badge.progress?.(stats) ?? 0
                return (
                  <div key={badge.id} className={`badge-tile ${has ? 'earned' : ''}`}>
                    <div className="glyph">
                      <BadgeGlyph name={badge.icon} size={19} />
                    </div>
                    <div className="name">{badge.name}</div>
                    <div className="desc">{badge.description}</div>
                    <Pill tone={TIER_TONE[badge.tier]}>{badge.tier}</Pill>
                    {!has && <Meter value={progress} className="thin" />}
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="Challenge record" tight>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Best score</th>
                    <th>First try</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(state.challenges).length === 0 && (
                    <tr>
                      <td colSpan={5} className="dim">No challenge attempts yet.</td>
                    </tr>
                  )}
                  {Object.entries(state.challenges).map(([id, c]) => (
                    <tr key={id}>
                      <td className="mono">{id}</td>
                      <td>
                        <Pill tone={c.solved ? 'green' : 'amber'}>{c.solved ? 'solved' : 'unsolved'}</Pill>
                      </td>
                      <td className="mono dim">{c.attempts}</td>
                      <td className="mono">{Math.round(c.bestScore * 100)}%</td>
                      <td>{c.firstTry ? <Pill tone="violet">yes</Pill> : <span className="dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'educator' && (
        <div className="split">
          <Panel title="Educator export" sub="One row per topic, ready for a spreadsheet or LMS import">
            <div className="stack gap-14">
              <div className="panel sunken" style={{ padding: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Columns</div>
                <div className="row gap-6 wrap">
                  {['learner', 'topic_id', 'topic_title', 'domain', 'level', 'mastery_pct', 'stage', 'answers', 'pretest_pct', 'posttest_pct', 'normalised_gain', 'lesson_completed', 'completed_at'].map((c) => (
                    <span className="pill mono" key={c} style={{ fontSize: 9.5 }}>{c}</span>
                  ))}
                </div>
              </div>
              <p className="small muted" style={{ lineHeight: 1.6 }}>
                Normalised gain uses Hake's definition, <span className="mono">g = (post − pre) / (1 − pre)</span>. It is
                comparable across cohorts because it corrects for pretest ceiling effects. A value of 0.3 is medium and
                0.7 is high in the physics-education literature.
              </p>
              <div className="row gap-8 wrap">
                <Btn variant="primary" icon={<FileSpreadsheet size={14} />} onClick={exportCsv}>
                  Download CSV
                </Btn>
                <Btn icon={<Download size={14} />} onClick={exportJson}>
                  JSON snapshot
                </Btn>
              </div>
              <div className="divider" />
              <div className="row gap-10 wrap">
                <ShieldCheck size={15} color="var(--green)" />
                <span className="tiny muted grow">
                  All progress is stored locally in this browser (localStorage). Nothing is uploaded; the tutor only sends
                  the current circuit context when you ask a question.
                </span>
              </div>
            </div>
          </Panel>

          <div className="stack gap-16">
            <Panel title="Cohort snapshot" tight>
              <div className="stack gap-8">
                <div className="row gap-8"><span className="small grow">Topics touched</span><span className="mono">{started.length}</span></div>
                <div className="row gap-8"><span className="small grow">Topics mastered</span><span className="mono">{mastered.length}</span></div>
                <div className="row gap-8"><span className="small grow">Labs completed</span><span className="mono">{stats.lessonsCompleted}</span></div>
                <div className="row gap-8"><span className="small grow">Challenges solved</span><span className="mono">{stats.challengesSolved}</span></div>
                <div className="row gap-8"><span className="small grow">Tutor questions</span><span className="mono">{stats.tutorQuestions}</span></div>
                <div className="row gap-8"><span className="small grow">Noisy experiments</span><span className="mono">{stats.noiseRuns}</span></div>
                <div className="divider" />
                <div className="row gap-8"><span className="small grow">Mean mastery</span><span className="mono">{(averageMastery * 100).toFixed(1)}%</span></div>
                <div className="row gap-8"><span className="small grow">Total XP</span><span className="mono">{state.xp}</span></div>
              </div>
            </Panel>

            <Panel title="Danger zone" tight>
              <div className="stack gap-10">
                <p className="tiny muted" style={{ lineHeight: 1.55 }}>
                  Resetting erases mastery, XP, badges, quests and completed lessons in this browser. Your circuit and
                  settings are kept.
                </p>
                <Btn variant="danger" icon={<Trash2 size={13} />} onClick={() => setConfirmReset(true)}>
                  Reset all progress
                </Btn>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="split">
          <Panel title="Learner profile" sub="Used on exports and the dashboard greeting" tight>
            <div className="stack gap-14">
              <div className="stack gap-6">
                <label className="eyebrow">Display name</label>
                <input
                  className="chat-input"
                  style={{ minHeight: 38 }}
                  value={state.name}
                  onChange={(e) => state.setName(e.target.value)}
                  placeholder="Explorer"
                />
              </div>
              <div className="stack gap-6">
                <label className="eyebrow">Default shots</label>
                <div className="row gap-6 wrap">
                  {[128, 512, 1024, 4096, 8192].map((n) => (
                    <Btn
                      key={n}
                      size="sm"
                      variant={state.settings.shots === n ? 'primary' : 'ghost'}
                      onClick={() => state.setSettings({ shots: n })}
                    >
                      {n.toLocaleString()}
                    </Btn>
                  ))}
                </div>
              </div>
              <div className="divider" />
              <Toggle
                label="AI tutor"
                detail="Allow Chinnu to answer with the server-side AI service, falling back to the offline engine."
                on={state.settings.tutorEnabled}
                onChange={(v) => state.setSettings({ tutorEnabled: v })}
              />
              <Toggle
                label="Reduce motion"
                detail="Stop the galaxy from auto-rotating and calm the ambient animation."
                on={state.settings.reduceMotion}
                onChange={(v) => state.setSettings({ reduceMotion: v })}
              />
              <Toggle
                label="Start with noisy hardware"
                detail="New sessions begin with a depolarising channel enabled."
                on={state.settings.noisy}
                onChange={(v) => state.setSettings({ noisy: v })}
              />
            </div>
          </Panel>

          <div className="stack gap-16">
            <Panel title="Level" tight>
              <div className="row gap-14">
                <Ring value={level.progress} size={78} thickness={7} label={`Lv ${level.level}`} sub={level.title} />
                <div className="stack gap-4 grow">
                  <span className="small" style={{ fontWeight: 600 }}>{level.title}</span>
                  <span className="tiny dim">{state.xp.toLocaleString()} XP total · {(level.nextLevelXp - state.xp).toLocaleString()} to next</span>
                  <Meter value={level.progress} />
                  <span className="tiny dim">{Math.round(level.progress * 100)}% of the way to {level.title === 'Quantum Advantage' ? 'the top' : `level ${level.level + 1}`}</span>
                </div>
              </div>
            </Panel>

            <Panel title="Session" tight>
              <div className="stack gap-8">
                <div className="row gap-8">
                  <Flame size={13} color="var(--amber)" />
                  <span className="small grow">Current streak</span>
                  <span className="mono">{streak} days</span>
                </div>
                <div className="row gap-8">
                  <Award size={13} color="var(--violet)" />
                  <span className="small grow">Best streak</span>
                  <span className="mono">{state.streak.best} days</span>
                </div>
                <div className="row gap-8">
                  <Settings2 size={13} color="var(--cyan)" />
                  <span className="small grow">Engine</span>
                  <span className="mono tiny">client statevector</span>
                </div>
                <div className="row gap-8">
                  <RotateCcw size={13} color="var(--dim)" />
                  <span className="small grow">Storage</span>
                  <span className="mono tiny">localStorage v1</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Btn>
            <Btn
              variant="danger"
              icon={<Trash2 size={13} />}
              onClick={() => {
                state.resetProgress()
                setConfirmReset(false)
                state.toast({ title: 'Progress reset', detail: 'A clean slate. Your circuit was kept.', tone: 'info' })
              }}
            >
              Yes, reset everything
            </Btn>
          </>
        }
      >
        <p className="lead">
          This cannot be undone. Export a CSV or JSON snapshot first if you need the record for a course portfolio.
        </p>
        <div className="row gap-8" style={{ marginTop: 14 }}>
          <Btn icon={<FileSpreadsheet size={13} />} onClick={exportCsv}>Export CSV now</Btn>
          <Btn icon={<Download size={13} />} variant="ghost" onClick={exportJson}>JSON</Btn>
        </div>
      </Modal>
    </div>
  )
}

function Toggle({
  label,
  detail,
  on,
  onChange,
}: {
  label: string
  detail: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="row gap-12" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange(!on)
        }}
        style={{
          width: 34,
          height: 20,
          borderRadius: 99,
          flex: 'none',
          marginTop: 2,
          background: on ? 'var(--violet)' : 'rgba(255,255,255,.12)',
          position: 'relative',
          transition: 'background .2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .2s',
          }}
        />
      </span>
      <span className="grow">
        <span className="small" style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        <span className="tiny dim" style={{ display: 'block', lineHeight: 1.45 }}>{detail}</span>
      </span>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  )
}
