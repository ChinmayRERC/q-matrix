/**
 * Virtual Lab — a seven-stage lesson:
 * Aim → Theory → Pretest → Procedure → Simulation → Posttest → References.
 *
 * The pre/post pair is the point: it measures normalised learning gain (Hake)
 * rather than time-on-page, and every answer feeds the BKT mastery model.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Play,
  Quote,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import { TOPIC_BY_ID } from '../content/topics.generated'
import { gainLabel, learningGain, lessonFor, type LabLesson, type Question } from '../lib/lessons'
import { XP } from '../lib/gamification'
import { MASTERED_THRESHOLD, decayedMastery, masteryStage, STAGE_LABEL } from '../lib/mastery'
import { useAppStore } from '../store/useAppStore'
import { Btn, Meter, Panel, Pill, Ring, Tabs } from './ui'
import { Composer } from './Composer'
import { TutorPanel } from './TutorPanel'

const STAGES = ['Aim', 'Theory', 'Pretest', 'Procedure', 'Simulation', 'Posttest', 'References'] as const

export function LessonView({ topicId, onOpenTopic, onBack }: { topicId: string; onOpenTopic: (id: string) => void; onBack: () => void }) {
  const topic = TOPIC_BY_ID[topicId]
  const lesson = useMemo(() => lessonFor(topicId), [topicId])
  const mastery = useAppStore((s) => s.mastery)
  const lessons = useAppStore((s) => s.lessons)
  const circuit = useAppStore((s) => s.circuit)
  const startLesson = useAppStore((s) => s.startLesson)
  const completeLesson = useAppStore((s) => s.completeLesson)
  const recordAnswer = useAppStore((s) => s.recordAnswer)

  const [stage, setStage] = useState(0)
  const [preScore, setPreScore] = useState<number | null>(null)
  const [postScore, setPostScore] = useState<number | null>(null)
  const [stepsDone, setStepsDone] = useState<Set<number>>(new Set())
  const [done, setDone] = useState(false)

  const progress = lessons[topicId]
  const m = decayedMastery(mastery[topicId], Date.now())
  const stageLabel = masteryStage(mastery[topicId])

  useEffect(() => {
    startLesson(topicId)
    setStage(0)
    setPreScore(null)
    setPostScore(null)
    setDone(false)
    setStepsDone(new Set())
  }, [topicId, startLesson])

  if (!topic || !lesson) {
    return (
      <div className="empty">
        <div className="glyph"><BookOpen size={18} /></div>
        <div style={{ fontWeight: 600, color: 'var(--muted)' }}>No lesson found for “{topicId}”</div>
        <Btn onClick={onBack}>Back to paths</Btn>
      </div>
    )
  }

  const finishPost = (score: number) => {
    // A posttest without a pretest would fabricate a gain of post - 0. Send the
    // learner back instead of silently recording an invalid measurement.
    if (preScore === null) {
      setStage(2)
      return
    }
    setPostScore(score)
    setDone(true)
    completeLesson(topicId, preScore, score, lesson.xp)
    setStage(6)
  }

  const gain = preScore !== null && postScore !== null ? learningGain(preScore, postScore) : null
  const earnedXp = lesson.xp + (postScore === 1 ? XP.perfectQuiz : 0)

  return (
    <div className="stack gap-16 fade-in">
      <div className="row gap-10 wrap">
        <button className="icon-btn" onClick={onBack} title="Back">
          <ArrowLeft size={15} />
        </button>
        <div className="grow" style={{ minWidth: 220 }}>
          <div className="row gap-6">
            <Pill tone={topic.level === 'B' ? 'green' : topic.level === 'I' ? 'cyan' : topic.level === 'A' ? 'amber' : 'pink'}>
              {topic.levelName}
            </Pill>
            <span className="tiny dim">{topic.domainName}</span>
            <span className="tiny dim mono">{topic.id}</span>
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(22px, 3vw, 30px)', marginTop: 4 }}>{lesson.title}</h1>
        </div>
        <div className="row gap-10">
          <div className="stack gap-4" style={{ width: 110 }}>
            <Meter value={m} tone={m >= MASTERED_THRESHOLD ? 'green' : undefined} className="thin" />
            <span className="tiny dim mono">{(m * 100).toFixed(0)}% · {STAGE_LABEL[stageLabel]}</span>
          </div>
          <Ring value={m} size={44} thickness={4} label={<span style={{ fontSize: 11 }}>{(m * 100).toFixed(0)}</span>} color={m >= MASTERED_THRESHOLD ? 'var(--green)' : 'var(--violet)'} />
        </div>
      </div>

      <div className="rail">
        {STAGES.map((label, i) => (
          <button
            key={label}
            className={`rail-step ${i === stage ? 'on' : i < stage ? 'done' : ''}`}
            onClick={() => setStage(i)}
          >
            <span className="n">{i < stage ? <Check size={9} /> : i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,340px)', gap: 16, alignItems: 'start' }} className="lesson-grid">
        <div className="stack gap-16" style={{ minWidth: 0 }}>
          {stage === 0 && (
            <Panel>
              <div className="stack gap-16" style={{ padding: 4 }}>
                <div>
                  <div className="eyebrow">Stage 1 · Aim</div>
                  <h2 className="display" style={{ fontSize: 24, marginTop: 6 }}>What you'll be able to do</h2>
                </div>
                <p className="lead">{lesson.aim}</p>

                <div className="cols-3">
                  <div className="stat">
                    <div className="k">Time</div>
                    <div className="v" style={{ fontSize: 18 }}>{lesson.minutes} min</div>
                    <div className="h">{lesson.pretest.length + lesson.posttest.length} questions</div>
                  </div>
                  <div className="stat">
                    <div className="k">Reward</div>
                    <div className="v" style={{ fontSize: 18 }}>+{lesson.xp} XP</div>
                    <div className="h">+{XP.correctAnswer}/answer · +{XP.perfectQuiz} perfect posttest</div>
                  </div>
                  <div className="stat">
                    <div className="k">Simulator</div>
                    <div className="v" style={{ fontSize: 18 }}>{lesson.simulation.templateId}</div>
                    <div className="h">preloaded circuit</div>
                  </div>
                </div>

                <div>
                  <div className="hr-label">By the end</div>
                  <div className="stack gap-8" style={{ marginTop: 12 }}>
                    {lesson.procedure.slice(0, 3).map((step, i) => (
                      <div className="row gap-9" key={i}>
                        <CheckCircle2 size={14} color="var(--violet)" style={{ flex: 'none', marginTop: 2 }} />
                        <span className="small muted">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="row gap-8 wrap">
                  <Btn variant="primary" icon={<Play size={13} />} onClick={() => setStage(1)}>
                    Begin theory
                  </Btn>
                  {progress?.completedAt && <Pill tone="green">completed before</Pill>}
                </div>
              </div>
            </Panel>
          )}

          {stage === 1 && (
            <Panel>
              <div className="stack gap-16" style={{ padding: 4 }}>
                <div>
                  <div className="eyebrow">Stage 2 · Theory</div>
                  <h2 className="display" style={{ fontSize: 24, marginTop: 6 }}>The idea in plain language</h2>
                </div>
                <div className="prose">
                  {lesson.theory.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <div className="panel sunken" style={{ padding: 16 }}>
                  <div className="row gap-8" style={{ marginBottom: 6 }}>
                    <Lightbulb size={14} color="var(--amber)" />
                    <span className="eyebrow" style={{ color: 'var(--amber)' }}>Key idea</span>
                  </div>
                  <p className="lead" style={{ fontSize: 13.5 }}>{lesson.keyIdea}</p>
                </div>
                <div className="row gap-8">
                  <Btn variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setStage(0)}>Back</Btn>
                  <Btn variant="primary" onClick={() => setStage(2)}>Take the pretest <ArrowRight size={13} /></Btn>
                </div>
              </div>
            </Panel>
          )}

          {stage === 2 && (
            <Panel>
              <div className="stack gap-14" style={{ padding: 4 }}>
                <div>
                  <div className="eyebrow">Stage 3 · Pretest</div>
                  <h2 className="display" style={{ fontSize: 24, marginTop: 6 }}>Where are you starting from?</h2>
                  <p className="small muted" style={{ marginTop: 6 }}>
                    Answer without looking anything up. Wrong answers are useful — they calibrate your mastery estimate, and
                    they cost nothing.
                  </p>
                </div>
                {preScore !== null ? (
                  <div className="panel sunken" style={{ padding: 16 }}>
                    <div className="row gap-10 wrap">
                      <CheckCircle2 size={18} color="var(--green)" />
                      <span className="small grow" style={{ fontWeight: 600 }}>
                        Pretest recorded at {Math.round(preScore * 100)}%. It is locked so the posttest measures the same starting point.
                      </span>
                      <Btn variant="primary" onClick={() => setStage(3)}>
                        Continue to procedure <ArrowRight size={13} />
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <Quiz
                    questions={lesson.pretest}
                    onAnswer={(correct) => recordAnswer(topicId, correct)}
                    onComplete={(score) => {
                      setPreScore(score)
                      setStage(3)
                    }}
                    nextLabel="Continue to procedure"
                  />
                )}
              </div>
            </Panel>
          )}

          {stage === 3 && (
            <Panel>
              <div className="stack gap-16" style={{ padding: 4 }}>
                <div>
                  <div className="eyebrow">Stage 4 · Procedure</div>
                  <h2 className="display" style={{ fontSize: 24, marginTop: 6 }}>Build it yourself</h2>
                </div>
                <div className="stack gap-8">
                  {lesson.procedure.map((step, i) => {
                    const checked = stepsDone.has(i)
                    return (
                      <button
                        key={i}
                        className="row gap-10"
                        onClick={() => {
                          const next = new Set(stepsDone)
                          if (checked) next.delete(i)
                          else next.add(i)
                          setStepsDone(next)
                        }}
                        style={{
                          background: checked ? 'rgba(94,226,168,.06)' : 'rgba(255,255,255,.02)',
                          border: `1px solid ${checked ? 'rgba(94,226,168,.28)' : 'var(--line)'}`,
                          borderRadius: 12,
                          padding: '11px 13px',
                          textAlign: 'left',
                          color: 'inherit',
                          alignItems: 'flex-start',
                          gap: 11,
                        }}
                      >
                        <span style={{ marginTop: 1, color: checked ? 'var(--green)' : 'var(--dim)' }}>
                          {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </span>
                        <span className="small" style={{ lineHeight: 1.55, color: checked ? 'var(--muted)' : '#c8cee4' }}>
                          {step}
                        </span>
                        <span className="tiny dim mono" style={{ marginLeft: 'auto' }}>{i + 1}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="panel sunken" style={{ padding: 15 }}>
                  <div className="row gap-8" style={{ marginBottom: 8 }}>
                    <FlaskConical size={14} color="var(--cyan)" />
                    <span className="eyebrow" style={{ color: 'var(--cyan)' }}>Simulation brief</span>
                  </div>
                  <p className="small" style={{ lineHeight: 1.6 }}>{lesson.simulation.instructions}</p>
                  <p className="tiny dim" style={{ marginTop: 8 }}><strong>Expected:</strong> {lesson.simulation.expected}</p>
                  {lesson.simulation.challenge && (
                    <p className="tiny" style={{ marginTop: 6, color: '#e2d9ff' }}><strong>Stretch:</strong> {lesson.simulation.challenge}</p>
                  )}
                </div>

                <div className="row gap-8">
                  <Btn variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setStage(2)}>Back</Btn>
                  <Btn
                    variant="primary"
                    icon={<Beaker size={13} />}
                    onClick={() => setStage(4)}
                  >
                    Open the simulation
                  </Btn>
                </div>
              </div>
            </Panel>
          )}

          {stage === 4 && (
            <div className="stack gap-14">
              <Panel
                title="Simulation"
                sub={`${lesson.simulation.templateId} is preloaded — every gate is live`}
                actions={<Pill tone="cyan">{lesson.simulation.templateId}</Pill>}
                tight
              >
                <div className="stack gap-10">
                  <p className="small muted" style={{ lineHeight: 1.6 }}>{lesson.simulation.instructions}</p>
                  <div className="insight tip">
                    <span className="dot" />
                    <div>
                      <div className="t">Predict before you run</div>
                      <div className="d">{lesson.simulation.expected}</div>
                    </div>
                  </div>
                </div>
              </Panel>
              <Composer embedded initialTemplate={lesson.simulation.templateId} />
              <div className="row gap-8">
                <Btn variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setStage(3)}>Back to procedure</Btn>
                <div className="grow" />
                <Btn variant="primary" onClick={() => setStage(5)}>
                  Take the posttest <ArrowRight size={13} />
                </Btn>
              </div>
            </div>
          )}

          {stage === 5 && (
            <Panel>
              <div className="stack gap-14" style={{ padding: 4 }}>
                <div>
                  <div className="eyebrow">Stage 6 · Posttest</div>
                  <h2 className="display" style={{ fontSize: 24, marginTop: 6 }}>Same ideas, new questions</h2>
                  <p className="small muted" style={{ marginTop: 6 }}>
                    The gain is measured against your pretest, so this is the honest test of what changed.
                  </p>
                </div>
                {preScore === null ? (
                  <div className="panel sunken" style={{ padding: 16 }}>
                    <div className="stack gap-10">
                      <span className="small" style={{ fontWeight: 600 }}>
                        Take the pretest first so your learning gain has a real baseline.
                      </span>
                      <div className="row gap-8">
                        <Btn variant="primary" onClick={() => setStage(2)} icon={<ArrowLeft size={13} />}>
                          Go to pretest
                        </Btn>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Quiz
                    questions={lesson.posttest}
                    onAnswer={(correct) => recordAnswer(topicId, correct)}
                    onComplete={finishPost}
                    nextLabel="See my learning gain"
                  />
                )}
              </div>
            </Panel>
          )}

          {stage === 6 && (
            <div className="stack gap-14">
              {done && preScore !== null && postScore !== null && gain !== null && (
                <Panel glow>
                  <div className="stack gap-16" style={{ padding: 4 }}>
                    <div className="row gap-10">
                      <Trophy size={20} color="var(--amber)" />
                      <h2 className="display" style={{ fontSize: 22 }}>Lab complete</h2>
                      <div className="grow" />
                      <Pill tone="green">+{earnedXp} XP</Pill>
                    </div>
                    <div className="cols-4">
                      <div className="stat">
                        <div className="k">Pretest</div>
                        <div className="v">{Math.round(preScore * 100)}%</div>
                      </div>
                      <div className="stat">
                        <div className="k">Posttest</div>
                        <div className="v">{Math.round(postScore * 100)}%</div>
                      </div>
                      <div className="stat accent">
                        <div className="k">Normalised gain</div>
                        <div className="v" style={{ color: gain >= 0.3 ? 'var(--green)' : 'var(--amber)' }}>
                          {gain >= 0 ? `+${Math.round(gain * 100)}%` : `${Math.round(gain * 100)}%`}
                        </div>
                      </div>
                      <div className="stat">
                        <div className="k">Verdict</div>
                        <div className="v" style={{ fontSize: 16 }}>{gainLabel(gain)}</div>
                      </div>
                    </div>
                    <div className="panel sunken" style={{ padding: 14 }}>
                      <p className="tiny dim" style={{ marginBottom: 6 }}>
                        Hake gain = (posttest − pretest) / (1 − pretest). 70%+ is high, 30–70% medium, below 30% low.
                      </p>
                      <p className="small muted" style={{ lineHeight: 1.6 }}>
                        {gain >= 0.7
                          ? 'That is a high gain — the lesson landed. Revisit this topic in a few days to keep the mastery from decaying.'
                          : gain >= 0.3
                            ? 'A solid medium gain. One more pass through the simulation with the circuit rebuilt from scratch would push this to mastery.'
                            : gain > 0
                              ? 'Some gain. Try the challenge for this topic — building the circuit unaided is the fastest way to close the gap.'
                              : 'No measurable gain yet. That is information, not failure: replay the simulation and write your prediction down before running it.'}
                      </p>
                    </div>
                    <div className="row gap-8 wrap">
                      <Btn variant="primary" onClick={() => setStage(4)} icon={<FlaskConical size={13} />}>Replay the simulation</Btn>
                      <Btn variant="ghost" onClick={() => onOpenTopic(nextTopicId(topicId))}>Next topic <ArrowRight size={13} /></Btn>
                    </div>
                  </div>
                </Panel>
              )}

              <Panel title="References" sub="Curated reading for this topic" tight>
                <div className="stack gap-10">
                  {lesson.references.map((ref) => (
                    <a key={ref.url} href={ref.url} target="_blank" rel="noreferrer" className="row gap-10" style={{ color: 'inherit', textDecoration: 'none' }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(155,124,255,.12)', color: 'var(--violet)', flex: 'none' }}>
                        <BookOpen size={14} />
                      </span>
                      <span className="grow">
                        <span className="small" style={{ display: 'block', fontWeight: 600 }}>{ref.label}</span>
                        <span className="tiny dim">{ref.note}</span>
                      </span>
                      <ChevronRight size={14} color="var(--dim)" />
                    </a>
                  ))}
                  {lesson.references.length === 0 && <div className="tiny dim">No external references for this topic yet.</div>}
                </div>
              </Panel>
            </div>
          )}
        </div>

        <div className="stack gap-14">
          <Panel title="Your progress" tight>
            <div className="stack gap-12">
              <div className="row gap-12">
                <Ring value={m} size={62} thickness={6} label={<span style={{ fontSize: 14 }}>{(m * 100).toFixed(0)}</span>} color={m >= MASTERED_THRESHOLD ? 'var(--green)' : 'var(--violet)'} />
                <div className="stack gap-2">
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{STAGE_LABEL[stageLabel]}</span>
                  <span className="tiny dim">{mastery[topicId]?.attempts ?? 0} answers recorded</span>
                  <span className="tiny dim">Mastery decays without review</span>
                </div>
              </div>
              <div className="divider" />
              <div className="stack gap-6">
                {STAGES.map((s, i) => (
                  <div className="row gap-8" key={s}>
                    <span style={{ color: i < stage ? 'var(--green)' : i === stage ? 'var(--violet)' : 'var(--dim)', display: 'grid', placeItems: 'center' }}>
                      {i < stage ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    </span>
                    <span className="tiny" style={{ color: i === stage ? 'var(--text)' : 'var(--muted)' }}>{s}</span>
                    <span className="grow" />
                    {i === 2 && preScore !== null && <span className="tiny mono dim">{Math.round(preScore * 100)}%</span>}
                    {i === 5 && postScore !== null && <span className="tiny mono dim">{Math.round(postScore * 100)}%</span>}
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="stack gap-6">
                <span className="eyebrow">Prerequisites</span>
                {topic.prerequisites.length === 0 ? (
                  <span className="tiny dim">None — this is an entry point.</span>
                ) : (
                  topic.prerequisites.map((id) => (
                    <button
                      key={id}
                      className="row gap-6"
                      style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left' }}
                      onClick={() => onOpenTopic(id)}
                    >
                      <Pill tone={decayedMastery(mastery[id], Date.now()) >= 0.55 ? 'green' : 'amber'}>
                        {decayedMastery(mastery[id], Date.now()) >= 0.55 ? 'ready' : 'review'}
                      </Pill>
                      <span className="tiny grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {TOPIC_BY_ID[id]?.title ?? id}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Lab facts" tight>
            <div className="stack gap-8">
              <div className="row gap-8"><Target size={13} color="var(--violet)" /><span className="tiny muted">{topic.domainName}</span></div>
              <div className="row gap-8"><ClipboardList size={13} color="var(--cyan)" /><span className="tiny muted">{lesson.pretest.length + lesson.posttest.length} questions</span></div>
              <div className="row gap-8"><ListChecks size={13} color="var(--green)" /><span className="tiny muted">{lesson.procedure.length} procedure steps</span></div>
              <div className="row gap-8"><Sparkles size={13} color="var(--amber)" /><span className="tiny muted">{lesson.xp} XP available</span></div>
              <div className="divider" />
              <p className="tiny dim" style={{ lineHeight: 1.5 }}>{topic.idea}</p>
            </div>
          </Panel>

          <TutorPanel
            circuit={circuit}
            sim={null}
            topic={{ id: topic.id, title: topic.title, domainName: topic.domainName, levelName: topic.levelName }}
            mastery={m}
            height={430}
          />
        </div>
      </div>

      <style>{`@media (max-width: 1180px) { .lesson-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

function Quiz({
  questions,
  onAnswer,
  onComplete,
  nextLabel,
}: {
  questions: Question[]
  onAnswer: (correct: boolean) => void
  onComplete: (score: number) => void
  nextLabel: string
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const answered = Object.keys(answers).length
  const score = questions.length ? questions.filter((q) => answers[q.id] === q.answer).length / questions.length : 0
  const allDone = answered === questions.length

  return (
    <div className="stack gap-10">
      {questions.map((q, qi) => {
        const picked = answers[q.id]
        const locked = picked !== undefined
        return (
          <div className="q-card" key={q.id}>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <span className="pill mono">Q{qi + 1}</span>
              <span className="tiny dim">difficulty {q.difficulty}/3</span>
              <span className="grow" />
              {q.generic && <Pill tone="cyan">domain</Pill>}
            </div>
            <div className="q-prompt">{q.prompt}</div>
            <div className="q-options">
              {q.options.map((opt, oi) => {
                const isPicked = picked === oi
                const isCorrect = q.answer === oi
                const cls = locked ? (isCorrect ? 'correct' : isPicked ? 'wrong' : '') : ''
                return (
                  <button
                    key={oi}
                    className={`q-option ${cls}`}
                    disabled={locked}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.id]: oi }))
                      onAnswer(oi === q.answer)
                    }}
                  >
                    <span className="key">{String.fromCharCode(65 + oi)}</span>
                    <span className="grow">{opt}</span>
                    {locked && isCorrect && <Check size={13} color="var(--green)" />}
                  </button>
                )
              })}
            </div>
            {locked && <div className="q-explain">{q.explanation}</div>}
          </div>
        )
      })}

      <div className="row gap-10 wrap" style={{ marginTop: 4 }}>
        <span className="tiny dim">
          {answered}/{questions.length} answered
        </span>
        <div className="grow" />
        <Btn
          variant="primary"
          disabled={!allDone}
          onClick={() => onComplete(score)}
          icon={<CheckCircle2 size={13} />}
        >
          {nextLabel} <ArrowRight size={13} />
        </Btn>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextTopicId(current: string): string {
  const topic = TOPIC_BY_ID[current]
  if (!topic) return current
  // Prefer a topic that lists this one as a prerequisite; otherwise the next in the domain.
  const dependent = Object.values(TOPIC_BY_ID).find((t) => t.prerequisites.includes(current) && t.domain === topic.domain)
  if (dependent) return dependent.id
  const siblings = Object.values(TOPIC_BY_ID).filter((t) => t.domain === topic.domain)
  const index = siblings.findIndex((t) => t.id === current)
  return siblings[(index + 1) % Math.max(1, siblings.length)]?.id ?? current
}
