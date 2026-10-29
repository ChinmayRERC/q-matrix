/**
 * Quantum Hardware Department.
 *
 * A hardware-first page: an animated atom, a scroll-linked cutaway of two real
 * machine architectures, a platform comparison, and a filterable catalogue of
 * the instruments and vendors that make up a quantum lab.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Atom,
  Boxes,
  CircuitBoard,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gauge,
  Layers,
  Microscope,
  Move3d,
  Radar,
  Search,
  Snowflake,
  Sparkles,
  Thermometer,
  Waves,
  X,
  Zap,
} from 'lucide-react'
import {
  CATEGORIES,
  HARDWARE,
  categoryCounts,
  filterHardware,
  type HardwareCategory,
} from '../lib/hardware/catalogue'
import {
  AtomMachine,
  FridgeMachine,
  IonMachine,
  MACHINES,
  NvMachine,
  PhotonicMachine,
  SiliconMachine,
} from './HardwareDiagrams'

type Phase = 'ground' | 'rydberg' | 'measured'

const CATEGORY_ICON: Record<HardwareCategory, ReactNode> = {
  machine: <Boxes size={14} />,
  control: <CircuitBoard size={14} />,
  cryo: <Snowflake size={14} />,
  optics: <Zap size={14} />,
  sensor: <Radar size={14} />,
  actuator: <Move3d size={14} />,
}

const PLATFORMS = [
  {
    id: 'super',
    name: 'Superconducting circuits',
    icon: <Cpu size={18} />,
    qubit: 'Transmon / flux',
    temp: '≈10 mK',
    gate: '20–60 ns',
    readout: '100 ns–1 µs',
    strength: 'Fast gates, mature fabrication, dense chips',
    limit: 'Millikelvin cooling, fixed wiring, short coherence',
    accent: 'violet',
  },
  {
    id: 'ion',
    name: 'Trapped ions',
    icon: <Atom size={18} />,
    qubit: 'Atomic hyperfine levels',
    temp: '≈µK (room-temp trap)',
    gate: '10–200 µs',
    readout: '100 µs–1 ms',
    strength: 'Identical qubits, all-to-all connectivity, long coherence',
    limit: 'Slow gates, shuttling overhead, complex optics',
    accent: 'cyan',
  },
  {
    id: 'neutral',
    name: 'Neutral atoms',
    icon: <Sparkles size={18} />,
    qubit: 'Atomic ground / Rydberg',
    temp: '≈µK',
    gate: '0.5–2 µs',
    readout: '10–100 ms',
    strength: 'Hundreds of identical qubits, movable traps, reconfigurable',
    limit: 'Slow destructive readout, atom loss, laser complexity',
    accent: 'green',
  },
  {
    id: 'nv',
    name: 'Diamond NV centres',
    icon: <Gauge size={18} />,
    qubit: 'Electron / nuclear spin',
    temp: 'Room temperature',
    gate: 'ns–µs',
    readout: 'Optical spin readout',
    strength: 'No cryostat, nanoscale sensing, robust solid state',
    limit: 'Short range, fabrication variance, harder to scale',
    accent: 'pink',
  },
  {
    id: 'photonic',
    name: 'Photonic',
    icon: <Waves size={18} />,
    qubit: 'Single photon / squeezed mode',
    temp: 'Chip at room temperature',
    gate: 'ps–ns',
    readout: 'SNSPD at ≈1 K',
    strength: 'Fab-compatible chips, low loss, room-temperature logic',
    limit: 'Photon loss, no storage, detector overhead',
    accent: 'amber',
  },
  {
    id: 'silicon',
    name: 'Silicon spin qubits',
    icon: <CircuitBoard size={18} />,
    qubit: 'Electron spin in a quantum dot',
    temp: '≈100 mK',
    gate: 'ns–µs',
    readout: 'Charge sensing',
    strength: 'CMOS-compatible, tiny footprint, long coherence in ²⁸Si',
    limit: 'Charge noise, material disorder, wafer yield',
    accent: 'lime',
  },
]

const FUTURE = [
  {
    tag: 'Interconnect',
    title: 'Many small machines, one computer',
    body: 'Instead of one enormous fridge, photonic links join modules of a few hundred qubits. The hard part stops being the chip and becomes the link: photon loss, conversion efficiency and synchronisation.',
    icon: <Layers size={16} />,
  },
  {
    tag: 'Control',
    title: 'The rack moves into the fridge',
    body: 'Cryo-CMOS and superconducting logic put pulse generation next to the qubit. That removes hundreds of coax lines and turns wiring, not qubit count, back into a solvable engineering problem.',
    icon: <CircuitBoard size={16} />,
  },
  {
    tag: 'Error correction',
    title: 'Logical qubits that outlive their parts',
    body: 'Surface-code experiments already show logical error falling as the code grows. The next machine is judged by logical qubits and logical gate error, not by the number of physical qubits on the die.',
    icon: <Gauge size={16} />,
  },
  {
    tag: 'Optics',
    title: 'The optical table becomes a chip',
    body: 'Silicon-nitride and lithium-niobate photonics integrate modulators, splitters and detectors. A metre of free-space optics collapses into a packaged module with the same physics.',
    icon: <Waves size={16} />,
  },
  {
    tag: 'Sensing',
    title: 'Quantum hardware leaves the lab',
    body: 'Cold-atom gravimeters, OPM helmets and chip-scale clocks are already shipping. Sensing is where quantum hardware earns money before fault tolerance arrives.',
    icon: <Radar size={16} />,
  },
  {
    tag: 'Materials',
    title: 'Better junctions, fewer defects',
    body: 'Two-level systems in oxides and interfaces limit superconducting coherence. New fabrication, shielding and packaging can double coherence without changing the circuit at all.',
    icon: <FlaskConical size={16} />,
  },
]

const REFERENCE = [
  {
    tag: 'vacuum',
    name: '2D+ MOT glass cell',
    body: 'Potassium and sodium clouds are cooled in a glass cell that lets six laser beams in and fluorescence out.',
  },
  {
    tag: 'source',
    name: 'K and Na ovens',
    body: 'Alkali-metal ovens set the atom flux into the chamber; a differential pumping tube keeps the source gas away from the science cell.',
  },
  {
    tag: 'vacuum',
    name: '20 / 40 / 75 L s⁻¹ ion pumps',
    body: 'Three pump sizes hold ultra-high vacuum at different points in the chain, with no vibration in the science region.',
  },
  {
    tag: 'atoms',
    name: 'Magnetic transport coils',
    body: 'A moving magnetic trap carries the cold cloud from the MOT chamber to the science chamber instead of releasing it.',
  },
  {
    tag: 'optics',
    name: '780 nm and 1013 nm tweezers',
    body: 'One wavelength cools and images rubidium; the other traps it in optical tweezers with low heating.',
  },
  {
    tag: 'optics',
    name: 'Acousto-optic deflector',
    body: 'Steers and multiplexes the tweezer beams, so one laser can address many trap sites in microseconds.',
  },
  {
    tag: 'readout',
    name: '50× objective + sCMOS camera',
    body: 'Collects single-site fluorescence from the array and images it fast enough to verify loading shot by shot.',
  },
  {
    tag: 'control',
    name: 'PXI / FPGA control',
    body: 'Sequences lasers, coils, shutters and camera triggers, then feeds the image back into the next experimental cycle.',
  },
  {
    tag: 'sensor',
    name: 'RDSNS spin-noise detector',
    body: 'RRI’s Raman-driven spin-noise spectroscopy reads atomic spin fluctuations in real time without destroying the state.',
  },
  {
    tag: 'cryo',
    name: 'Dilution fridge + qubit chip',
    body: 'The superconducting branch of the same department: a 10 mK cryostat, cryogenic wiring and a transmon chip.',
  },
]


function AtomLab() {
  const [phase, setPhase] = useState<Phase>('ground')
  const excited = phase === 'rydberg'

  const state =
    phase === 'ground'
      ? { label: '|g⟩', detail: '5S₁/₂ ground state', p: 'P(r) = 0.000' }
      : phase === 'rydberg'
        ? { label: '|r⟩', detail: 'n = 70 Rydberg state', p: 'P(r) = 1.000' }
        : { label: '|0⟩ or |1⟩', detail: 'state collapsed by readout', p: 'P(r) = 0.000' }

  return (
    <div className={`hd-atomlab ${excited ? 'excited' : ''} ${phase === 'measured' ? 'measured' : ''}`}>
      <div className="hd-atomlab-head">
        <span className="eyebrow">Atomic feature · rubidium-87</span>
        <span className={`hd-state-pill ${phase}`}>
          <i />
          {state.label}
        </span>
      </div>

      <svg className="hd-atom-svg" viewBox="0 0 380 300" role="img" aria-label={`Rubidium atom in the ${phase} state`}>
        <defs>
          <radialGradient id="hd-nucleus">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor="#ffc46b" />
            <stop offset="1" stopColor="#ff7aa8" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="hd-rglow">
            <stop offset="0" stopColor="#9b7cff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#9b7cff" stopOpacity="0" />
          </radialGradient>
          <filter id="hd-soft">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <circle cx="190" cy="150" r="120" fill="url(#hd-rglow)" opacity={excited ? 1 : 0.35} />
        {excited && <circle cx="190" cy="150" r="96" className="hd-blockade" />}

        {/* orbits */}
        <g className="hd-orbit o1">
          <ellipse cx="190" cy="150" rx="104" ry="34" />
          <circle className="hd-electron" cx="294" cy="150" r="4.5" />
        </g>
        <g className="hd-orbit o2">
          <ellipse cx="190" cy="150" rx="86" ry="30" />
          <circle className="hd-electron e2" cx="276" cy="150" r="4" />
        </g>
        <g className="hd-orbit o3">
          <ellipse cx="190" cy="150" rx="64" ry="24" />
          <circle className="hd-electron e3" cx="254" cy="150" r="3.6" />
        </g>

        {/* nucleus */}
        <circle cx="190" cy="150" r="26" fill="url(#hd-nucleus)" opacity="0.16" filter="url(#hd-soft)" />
        <circle cx="190" cy="150" r="15" fill="url(#hd-nucleus)" />
        {[
          [184, 144],
          [196, 146],
          [190, 156],
          [183, 154],
          [197, 156],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4.2" fill={i % 2 ? '#ffd9a8' : '#fff'} opacity="0.85" />
        ))}

        {/* Rydberg electron shell */}
        <circle cx="190" cy="150" r="96" className="hd-rydberg-shell" />
        {excited && <circle cx="286" cy="150" r="5" className="hd-rydberg-electron" />}

        {/* measurement flash */}
        <path d="M 110 250 L 190 168" className="hd-measure-beam" />
        <text x="190" y="282" textAnchor="middle" className="hd-atom-caption">
          {excited ? 'Rydberg blockade radius ≈ 8 µm' : phase === 'measured' ? 'fluorescence readout complete' : 'laser cooled to ≈ 10 µK'}
        </text>
      </svg>

      <div className="hd-atom-readout">
        <div>
          <span className="tiny dim">state</span>
          <strong>{state.detail}</strong>
        </div>
        <div className="mono tiny">{state.p}</div>
      </div>

      <div className="hd-atom-actions">
        {phase === 'ground' && (
          <button className="btn primary sm" type="button" onClick={() => setPhase('rydberg')}>
            <Zap size={13} /> Apply π pulse
          </button>
        )}
        {phase === 'rydberg' && (
          <button className="btn cyan sm" type="button" onClick={() => setPhase('measured')}>
            <Microscope size={13} /> Read out
          </button>
        )}
        {phase === 'measured' && (
          <button className="btn sm" type="button" onClick={() => setPhase('ground')}>
            <Atom size={13} /> Reset atom
          </button>
        )}
        <span className="tiny dim">
          {phase === 'ground'
            ? 'A 480 nm pulse excites the outer electron.'
            : phase === 'rydberg'
              ? 'The giant orbit blocks the neighbouring atom.'
              : 'Readout destroys the state; reload and repeat.'}
        </span>
      </div>
    </div>
  )
}

const MACHINE_ICON: Record<string, ReactNode> = {
  atom: <Atom size={14} />,
  super: <Snowflake size={14} />,
  ion: <Sparkles size={14} />,
  photonic: <Waves size={14} />,
  nv: <Gauge size={14} />,
  silicon: <Cpu size={14} />,
}

export function Hardware() {
  const [machineId, setMachineId] = useState('atom')
  const machine = MACHINES.find((m) => m.id === machineId) ?? MACHINES[0]
  const parts = machine.parts
  const [partId, setPartId] = useState(parts[0].id)
  const part = parts.find((p) => p.id === partId) ?? parts[0]
  const stepRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // A click is a deliberate choice: hold it until the reader scrolls again,
  // otherwise the scroll-spy can override it on the next layout change.
  const manual = useRef(false)
  const selectPart = (id: string) => {
    manual.current = true
    setPartId(id)
  }

  const [category, setCategory] = useState<HardwareCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const searchId = useId()
  const counts = useMemo(categoryCounts, [])
  const items = useMemo(() => filterHardware(category, query), [category, query])

  useEffect(() => {
    manual.current = false
    setPartId((MACHINES.find((m) => m.id === machineId) ?? MACHINES[0]).parts[0].id)
  }, [machineId])

  // Scroll the page and the cutaway follows: the step nearest the middle of the
  // viewport becomes the highlighted subsystem.
  useEffect(() => {
    const nodes = Object.values(stepRefs.current).filter((n): n is HTMLButtonElement => Boolean(n))
    if (!nodes.length) return
    const release = () => {
      manual.current = false
    }
    window.addEventListener('scroll', release, { passive: true })
    const seen = new Map<Element, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => seen.set(entry.target, entry.intersectionRatio))
        if (manual.current) return
        const ranked = [...seen.entries()].sort((a, b) => b[1] - a[1])[0]
        const el = ranked?.[0]
        const id = el instanceof HTMLElement ? el.dataset.hdStep : undefined
        if (id && ranked[1] > 0) setPartId(id)
      },
      { rootMargin: '-38% 0px -42% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    nodes.forEach((n) => observer.observe(n))
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', release)
    }
  }, [machineId])

  return (
    <div className="hd fade-in">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-hero">
        <div className="hd-hero-copy">
          <div className="eyebrow">
            <Sparkles size={12} /> Q-matrix · hardware department
          </div>
          <h2 className="display hd-title">
            The machine
            <br />
            behind the circuit.
          </h2>
          <p className="lead hd-hero-lead">
            A qubit is never just a qubit. It is a vacuum chamber, a laser rack, a kilometre of coax, a
            fridge colder than space, and a control system that has to be right to the nanosecond. Open six
            machine architectures, then browse every layer of hardware that makes them real.
          </p>
          <div className="hd-hero-stats">
            <div>
              <strong>{HARDWARE.length}</strong>
              <span>hardware entries</span>
            </div>
            <div>
              <strong>{CATEGORIES.length}</strong>
              <span>subsystems</span>
            </div>
            <div>
              <strong>{MACHINES.length}</strong>
              <span>machine anatomies</span>
            </div>
          </div>
          <div className="row gap-8 wrap hd-hero-actions">
            <button
              className="btn primary"
              type="button"
              onClick={() => document.getElementById('hd-anatomy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <Layers size={14} /> Open the cutaway
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => document.getElementById('hd-catalogue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Browse the catalogue <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <AtomLab />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Anatomy                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-section" id="hd-anatomy">
        <header className="hd-section-head">
          <div>
            <span className="eyebrow">01 · anatomy</span>
            <h2>What is actually inside the box</h2>
            <p>
              Six architectures, six cutaways. Pick a machine, then scroll the subsystem list: each part
              explains what it does, what it is specified at, and what goes wrong when it drifts.
            </p>
          </div>
          <div className="hd-seg" role="tablist" aria-label="Choose a machine architecture">
            {MACHINES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={machineId === m.id}
                className={machineId === m.id ? 'on' : ''}
                onClick={() => setMachineId(m.id)}
              >
                {MACHINE_ICON[m.id]} {m.short}
              </button>
            ))}
          </div>
        </header>

        <div className="hd-anatomy">
          <div className="hd-stage">
            <div className="hd-stage-bar">
              <span className="hd-stage-tag">
                <span className="hd-live" /> live cutaway
              </span>
              <span className="tiny dim">{machine.caption}</span>
              <span className="grow" />
              <span className="pill mono">
                {parts.findIndex((p) => p.id === part.id) + 1}/{parts.length}
              </span>
            </div>

            <div className="hd-diagram">
              {machineId === 'atom' && <AtomMachine part={part.id} onPart={selectPart} />}
              {machineId === 'super' && <FridgeMachine part={part.id} onPart={selectPart} />}
              {machineId === 'ion' && <IonMachine part={part.id} onPart={selectPart} />}
              {machineId === 'photonic' && <PhotonicMachine part={part.id} onPart={selectPart} />}
              {machineId === 'nv' && <NvMachine part={part.id} onPart={selectPart} />}
              {machineId === 'silicon' && <SiliconMachine part={part.id} onPart={selectPart} />}
            </div>

            <div className="hd-readout">
              <div className="hd-readout-top">
                <span className="hd-readout-no">{String(parts.findIndex((p) => p.id === part.id) + 1).padStart(2, '0')}</span>
                <div>
                  <span className="eyebrow">{part.label}</span>
                  <h3>{part.title}</h3>
                </div>
              </div>
              <p>{part.body}</p>
              <div className="hd-spec mono">{part.spec}</div>
              <div className="hd-risk">
                <Thermometer size={13} />
                <span>{part.risk}</span>
              </div>
            </div>
          </div>

          <ol className="hd-steps">
            {parts.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  data-hd-step={p.id}
                  ref={(node) => {
                    stepRefs.current[p.id] = node
                  }}
                  className={`hd-step ${p.id === part.id ? 'on' : ''}`}
                  onClick={() => selectPart(p.id)}
                  aria-pressed={p.id === part.id}
                >
                  <span className="hd-step-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hd-step-body">
                    <strong>{p.label}</strong>
                    <span>{p.title}</span>
                    <span className="hd-step-risk">{p.risk}</span>
                  </span>
                  <ArrowRight size={14} className="hd-step-arrow" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Reference labs                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-section">
        <header className="hd-section-head">
          <div>
            <span className="eyebrow">02 · reference labs</span>
            <h2>The parts in the photographs</h2>
            <p>
              A cold-atom machine is assembled from ordinary-looking plumbing and optics. These are the
              components visible in the RRI QuMiX and rubidium-tweezer setups, and the job each one does.
            </p>
          </div>
        </header>
        <div className="hd-refgrid">
          {REFERENCE.map((r) => (
            <article className="hd-ref" key={r.name}>
              <span className={`pill hd-ref-tag hd-ref-${r.tag}`}>{r.tag}</span>
              <h3>{r.name}</h3>
              <p>{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Platforms                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-section">
        <header className="hd-section-head">
          <div>
            <span className="eyebrow">03 · platforms</span>
            <h2>Six ways to hold a qubit</h2>
            <p>
              The architecture decides the whole lab. A superconducting machine is a fridge problem; a
              neutral-atom machine is a laser and vacuum problem; an ion trap is a shuttling problem.
            </p>
          </div>
        </header>

        <div className="hd-platforms">
          {PLATFORMS.map((p) => (
            <article className={`hd-platform hd-accent-${p.accent}`} key={p.id}>
              <div className="hd-platform-head">
                <span className="hd-platform-icon">{p.icon}</span>
                <h3>{p.name}</h3>
              </div>
              <dl className="hd-specs">
                <div>
                  <dt>qubit</dt>
                  <dd>{p.qubit}</dd>
                </div>
                <div>
                  <dt>temperature</dt>
                  <dd>{p.temp}</dd>
                </div>
                <div>
                  <dt>two-qubit gate</dt>
                  <dd>{p.gate}</dd>
                </div>
                <div>
                  <dt>readout</dt>
                  <dd>{p.readout}</dd>
                </div>
              </dl>
              <p className="hd-platform-why">
                <strong>Why it wins:</strong> {p.strength}
              </p>
              <p className="hd-platform-limit">
                <strong>What it costs:</strong> {p.limit}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Catalogue                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-section" id="hd-catalogue">
        <header className="hd-section-head">
          <div>
            <span className="eyebrow">04 · catalogue</span>
            <h2>The hardware department</h2>
            <p>
              Every layer of a real quantum lab, from a single-photon detector to a five-tonne dilution
              refrigerator. Filter by subsystem or search by vendor, part or job.
            </p>
          </div>
          <span className="pill mono">{items.length} / {HARDWARE.length} shown</span>
        </header>

        <div className="hd-controls">
          <div className="hd-search">
            <Search size={15} />
            <label className="sr-only" htmlFor={searchId}>
              Search hardware
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendor, instrument or job — try “laser”, “SNSPD”, “fridge”"
            />
            {query && (
              <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hd-filters" role="group" aria-label="Filter by hardware category">
            <button
              type="button"
              className={`hd-filter ${category === 'all' ? 'on' : ''}`}
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              <Layers size={13} /> All <span className="mono">{HARDWARE.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`hd-filter hd-accent-${c.accent} ${category === c.id ? 'on' : ''}`}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                title={c.blurb}
              >
                {CATEGORY_ICON[c.id]} {c.short} <span className="mono">{counts[c.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {category !== 'all' && (
          <p className="hd-filter-blurb">{CATEGORIES.find((c) => c.id === category)?.blurb}</p>
        )}

        {items.length === 0 ? (
          <div className="hd-empty">
            <Search size={18} />
            <strong>No hardware matches “{query}”.</strong>
            <span>Try a broader term, or clear the filters.</span>
            <button className="btn sm" type="button" onClick={() => { setQuery(''); setCategory('all') }}>
              Reset filters
            </button>
          </div>
        ) : (
          <div className="hd-catalogue">
            {items.map((item) => {
              const cat = CATEGORIES.find((c) => c.id === item.category)!
              return (
                <a
                  key={item.id}
                  className={`hd-item hd-accent-${cat.accent}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <div className="hd-item-top">
                    <span className="hd-item-cat">
                      {CATEGORY_ICON[item.category]} {cat.short}
                    </span>
                    <ExternalLink size={13} className="hd-item-link" />
                  </div>
                  <h3>{item.name}</h3>
                  <span className="hd-item-maker">{item.maker}</span>
                  <p>{item.what}</p>
                  <p className="hd-item-why">{item.why}</p>
                  <div className="hd-tags">
                    {item.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </a>
              )
            })}
          </div>
        )}

        <p className="hd-fineprint">
          Vendor links resolved October 2026. Listed for discovery, not endorsement. Specifications are the
          manufacturer’s published figures; this project has not independently benchmarked them.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Future                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-section">
        <header className="hd-section-head">
          <div>
            <span className="eyebrow">05 · forward look</span>
            <h2>What the next machine looks like</h2>
            <p>
              Six engineering directions visible in published hardware today. These are projections from
              current research, not product announcements.
            </p>
          </div>
          <span className="pill">projection</span>
        </header>

        <div className="hd-future">
          {FUTURE.map((f) => (
            <article className="hd-future-card" key={f.title}>
              <div className="hd-future-icon">{f.icon}</div>
              <span className="eyebrow">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* India                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="hd-india">
        <div>
          <span className="eyebrow">
            <FlaskConical size={12} /> Made in India
          </span>
          <h2>This department has an Indian wing.</h2>
          <p>
            RRI Bengaluru is building cold-atom and trapped-ion hardware under the National Quantum Mission,
            including a rubidium tweezer array and a real-time atom-state detector. The India page connects
            that programme to the device profiles in the workbench.
          </p>
        </div>
        <div className="hd-india-actions">
          <a className="btn primary" href="#/india">
            India’s quantum future <ArrowRight size={14} />
          </a>
          <a className="btn ghost" href="#/lab">
            Try the workbench <ArrowRight size={14} />
          </a>
        </div>
      </section>
    </div>
  )
}
