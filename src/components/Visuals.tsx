/**
 * State visualisers: amplitude bars, measurement histogram, the 3D Q-sphere and
 * a Bloch sphere. All of them read directly from a SimResult, so they can never
 * drift out of sync with the circuit that produced them.
 */
import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { bitString, ketLabel } from '../lib/quantum/circuit'
import { cabs, cphase } from '../lib/quantum/core'
import type { SimResult } from '../lib/quantum/simulator'
import { Tabs, Empty } from './ui'
import { Boxes } from 'lucide-react'

type View = 'amps' | 'probs' | 'sphere' | 'bloch'

export function StatePanel({ sim }: { sim: SimResult | null }) {
  const [view, setView] = useState<View>('amps')
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const single = (sim?.numQubits ?? 0) === 1

  if (!sim) {
    return <Empty icon={<Boxes size={18} />} title="No state yet" hint="Place a gate to see the statevector come alive." />
  }

  // Null means "live": the fully simulated circuit. A number pins one snapshot
  // from the first trajectory, clamped in case the circuit got shorter.
  const active = stepIndex === null || sim.steps.length === 0 ? null : Math.min(stepIndex, sim.steps.length - 1)
  const snapshot = active === null ? null : sim.steps[active]
  const shown: SimResult = snapshot ? { ...sim, state: snapshot.state, probabilities: snapshot.probabilities } : sim

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'amps', label: 'Amplitudes' },
    { id: 'probs', label: 'Probabilities' },
    { id: 'sphere', label: 'Q-sphere' },
    ...(single ? [{ id: 'bloch' as View, label: 'Bloch' }] : []),
  ]

  return (
    <div className="stack gap-12">
      <div className="row gap-8 wrap">
        <Tabs tabs={tabs} value={view} onChange={setView} />
        <div className="grow" />
        <span className="pill mono">{sim.numQubits} qubit{sim.numQubits > 1 ? 's' : ''}</span>
        {active === null ? (
          <span className="pill mono" title="Tr(ρ²) — 1 means a pure state">
            purity {sim.purity.toFixed(3)}
          </span>
        ) : (
          <span className="pill mono" title="Showing the state after this gate, not the final result">
            gate {active + 1}/{sim.steps.length}
          </span>
        )}
      </div>

      {sim.steps.length > 0 && (
        <div className="stack gap-6">
          <div className="row gap-8">
            <input
              type="range"
              min={1}
              max={sim.steps.length}
              step={1}
              value={active === null ? sim.steps.length : active + 1}
              onChange={(e) => setStepIndex(Number(e.target.value) - 1)}
              aria-label="Show the state after a gate"
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div className="row gap-6 wrap">
            <span className="tiny dim">
              {active === null ? 'final state · drag to replay gate by gate' : `after ${snapshot?.label ?? 'gate'}`}
            </span>
            <span className="grow" />
            {active !== null && (
              <button className="chip" type="button" onClick={() => setStepIndex(null)}>
                Back to final
              </button>
            )}
          </div>
        </div>
      )}

      {view === 'amps' && <AmplitudeBars sim={shown} />}
      {view === 'probs' && <ProbabilityBars sim={shown} />}
      {view === 'sphere' && <QSphere sim={shown} />}
      {view === 'bloch' && <BlochSphere sim={shown} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2D amplitude / probability bars
// ---------------------------------------------------------------------------

function phaseColor(phase: number): string {
  const t = (phase + Math.PI) / (2 * Math.PI)
  return `hsl(${Math.round(t * 360)} 82% 66%)`
}

function AmplitudeBars({ sim }: { sim: SimResult }) {
  const rows = sim.state
    .map((amp, i) => ({ i, amp, mag: cabs(amp), phase: cphase(amp), p: sim.probabilities[i] ?? 0 }))
    .filter((r) => r.mag > 1e-4)
    .slice(0, 32)

  const max = Math.max(1e-6, ...rows.map((r) => r.mag))

  return (
    <div className="stack gap-10">
      <div className="bars" style={{ height: 190 }}>
        {rows.map((r) => (
          <div className="bar-col" key={r.i} title={`${ketLabel(r.i, sim.numQubits)}  |amp|=${r.mag.toFixed(3)}  phase=${((r.phase * 180) / Math.PI).toFixed(0)}°`}>
            <div className="pct">{r.mag.toFixed(2)}</div>
            <div
              className="fill"
              style={{
                height: `${Math.max(2, (r.mag / max) * 100)}%`,
                background: `linear-gradient(180deg, ${phaseColor(r.phase)}, ${phaseColor(r.phase)}33)`,
                boxShadow: `0 0 18px -6px ${phaseColor(r.phase)}`,
              }}
            />
            <div className="ket">{ketLabel(r.i, sim.numQubits)}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="dim small">No amplitude above 1e-4.</div>}
      </div>
      <div className="row gap-10 wrap tiny dim">
        <span>Bar height = |amplitude| · colour = phase (hue 0→360° = −π→π)</span>
        {rows.length < sim.state.length && <span>· showing the {rows.length} largest of {sim.state.length} basis states</span>}
      </div>
    </div>
  )
}

function ProbabilityBars({ sim }: { sim: SimResult }) {
  const rows = sim.probabilities
    .map((p, i) => ({ i, p }))
    .filter((r) => r.p > 1e-5)
    .sort((a, b) => b.p - a.p)
    .slice(0, 12)
  const max = Math.max(1e-6, ...rows.map((r) => r.p))

  return (
    <div className="stack gap-12">
      <div className="bars" style={{ height: 180 }}>
        {rows.map((r) => (
          <div className="bar-col" key={r.i} title={`P(${ketLabel(r.i, sim.numQubits)}) = ${(r.p * 100).toFixed(2)}%`}>
            <div className="pct">{(r.p * 100).toFixed(0)}%</div>
            <div className={`fill ${r.p === max ? 'hot' : ''}`} style={{ height: `${Math.max(2, (r.p / max) * 100)}%` }} />
            <div className="ket">{ketLabel(r.i, sim.numQubits)}</div>
          </div>
        ))}
      </div>
      <div className="tiny dim">Born rule: P = |amplitude|². Bars above 1e-5 only.</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Histogram of sampled shots
// ---------------------------------------------------------------------------

export function Histogram({ sim, expected }: { sim: SimResult | null; expected?: number[] }) {
  if (!sim) return <Empty title="Nothing measured yet" hint="Run the circuit to collect shot counts." />
  const entries = Object.entries(sim.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1
  const max = Math.max(1, ...entries.map(([, n]) => n))

  return (
    <div className="stack gap-10">
      <div className="histo">
        {entries.map(([key, n]) => {
          // Counts are little-endian display strings (q0 leftmost); reverse them
          // before treating the result as an integer basis index.
          const index = parseInt([...key].reverse().join(''), 2)
          const exp = expected?.[index]
          const share = n / total
          return (
            <div className="histo-row" key={key}>
              <span className="ket">|{key}⟩</span>
              <div className="track">
                <i style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="n">{(share * 100).toFixed(1)}%</span>
              {exp !== undefined && Math.abs(share - exp) > 0.06 ? (
                <span className="tiny dim" title={`Ideal probability ${(exp * 100).toFixed(1)}%`}>
                  ≠{(exp * 100).toFixed(0)}%
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="row gap-10 tiny dim wrap">
        <span>{sim.shots.toLocaleString()} shots</span>
        <span>·</span>
        <span>{entries.length} distinct outcome{entries.length === 1 ? '' : 's'}</span>
        {sim.noisy && <span className="pill amber">noisy run</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3D Q-sphere
// ---------------------------------------------------------------------------

interface Node {
  index: number
  p: number
  phase: number
  pos: [number, number, number]
  color: string
  radius: number
}

function qSphereNodes(sim: SimResult): Node[] {
  return sim.state
    .map((amp, index) => {
      const p = sim.probabilities[index] ?? 0
      const phase = cphase(amp)
      // Amplitude latitude: p = 1 sits at the north pole, p = 0 at the south.
      const theta = 2 * Math.acos(Math.min(1, Math.sqrt(Math.max(0, p))))
      const r = Math.sin(theta)
      const pos: [number, number, number] = [r * Math.cos(phase), Math.cos(theta), r * Math.sin(phase)]
      return {
        index,
        p,
        phase,
        pos,
        color: phaseColor(phase),
        radius: 0.022 + 0.075 * Math.pow(p, 0.42),
      }
    })
    .filter((n) => n.p > 1e-4)
    .sort((a, b) => b.p - a.p)
}

function QSphere({ sim }: { sim: SimResult }) {
  const nodes = useMemo(() => qSphereNodes(sim), [sim])
  const [auto, setAuto] = useState(true)

  return (
    <div className="stack gap-8">
      <div className="qsphere-wrap">
        <Canvas dpr={[1, 2]} camera={{ position: [2.3, 1.7, 2.3], fov: 46 }} gl={{ alpha: true, antialias: true }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.9} />
            <SphereScene nodes={nodes} auto={auto} />
            <OrbitControls enablePan={false} minDistance={2.2} maxDistance={6} autoRotate={auto} autoRotateSpeed={0.55} />
          </Suspense>
        </Canvas>
        <div style={{ position: 'absolute', left: 12, bottom: 10 }} className="tiny dim">
          |{bitString(0, sim.numQubits)}⟩ ↑ north
        </div>
        <button
          className="chip"
          style={{ position: 'absolute', right: 10, bottom: 10 }}
          onClick={() => setAuto((v) => !v)}
          type="button"
        >
          {auto ? 'Pause spin' : 'Spin'}
        </button>
      </div>
      <div className="row gap-8 wrap">
        {nodes.slice(0, 6).map((nd) => (
          <span key={nd.index} className="pill" title={`phase ${((nd.phase * 180) / Math.PI).toFixed(0)}°`}>
            <i style={{ width: 7, height: 7, borderRadius: 99, background: nd.color, display: 'inline-block' }} />
            <span className="mono">{ketLabel(nd.index, sim.numQubits)}</span>
            <span className="dim">{(nd.p * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function SphereScene({ nodes, auto }: { nodes: Node[]; auto: boolean }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#6b47ff" wireframe transparent opacity={0.14} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.0028, 6, 96]} />
        <meshBasicMaterial color="#62e0f2" transparent opacity={0.4} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
          <torusGeometry args={[1, 0.0022, 6, 96]} />
          <meshBasicMaterial color="#9b7cff" transparent opacity={0.2} />
        </mesh>
      ))}

      {nodes.map((nd) => (
        <group key={nd.index}>
          <Line
            points={[
              [0, 0, 0],
              nd.pos,
            ]}
            color={nd.color}
            lineWidth={1}
            transparent
            opacity={Math.min(0.55, 0.14 + nd.p)}
          />
          <mesh position={nd.pos}>
            <sphereGeometry args={[nd.radius, 14, 14]} />
            <meshBasicMaterial color={nd.color} />
          </mesh>
          {/* soft halo */}
          <mesh position={nd.pos}>
            <sphereGeometry args={[nd.radius * 2.1, 12, 12]} />
            <meshBasicMaterial color={nd.color} transparent opacity={0.14} />
          </mesh>
        </group>
      ))}

      <mesh>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshBasicMaterial color="#e9e4ff" />
      </mesh>
      <gridHelper args={[3.2, 8, '#241c4a', '#160f33']} position={[0, -1.25, 0]} rotation={[0, 0, 0]} />
      <Stars3D auto={auto} />
    </group>
  )
}

function Stars3D({ auto }: { auto: boolean }) {
  const points = useMemo(() => {
    const arr = new Float32Array(180 * 3)
    for (let i = 0; i < 180; i++) {
      const r = 5 + Math.random() * 6
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th)
      arr[i * 3 + 1] = r * Math.cos(ph)
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    return arr
  }, [])
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(points, 3))
    return g
  }, [points])
  return <points geometry={geom} rotation={[0, auto ? 0 : 0.4, 0]}>
    <pointsMaterial color="#9fb4ff" size={0.03} transparent opacity={0.6} sizeAttenuation />
  </points>
}

// ---------------------------------------------------------------------------
// Bloch sphere (single qubit)
// ---------------------------------------------------------------------------

function blochVector(sim: SimResult): [number, number, number] {
  const a = sim.state[0] ?? { re: 1, im: 0 }
  const b = sim.state[1] ?? { re: 0, im: 0 }
  // r = (2 Re(a b*), 2 Im(a b*), |a|² − |b|²)
  const x = 2 * (a.re * b.re + a.im * b.im)
  const y = 2 * (a.im * b.re - a.re * b.im)
  const z = a.re * a.re + a.im * a.im - (b.re * b.re + b.im * b.im)
  return [x, z, -y]
}

function BlochSphere({ sim }: { sim: SimResult }) {
  const v = useMemo(() => blochVector(sim), [sim])
  const [x, y, z] = v
  const len = Math.hypot(x, y, z)
  const theta = (Math.acos(Math.max(-1, Math.min(1, y / (len || 1)))) * 180) / Math.PI
  const phi = ((Math.atan2(z, x) * 180) / Math.PI + 360) % 360

  return (
    <div className="stack gap-10">
      <div className="qsphere-wrap">
        <Canvas dpr={[1, 2]} camera={{ position: [2.1, 1.5, 2.4], fov: 46 }} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={1} />
          <group>
            <mesh>
              <sphereGeometry args={[1, 28, 20]} />
              <meshBasicMaterial color="#6b47ff" wireframe transparent opacity={0.15} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1, 0.003, 6, 96]} />
              <meshBasicMaterial color="#62e0f2" transparent opacity={0.45} />
            </mesh>
            <Line points={[[-1.15, 0, 0], [1.15, 0, 0]]} color="#ff7aa8" lineWidth={1} transparent opacity={0.5} />
            <Line points={[[0, -1.15, 0], [0, 1.15, 0]]} color="#5ee2a8" lineWidth={1} transparent opacity={0.5} />
            <Line points={[[0, 0, -1.15], [0, 0, 1.15]]} color="#62e0f2" lineWidth={1} transparent opacity={0.5} />

            {len > 0.02 && (
              <>
                <Line points={[[0, 0, 0], [x, y, z]]} color="#ffffff" lineWidth={2.4} />
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.045, 16, 16]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[x, y, z]}>
                  <sphereGeometry args={[0.1, 12, 12]} />
                  <meshBasicMaterial color="#9b7cff" transparent opacity={0.25} />
                </mesh>
              </>
            )}
            <mesh>
              <sphereGeometry args={[0.02, 10, 10]} />
              <meshBasicMaterial color="#e9e4ff" />
            </mesh>
            <OrbitControls enablePan={false} minDistance={2} maxDistance={5} autoRotate autoRotateSpeed={0.4} />
          </group>
        </Canvas>
        <div style={{ position: 'absolute', left: 12, bottom: 10 }} className="tiny dim">
          |0⟩ north · |1⟩ south
        </div>
      </div>
      <div className="row gap-8 wrap">
        <span className="pill mono">x {x.toFixed(3)}</span>
        <span className="pill mono">y {y.toFixed(3)}</span>
        <span className="pill mono">z {z.toFixed(3)}</span>
        <span className="pill violet mono">θ {theta.toFixed(0)}°</span>
        <span className="pill cyan mono">φ {phi.toFixed(0)}°</span>
        <span className="pill">|r| {len.toFixed(3)}</span>
      </div>
      {len < 0.999 && (
        <div className="tiny dim">Vector length &lt; 1 → the qubit is mixed (entangled or noisy).</div>
      )}
    </div>
  )
}
