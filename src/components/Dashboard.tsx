/**
 * Home screen. The dashboard is a launchpad: it answers "what should I do right
 * now?" using the same BKT recommender that powers the Galaxy, then gets out of
 * the way.
 */
import { useMemo } from 'react'
import {
  ArrowRight,
  BookOpen,
  Flame,
  Gamepad2,
  Orbit,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { TOPICS, TOPIC_BY_ID } from '../content/topics.generated'
import { BADGES, QUESTS, levelInfo, liveStreak } from '../lib/gamification'
import { MASTERED_THRESHOLD, decayedMastery, recommendTopics } from '../lib/mastery'
import { gainLabel } from '../lib/lessons'
import { useAppStore, deriveStats } from '../store/useAppStore'
import { Btn, Meter, Panel, Pill, Ring, Stat } from './ui'

export function Dashboard({ onOpenTopic, onNavigate }: { onOpenTopic: (id: string) => void; onNavigate: (hash: string) => void }) {
  const state = useAppStore()
  const level = levelInfo(state.xp)
  const streak = liveStreak(state.streak)
  const stats = deriveStats(state)
  const mastered = Object.values(state.mastery).filter((m) => decayedMastery(m, Date.now()) >= MASTERED_THRESHOLD).length
  const started = Object.values(state.mastery).filter((m) => m.attempts > 0).length

  const recommendations = useMemo(
    () =>
      recommendTopics(
        TOPICS.map((t) => ({
          id: t.id,
          title: t.title,
          domain: t.domain,
          level: t.level,
          prerequisites: t.prerequisites,
          estimatedMinutes: t.estimatedMinutes,
        })),
        { mastery: state.mastery, recent: state.recent, minutesAvailable: 20 },
        4,
      ),
    [state.mastery, state.recent],
  )

  const continueTopics = state.recent
    .map((id) => TOPIC_BY_ID[id])
    .filter(Boolean)
    .slice(0, 3)

  const suggestionTopics = (continueTopics.length ? continueTopics.map((t) => t.id) : recommendations.map((r) => r.topic.id))
    .flatMap((id) => (TOPIC_BY_ID[id] ? [TOPIC_BY_ID[id]] : []))

  const dailyQuests = QUESTS.filter((q) => q.cadence === 'daily')
  const weeklyQuests = QUESTS.filter((q) => q.cadence === 'weekly')
  const earned = BADGES.filter((b) => state.badges.includes(b.id))
  const nextBadge = BADGES.find((b) => !state.badges.includes(b.id))
  const lessonsDone = stats.lessonsCompleted

  return (
    <div className="stack gap-18 fade-in">
      <div className="hero">
        <div className="row gap-24 wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="grow" style={{ minWidth: 280 }}>
            <div className="row gap-8">
              <Pill tone="violet">
                <Sparkles size={10} /> Level {level.level} · {level.title}
              </Pill>
              <Pill tone="amber">
                <Flame size={10} /> {streak} day streak
              </Pill>
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(30px, 4vw, 46px)', marginTop: 12 }}>
              The universe is <span style={{ color: 'var(--violet)' }}>undecided</span>.
              <br />
              Collapse it, {state.name}.
            </h1>
            <p className="lead" style={{ marginTop: 12, maxWidth: 560 }}>
              {lessonsDone === 0
                ? 'Start with a seven-stage Virtual Lab, then build the same circuit by hand in the workbench. Every answer updates your mastery model.'
                : `${lessonsDone} lab${lessonsDone === 1 ? '' : 's'} complete, ${mastered} topic${mastered === 1 ? '' : 's'} mastered. Your model says the next best move is below.`}
            </p>
            <div className="row gap-8 wrap" style={{ marginTop: 18 }}>
              <Btn variant="primary" size="lg" icon={<BookOpen size={15} />} onClick={() => onOpenTopic(recommendations[0]?.topic.id ?? TOPICS[0].id)}>
                {lessonsDone === 0 ? 'Start the first lab' : 'Continue learning'}
              </Btn>
              <Btn size="lg" icon={<Orbit size={15} />} onClick={() => onNavigate('#/galaxy')}>
                Open the Galaxy
              </Btn>
              <Btn size="lg" variant="ghost" icon={<Gamepad2 size={15} />} onClick={() => onNavigate('#/challenges')}>
                Challenges
              </Btn>
            </div>
          </div>

          <div className="col" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Ring value={level.progress} size={116} thickness={8} label={`${state.xp.toLocaleString()} XP`} sub={`Lv ${level.level}`} />
            <div className="stack gap-6" style={{ minWidth: 132 }}>
              <div className="row gap-6 tiny muted">
                <Target size={12} /> {(level.nextLevelXp - state.xp).toLocaleString()} XP to next
              </div>
              <Meter value={level.progress} />
              <div className="tiny dim">{level.title}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cols-4">
        <Stat label="Mastered" value={mastered} hint={`${started} topics in progress`} accent />
        <Stat label="Lessons" value={lessonsDone} hint="Virtual Lab completions" />
        <Stat label="Challenges" value={stats.challengesSolved} hint={`${state.badges.length} badges earned`} />
        <Stat label="Streak" value={`${streak}d`} hint={`best ${state.streak.best} days`} tone="var(--amber)" />
      </div>

      <div className="split">
        <div className="stack gap-16">
          <Panel
            title={continueTopics.length ? 'Pick up where you left off' : 'Recommended for you'}
            sub="Ordered by what your mastery model thinks will help most"
            actions={<Btn size="sm" variant="ghost" onClick={() => onNavigate('#/paths')}>All paths</Btn>}
          >
            <div className="stack gap-10">
              {suggestionTopics.map((topic, i) => {
                const m = decayedMastery(state.mastery[topic.id], Date.now())
                const rec = recommendations.find((r) => r.topic.id === topic.id)
                return (
                  <button
                    key={topic.id}
                    className="topic-card"
                    onClick={() => onOpenTopic(topic.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        flex: 'none',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(155,124,255,.13)',
                        color: 'var(--violet)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6">
                        <Pill tone={topic.level === 'B' ? 'green' : topic.level === 'I' ? 'cyan' : topic.level === 'A' ? 'amber' : 'pink'}>
                          {topic.levelName}
                        </Pill>
                        <span className="tiny dim">{topic.domainName}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{topic.title}</div>
                      <div className="tiny muted" style={{ marginTop: 2 }}>
                        {rec?.reason ?? `${topic.estimatedMinutes} min · ${topic.idea}`}
                      </div>
                    </div>
                    <div className="stack gap-4" style={{ width: 84 }}>
                      <Meter value={m} tone={m >= MASTERED_THRESHOLD ? 'green' : undefined} className="thin" />
                      <span className="tiny dim mono" style={{ textAlign: 'right' }}>
                        {(m * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ArrowRight size={15} color="var(--dim)" />
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel title="Learning gain" sub="Pre-test → post-test, normalised (Hake)" tight>
            {Object.keys(state.lessons).length === 0 ? (
              <div className="empty">
                <div className="glyph"><Zap size={17} /></div>
                <div style={{ color: 'var(--muted)', fontWeight: 600 }}>No lab attempts yet</div>
                <div style={{ maxWidth: 380, lineHeight: 1.5 }}>
                  Each Virtual Lab records a pre-test and a post-test, so you can see the actual learning gain rather than
                  just time spent.
                </div>
              </div>
            ) : (
              <div className="stack gap-8">
                {Object.entries(state.lessons)
                  .filter(([, l]) => l.completedAt)
                  .sort((a, b) => (b[1].completedAt ?? 0) - (a[1].completedAt ?? 0))
                  .slice(0, 5)
                  .map(([id, lesson]) => {
                    const topic = TOPIC_BY_ID[id]
                    return (
                      <div className="row gap-10" key={id}>
                        <span className="small grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {topic?.title ?? id}
                        </span>
                        <span className="tiny dim mono">
                          {lesson.pre * 100}% → {lesson.post * 100}%
                        </span>
                        <Pill tone={lesson.gain >= 0.7 ? 'green' : lesson.gain >= 0.3 ? 'amber' : 'cyan'}>{gainLabel(lesson.gain)}</Pill>
                      </div>
                    )
                  })}
              </div>
            )}
          </Panel>
        </div>

        <div className="stack gap-16">
          <Panel title="Daily quests" sub="Reset at midnight local time" tight actions={<Pill tone="amber">+{dailyQuests.reduce((s, q) => s + q.xp, 0)} XP</Pill>}>
            <div>
              {dailyQuests.map((quest) => {
                const count = state.daily.progress[quest.id] ?? 0
                const claimed = state.daily.claimed.includes(quest.id)
                const done = count >= quest.target
                return (
                  <div className="quest-row" key={quest.id}>
                    <div className="q-icon">
                      <Target size={13} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6">
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{quest.label}</span>
                        <span className="grow" />
                        <span className="tiny dim mono">
                          {Math.min(count, quest.target)}/{quest.target}
                        </span>
                      </div>
                      <div className="tiny dim" style={{ marginBottom: 5 }}>{quest.detail}</div>
                      <Meter value={count / quest.target} tone={done ? 'green' : undefined} className="thin" />
                    </div>
                    {claimed ? (
                      <Pill tone="green">claimed</Pill>
                    ) : done ? (
                      <Btn size="sm" variant="primary" onClick={() => state.claimQuest(quest.id)}>
                        +{quest.xp}
                      </Btn>
                    ) : (
                      <span className="pill">{quest.xp} XP</span>
                    )}
                  </div>
                )
              })}
              <div className="hr-label" style={{ margin: '10px 0' }}>This week</div>
              {weeklyQuests.map((quest) => {
                const count = state.weekly.progress[quest.id] ?? 0
                const claimed = state.weekly.claimed.includes(quest.id)
                const done = count >= quest.target
                return (
                  <div className="quest-row" key={quest.id}>
                    <div className="q-icon" style={{ background: 'rgba(98,224,242,.12)', color: 'var(--cyan)' }}>
                      <Trophy size={13} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6">
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{quest.label}</span>
                        <span className="grow" />
                        <span className="tiny dim mono">
                          {Math.min(count, quest.target)}/{quest.target}
                        </span>
                      </div>
                      <Meter value={count / quest.target} tone={done ? 'green' : 'cyan'} className="thin" />
                    </div>
                    {claimed ? <Pill tone="green">claimed</Pill> : done ? (
                      <Btn size="sm" variant="primary" onClick={() => state.claimQuest(quest.id)}>+{quest.xp}</Btn>
                    ) : (
                      <span className="pill">{quest.xp} XP</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="Badges" sub={`${earned.length} of ${BADGES.length} unlocked`} tight actions={<Btn size="sm" variant="ghost" onClick={() => onNavigate('#/progress')}>All</Btn>}>
            <div className="row gap-8 wrap">
              {BADGES.slice(0, 8).map((badge) => {
                const has = state.badges.includes(badge.id)
                return (
                  <div
                    key={badge.id}
                    className={`badge-tile ${has ? 'earned' : ''}`}
                    style={{ width: 78, padding: '10px 6px' }}
                    title={badge.description}
                  >
                    <div className="glyph" style={{ width: 32, height: 32, fontSize: 15 }}>{badge.icon}</div>
                    <div className="name" style={{ fontSize: 9.5 }}>{badge.name}</div>
                  </div>
                )
              })}
            </div>
            {nextBadge && (
              <div className="row gap-8" style={{ marginTop: 12 }}>
                <Sparkles size={13} color="var(--amber)" />
                <span className="tiny muted">
                  Next: <strong>{nextBadge.name}</strong> — {nextBadge.description}
                </span>
              </div>
            )}
          </Panel>

          <Panel title="Quick start" tight>
            <div className="stack gap-8">
              <Btn icon={<Orbit size={14} />} onClick={() => onNavigate('#/lab')}>
                Open the workbench
              </Btn>
              <Btn icon={<Gamepad2 size={14} />} onClick={() => onNavigate('#/challenges')}>
                Solve a circuit challenge
              </Btn>
              <Btn icon={<BookOpen size={14} />} onClick={() => onOpenTopic(continueTopics[0]?.id ?? TOPICS[0].id)}>
                Resume a Virtual Lab
              </Btn>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
