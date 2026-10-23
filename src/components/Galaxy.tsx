/**
 * Quantum Galaxy — the knowledge map.
 *
 * Every topic is a star, grouped into a domain cluster along three spiral arms.
 * Prerequisite edges are drawn as faint filaments. Mastery changes a star's
 * colour and size, so the map is a progress visualisation, not just navigation.
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Lock, Map as MapIcon, Sparkles, Compass, Search } from 'lucide-react'
import { DOMAINS, TOPICS, TOPIC_BY_ID, type Topic } from '../content/topics.generated'
import { MASTERED_THRESHOLD, decayedMastery, recommendTopics } from '../lib/mastery'
import { useAppStore } from '../store/useAppStore'
import { Btn, Chip, Panel, Pill, Empty } from './ui'

type Vec3 = [number, number, number]

const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  }
  return (h >>> 0) / 4294967296
}

const DOMAIN_SLUGS = new Set(DOMAINS.map((d) => d.slug))

/** Deterministic 3-arm spiral layout with a small cluster per domain. */
function buildLayout(): Record<string, Vec3> {
  const centers = new Map<string, Vec3>()
  DOMAINS.forEach((domain, i) => {
    const arm = i % 3
    const ring = Math.floor(i / 3)
    const angle = (arm / 3) * Math.PI * 2 + ring * 0.55 + hash(domain.slug) * 0.4
    const radius = 2.1 + ring * 1.25 + hash(domain.slug) * 0.5
    centers.set(domain.slug, [
      Math.cos(angle) * radius,
      Math.sin(ring * 0.9 + hash(domain.slug) * 2) * 0.75,
      Math.sin(angle) * radius,
    ])
  })

  const layout: Record<string, Vec3> = {}
  const perDomain = new Map<string, number>()
  for (const topic of TOPICS) {
    const center = centers.get(topic.domain) ?? [0, 0, 0]
    const k = perDomain.get(topic.domain) ?? 0
    perDomain.set(topic.domain, k + 1)
    const golden = k * 2.399963
    const r = 0.12 + 0.3 * Math.sqrt(k)
    const jitter = (hash(topic.id) - 0.5) * 0.18
    layout[topic.id] = [
      center[0] + Math.cos(golden) * r + jitter,
      center[1] + Math.sin(golden * 1.7) * r * 0.55,
      center[2] + Math.sin(golden) * r + jitter,
    ]
  }
  return layout
}

const LAYOUT = buildLayout()
const DOMAIN_CENTERS = (() => {
  const map: Record<string, Vec3> = {}
  for (const d of DOMAINS) {
    const pts = d.topics.map((id) => LAYOUT[id]).filter(Boolean)
    if (!pts.length) continue
    map[d.slug] = [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
      pts.reduce((s, p) => s + p[2], 0) / pts.length,
    ]
  }
  return map
})()

const LEVEL_TONE: Record<string, string> = { B: 'green', I: 'cyan', A: 'amber', F: 'pink' }

export function Galaxy({ onOpen }: { onOpen: (topicId: string) => void }) {
  const mastery = useAppStore((s) => s.mastery)
  const recent = useAppStore((s) => s.recent)
  const reduceMotion = useAppStore((s) => s.settings.reduceMotion)
  const [mode, setMode] = useState<'3d' | '2d'>('3d')
  const [filter, setFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState<{ topic: Topic; x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const stateFor = (id: string) => {
    const m = mastery[id]
    return { value: decayedMastery(m, Date.now()), attempted: !!m?.attempts }
  }

  const unlocked = (topic: Topic) =>
    topic.prerequisites.every((id) => {
      const m = mastery[id]
      return !m || decayedMastery(m, Date.now()) >= 0.55
    })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOPICS.filter((t) => {
      if (filter && t.domainName !== filter) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.idea.toLowerCase().includes(q)
    })
  }, [filter, query])

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
        { mastery, recent, minutesAvailable: 25 },
        4,
      ),
    [mastery, recent],
  )

  const mastered = Object.values(mastery).filter((m) => m.pKnown >= MASTERED_THRESHOLD).length
  const started = Object.values(mastery).filter((m) => m.attempts > 0).length

  const handleHover = (topicId: string | null, x?: number, y?: number) => {
    if (!topicId) {
      setHover(null)
      return
    }
    const t = TOPIC_BY_ID[topicId]
    if (!t) return
    const rect = wrapRef.current?.getBoundingClientRect()
    setHover({ topic: t, x: (x ?? 0) - (rect?.left ?? 0), y: (y ?? 0) - (rect?.top ?? 0) })
  }

  return (
    <div className="stack gap-16 fade-in">
      <div className="row gap-12 wrap">
        <div>
          <div className="eyebrow">Knowledge graph</div>
          <h1 className="display" style={{ fontSize: 34, marginTop: 4 }}>
            Quantum Galaxy
          </h1>
          <p className="lead" style={{ marginTop: 6, maxWidth: 640 }}>
            176 topics orbiting 20 domains. Follow the filaments — every edge is a prerequisite. Stars brighten as your
            mastery grows.
          </p>
        </div>
        <div className="grow" />
        <div className="row gap-8 wrap">
          <span className="pill violet">{mastered} mastered</span>
          <span className="pill cyan">{started} started</span>
          <span className="pill">{TOPICS.length} topics</span>
          <div className="seg">
            <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>
              3D
            </button>
            <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>
              2D
            </button>
          </div>
        </div>
      </div>

      <div className="row gap-8 wrap">
        <div className="row gap-6" style={{ minWidth: 230, flex: '0 1 300px' }}>
          <Search size={14} color="var(--dim)" />
          <input
            className="chat-input"
            style={{ minHeight: 32, padding: '6px 10px' }}
            placeholder="Search a topic or id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Chip on={filter === null} onClick={() => setFilter(null)}>
          All domains
        </Chip>
        {DOMAINS.slice(0, 13).map((d) => (
          <Chip key={d.slug} on={filter === d.name} onClick={() => setFilter(filter === d.name ? null : d.name)}>
            {d.name}
          </Chip>
        ))}
      </div>

      <div className="split wide-left">
        <div className="galaxy-shell" ref={wrapRef}>
          {mode === '3d' ? (
            <Canvas dpr={[1, 2]} camera={{ position: [0, 6.2, 10.5], fov: 44 }} gl={{ alpha: true, antialias: true }}>
              <color attach="background" args={['#05060f']} />
              <ambientLight intensity={0.8} />
              <GalaxyScene
                mastery={mastery}
                filter={filter}
                visible={new Set(visible.map((t) => t.id))}
                reduceMotion={reduceMotion}
                onHover={handleHover}
                onOpen={onOpen}
              />
              <OrbitControls
                enablePan={false}
                autoRotate={!reduceMotion}
                autoRotateSpeed={0.28}
                minDistance={4}
                maxDistance={22}
                maxPolarAngle={Math.PI * 0.86}
              />
            </Canvas>
          ) : (
            <Galaxy2D mastery={mastery} filter={filter} visible={new Set(visible.map((t) => t.id))} onOpen={onOpen} onHover={handleHover} />
          )}

          <div className="galaxy-hint">{mode === '3d' ? 'drag to orbit · scroll to zoom' : 'click a star to open'}</div>

          <div className="galaxy-legend">
            {DOMAINS.slice(0, 12).map((d, i) => (
              <span key={d.slug} className="pill" style={{ fontSize: 9.5, padding: '2px 7px', pointerEvents: 'auto' }}>
                <i style={{ width: 6, height: 6, borderRadius: 99, background: `hsl(${(i * 47) % 360} 70% 65%)`, display: 'inline-block' }} />
                {d.name}
              </span>
            ))}
          </div>

          {hover && (
            <div
              className="panel"
              style={{
                position: 'absolute',
                left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth ?? 600) - 260),
                top: Math.max(10, hover.y - 10),
                width: 240,
                padding: 12,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div className="row gap-6">
                <Pill tone={LEVEL_TONE[hover.topic.level] as 'green'}>{hover.topic.levelName}</Pill>
                <span className="tiny dim mono">{hover.topic.id}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{hover.topic.title}</div>
              <div className="tiny muted" style={{ marginTop: 3, lineHeight: 1.45 }}>
                {hover.topic.idea}
              </div>
              <div className="row gap-6" style={{ marginTop: 8 }}>
                <span className="pill">{hover.topic.domainName}</span>
                <span className="pill">{hover.topic.estimatedMinutes} min</span>
                {!unlocked(hover.topic) && (
                  <span className="pill amber">
                    <Lock size={9} /> locked
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="stack gap-14">
          <Panel title="Recommended next" sub="Ranked by prerequisite readiness and mastery gap" tight>
            <div className="stack gap-8">
              {recommendations.map((rec) => (
                <button
                  key={rec.topic.id}
                  className="topic-card"
                  style={{ padding: 12 }}
                  onClick={() => onOpen(rec.topic.id)}
                >
                  <div className="row gap-6">
                    <Pill tone={LEVEL_TONE[rec.topic.level] as 'green'}>{rec.topic.level}</Pill>
                    <span className="tiny dim mono">{rec.topic.id}</span>
                    <span className="grow" />
                    {!rec.unlocked && <Lock size={11} color="var(--dim)" />}
                  </div>
                  <h3>{rec.topic.title}</h3>
                  <p>{rec.reason}</p>
                  <div className="foot">
                    <span className="tiny dim">{rec.topic.estimatedMinutes} min</span>
                    <span className="tiny mono" style={{ color: rec.mastery > 0.5 ? 'var(--green)' : 'var(--dim)' }}>
                      {(rec.mastery * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
              ))}
              {recommendations.length === 0 && <Empty icon={<Compass size={16} />} title="All caught up" hint="Every unlocked topic is mastered. Try a frontier topic." />}
            </div>
          </Panel>

          <Panel title="Domains" sub={`${DOMAINS.length} clusters`} tight>
            <div className="row gap-6 wrap">
              {DOMAINS.map((d) => {
                const startedHere = d.topics.filter((id) => mastery[id]?.attempts).length
                return (
                  <button
                    key={d.slug}
                    className={`chip ${filter === d.name ? 'on' : ''}`}
                    onClick={() => setFilter(filter === d.name ? null : d.name)}
                    style={{ fontSize: 11 }}
                  >
                    {d.name}
                    <span className="dim mono" style={{ fontSize: 9.5 }}>
                      {startedHere}/{d.topics.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel title="Visible stars" tight>
            <div className="row gap-8">
              <Sparkles size={14} color="var(--violet)" />
              <span className="small muted">
                {visible.length} of {TOPICS.length} topics shown
              </span>
            </div>
            <div className="card-grid scroll-thin" style={{ gridTemplateColumns: '1fr', marginTop: 10, maxHeight: 300, overflowY: 'auto' }}>
              {visible.slice(0, 40).map((t) => {
                const s = stateFor(t.id)
                return (
                  <button key={t.id} className="row gap-8" style={{ background: 'none', border: 0, textAlign: 'left', padding: '4px 0', color: 'inherit' }} onClick={() => onOpen(t.id)}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        flex: 'none',
                        background: s.value >= MASTERED_THRESHOLD ? 'var(--green)' : s.attempted ? 'var(--violet)' : 'rgba(255,255,255,.2)',
                        boxShadow: s.value >= MASTERED_THRESHOLD ? '0 0 8px var(--green)' : undefined,
                      }}
                    />
                    <span className="small grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                    <span className="tiny dim mono">{t.id}</span>
                  </button>
                )
              })}
              {visible.length > 40 && <div className="tiny dim">… {visible.length - 40} more. Narrow the filter or search.</div>}
            </div>
          </Panel>
        </div>
      </div>

      <div className="row gap-10 wrap tiny dim">
        <span className="row gap-6"><i style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--green)', display: 'inline-block' }} /> mastered</span>
        <span className="row gap-6"><i style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--violet)', display: 'inline-block' }} /> in progress</span>
        <span className="row gap-6"><i style={{ width: 8, height: 8, borderRadius: 99, background: 'rgba(255,255,255,.22)', display: 'inline-block' }} /> untouched</span>
        <span className="row gap-6"><Lock size={11} /> prerequisites not met</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3D scene
// ---------------------------------------------------------------------------

function GalaxyScene({
  mastery,
  filter,
  visible,
  reduceMotion,
  onHover,
  onOpen,
}: {
  mastery: Record<string, { pKnown: number; attempts: number }>
  filter: string | null
  visible: Set<string>
  reduceMotion: boolean
  onHover: (id: string | null, x?: number, y?: number) => void
  onOpen: (id: string) => void
}) {
  const edges = useMemo(() => {
    const arr: number[] = []
    for (const t of TOPICS) {
      if (!visible.has(t.id)) continue
      for (const p of t.prerequisites) {
        const a = LAYOUT[t.id]
        const b = LAYOUT[p]
        if (a && b) arr.push(...a, ...b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return g
  }, [visible])

  const stars = useMemo(() => {
    const arr = new Float32Array(700 * 3)
    for (let i = 0; i < 700; i++) {
      const r = 14 + hash(`star${i}`) * 22
      const th = hash(`th${i}`) * Math.PI * 2
      const ph = Math.acos(2 * hash(`ph${i}`) - 1)
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = r * Math.cos(ph) * 0.6
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [])

  return (
    <group>
      <points geometry={stars}>
        <pointsMaterial color="#8fa6ff" size={0.045} transparent opacity={0.55} sizeAttenuation />
      </points>

      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#8b6cff" transparent opacity={filter ? 0.2 : 0.13} />
      </lineSegments>

      {/* galactic core */}
      <mesh>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color="#b9a6ff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshBasicMaterial color="#6b47ff" transparent opacity={0.14} />
      </mesh>

      {DOMAINS.map((domain, i) => {
        const c = DOMAIN_CENTERS[domain.slug]
        if (!c) return null
        const active = !filter || filter === domain.name
        return (
          <group key={domain.slug} position={c}>
            <mesh rotation={[0, i, 0]}>
              <icosahedronGeometry args={[0.11, 0]} />
              <meshBasicMaterial color={`hsl(${(i * 47) % 360} 72% 66%)`} transparent opacity={active ? 0.9 : 0.18} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.26, 16, 16]} />
              <meshBasicMaterial color={`hsl(${(i * 47) % 360} 72% 66%)`} transparent opacity={active ? 0.08 : 0.02} />
            </mesh>
          </group>
        )
      })}

      {TOPICS.filter((t) => visible.has(t.id)).map((topic) => {
        const pos = LAYOUT[topic.id]
        if (!pos) return null
        const state = mastery[topic.id]
        const m = decayedMastery(state as never, Date.now())
        const attempted = !!state?.attempts
        const mastered = m >= MASTERED_THRESHOLD
        const color = mastered ? '#5ee2a8' : attempted ? '#9b7cff' : '#4c5677'
        const radius = 0.035 + m * 0.075
        const dimmed = filter !== null && filter !== topic.domainName
        return (
          <group key={topic.id} position={pos}>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                onHover(topic.id, e.nativeEvent.clientX, e.nativeEvent.clientY)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                onHover(null)
                document.body.style.cursor = ''
              }}
              onClick={(e) => {
                e.stopPropagation()
                onOpen(topic.id)
              }}
            >
              <sphereGeometry args={[radius, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.18 : 1} />
            </mesh>
            {!dimmed && (mastered || attempted) && (
              <mesh>
                <sphereGeometry args={[radius * 2.4, 10, 10]} />
                <meshBasicMaterial color={color} transparent opacity={mastered ? 0.14 : 0.08} />
              </mesh>
            )}
          </group>
        )
      })}

      <Line points={[[0, 0, 0], [0, 0, 0]]} color="#fff" lineWidth={0} />
      {!reduceMotion && null}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 2D fallback / overview
// ---------------------------------------------------------------------------

function Galaxy2D({
  mastery,
  filter,
  visible,
  onOpen,
  onHover,
}: {
  mastery: Record<string, { pKnown: number; attempts: number }>
  filter: string | null
  visible: Set<string>
  onOpen: (id: string) => void
  onHover: (id: string | null, x?: number, y?: number) => void
}) {
  const W = 900
  const H = 620
  const project = (p: Vec3): [number, number] => [W / 2 + p[0] * 72, H / 2 + p[2] * 58 - p[1] * 30]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="galaxy2d" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="core" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#b9a6ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6b47ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#05060f" />
      <circle cx={W / 2} cy={H / 2} r={160} fill="url(#core)" opacity={0.35} />

      {TOPICS.filter((t) => visible.has(t.id)).flatMap((t) =>
        t.prerequisites
          .filter((p) => visible.has(p))
          .map((p) => {
            const [x1, y1] = project(LAYOUT[t.id])
            const [x2, y2] = project(LAYOUT[p])
            return <line key={`${t.id}-${p}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8b6cff" strokeWidth={0.6} opacity={0.16} />
          }),
      )}

      {DOMAINS.map((d, i) => {
        const c = DOMAIN_CENTERS[d.slug]
        if (!c) return null
        const [x, y] = project(c)
        return (
          <g key={d.slug}>
            <circle cx={x} cy={y} r={9} fill={`hsl(${(i * 47) % 360} 72% 66%)`} opacity={filter && filter !== d.name ? 0.2 : 0.55} />
            <text x={x} y={y - 14} textAnchor="middle" className="galaxy-node-label" opacity={filter && filter !== d.name ? 0.15 : 0.85}>
              {d.name}
            </text>
          </g>
        )
      })}

      {TOPICS.filter((t) => visible.has(t.id)).map((t) => {
        const [x, y] = project(LAYOUT[t.id])
        const state = mastery[t.id]
        const m = decayedMastery(state as never, Date.now())
        const attempted = !!state?.attempts
        const mastered = m >= MASTERED_THRESHOLD
        const color = mastered ? '#5ee2a8' : attempted ? '#9b7cff' : '#535d7d'
        const dimmed = filter !== null && filter !== t.domainName
        return (
          <circle
            key={t.id}
            cx={x}
            cy={y}
            r={2.6 + m * 4}
            fill={color}
            opacity={dimmed ? 0.18 : 0.95}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => onHover(t.id, e.clientX, e.clientY)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onOpen(t.id)}
          />
        )
      })}
    </svg>
  )
}
