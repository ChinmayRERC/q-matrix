/**
 * India's quantum future hub.
 *
 * A reading-first page that connects the curriculum to the National Quantum
 * Mission, RRI Bengaluru's neutral-atom and ion programme, and the device
 * profiles the workbench can actually simulate.
 */
import {
  ArrowRight,
  Atom,
  BookOpen,
  Boxes,
  Cpu,
  ExternalLink,
  Eye,
  FlaskConical,
  GitBranch,
  GraduationCap,
  Radio,
  Target,
  Timer,
  Zap,
} from 'lucide-react'
import { DEVICES, formatDuration, type DeviceProfile } from '../lib/quantum/hardware'
import { useAppStore } from '../store/useAppStore'
import { Btn, Panel, Pill, Stat } from './ui'

const DEVICE_ORDER = ['anviqa-neutral', 'anviqa-ion', 'ibm-heron'] as const

const STEPS = [
  {
    icon: <Atom size={18} />,
    title: 'Laser cooling & MOT',
    body: 'Six red-detuned beams slow a rubidium jet from hundreds of metres per second to centimetres per second, then evaporative cooling reaches microkelvin temperatures in ultra-high vacuum.',
    tag: 'µK atoms',
  },
  {
    icon: <Boxes size={18} />,
    title: 'Optical tweezers',
    body: 'A focused 0.95 µm beam traps one atom per tweezer. A camera finds empty sites and an acousto-optic deflector drags atoms into a defect-free array.',
    tag: 'defect-free array',
  },
  {
    icon: <Zap size={18} />,
    title: 'Rydberg blockade gate',
    body: 'Two-photon excitation lifts an atom to a high Rydberg level. The giant dipole interaction blocks its neighbour, giving a native two-qubit CZ in about a microsecond.',
    tag: 'native CZ',
  },
]

const MESSAGES = [
  {
    icon: <Eye size={16} />,
    title: 'Readout is the bottleneck nobody draws',
    body: 'Fluorescence readout blasts atoms with light for tens of milliseconds and destroys the state. RRI’s Raman-driven spin-noise spectroscopy reads spin fluctuations in microseconds without destroying it — roughly a thousand times faster, and repeatable.',
    tag: 'RDSNS',
  },
  {
    icon: <GitBranch size={16} />,
    title: 'Connectivity decides the gate count',
    body: 'A circuit diagram assumes any pair can interact. A heavy-hex superconducting lattice does not: distant pairs need SWAPs, and every SWAP is three more two-qubit gates. Neutral atoms can be rearranged instead.',
    tag: 'routing',
  },
  {
    icon: <Timer size={16} />,
    title: 'Coherence is a budget',
    body: 'Every gate and every idle moment spends T₁ and T₂. A fast gate on a short-coherence device and a slow gate on a long-coherence device can reach the same fidelity for very different reasons.',
    tag: 'T₁ / T₂',
  },
  {
    icon: <Radio size={16} />,
    title: 'The same hardware senses',
    body: 'Cold-atom and spin-noise hardware also reaches tens of picotesla magnetic resolution, pointing at cryogen-free brain and heart imaging, aquifer mapping and GPS-denied navigation.',
    tag: '30 pT',
  },
]

const NEEDS = [
  {
    title: 'Atoms and ions, not only cryostats',
    body: 'India’s computing hub is betting on neutral atoms and trapped ions because every atom is an identical qubit and the platform doubles as a sensor.',
  },
  {
    title: 'Indigenous instrumentation',
    body: 'The RRI labs build their own FPGA/PXIe receivers, imaging software and noise tools. The gap is people who can work across the hardware–software boundary.',
  },
  {
    title: 'Hardware-aware software literacy',
    body: 'Students should meet coupling maps, native gate sets, readout regimes and decoherence before they meet a real QPU, not after.',
  },
  {
    title: 'Sensing as a near-term application',
    body: 'Quantum sensing ships before fault tolerance. Magnetometry, gravimetry and timing are the applications India can deploy while the computer matures.',
  },
]

const LOOP = [
  {
    stage: 'Map',
    title: 'Problem → circuit',
    body: 'Describe the state or the Hamiltonian you want. Chinnu scaffolds the circuit and explains why interference or entanglement helps — without handing over a challenge answer.',
  },
  {
    stage: 'Optimize',
    title: 'Circuit → device',
    body: 'Pick anviQa neutral atoms, anviQa ions or IBM Heron. The workbench counts native two-qubit gates, inserts SWAPs for fixed connectivity, and estimates one shot.',
  },
  {
    stage: 'Execute',
    title: 'Device → result',
    body: 'The browser runs statevector or density matrix instantly. Compare ideal against the device noise model, then cross-check the same circuit against the NumPy oracle.',
  },
  {
    stage: 'Post-process',
    title: 'Result → understanding',
    body: 'Read entropy, purity and concurrence, then export a Qiskit 2.x pattern with preset pass management and SamplerV2, ready for a real QPU.',
  },
]

const SOURCES = [
  {
    label: 'Foundation for Quantum Computing Innovation (FQCI) · National Quantum Mission',
    href: 'https://qcinnovation.co.in/',
    note: 'Computing hub for the mission.',
  },
  {
    label: 'Nature Communications · Artificial intelligence for quantum computing (2025)',
    href: 'https://www.nature.com/articles/s41467-025-65836-3',
    note: 'The review behind the AI-for-quantum framing.',
  },
  {
    label: 'SQD-Agent demo · Anupama Ray, IBM Research',
    href: 'https://youtu.be/n1udnChPheI',
    note: 'Agentic workflow for quantum simulation.',
  },
  {
    label: 'SQD-Agent paper',
    href: 'https://arxiv.org/pdf/2609.39302',
    note: 'Preprint referenced in the fall-fest session.',
  },
  {
    label: 'Quantum computing landscape',
    href: 'https://sam-jaques.appspot.com/quantum_landscape_2023',
    note: 'Algorithm-versus-hardware map.',
  },
  {
    label: 'IBM Quantum · Qiskit 2.x documentation',
    href: 'https://quantum.cloud.ibm.com/docs/en/api/qiskit/2.0',
    note: 'Patterns, transpilation and primitives.',
  },
]

function DeviceCard({ device, onUse }: { device: DeviceProfile; onUse: () => void }) {
  return (
    <div className="hw-card">
      <div className="row gap-6 wrap">
        <Pill tone="cyan">{device.short}</Pill>
        <Pill tone={device.connectivity === 'all-to-all' ? 'green' : 'amber'}>
          {device.connectivity === 'all-to-all' ? 'all-to-all' : 'nearest-neighbour'}
        </Pill>
        <span className="grow" />
        <span className="tiny dim mono">{device.physicalQubits}q target</span>
      </div>
      <h3>{device.name}</h3>
      <p className="tiny muted">{device.modality}</p>
      <div className="cols-3" style={{ marginTop: 4 }}>
        <div className="stat" style={{ padding: 9 }}>
          <div className="k">2Q gate</div>
          <div className="v" style={{ fontSize: 16 }}>{formatDuration(device.twoQubitNs / 1e6)}</div>
        </div>
        <div className="stat" style={{ padding: 9 }}>
          <div className="k">Readout</div>
          <div className="v" style={{ fontSize: 16 }}>{formatDuration(device.readoutNs / 1e6)}</div>
        </div>
        <div className="stat" style={{ padding: 9 }}>
          <div className="k">Coherence</div>
          <div className="v" style={{ fontSize: 16 }}>{formatDuration(device.coherenceUs / 1e3)}</div>
        </div>
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.5 }}>{device.note}</p>
      <div className="row gap-8">
        <Btn size="sm" variant="primary" icon={<Cpu size={12} />} onClick={onUse}>
          Use in workbench
        </Btn>
        <a className="tiny" href={device.sourceUrl} target="_blank" rel="noreferrer">
          {device.source} <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}

export function India({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const setSettings = useAppStore((s) => s.setSettings)
  const toast = useAppStore((s) => s.toast)

  const useDevice = (id: (typeof DEVICE_ORDER)[number]) => {
    const device = DEVICES[id]
    setSettings({ device: id, noisy: device.noise.depolarizing > 0, noiseLevel: device.noise.depolarizing })
    toast({ title: `Target set to ${device.name}`, detail: 'Open the workbench and press Run.', tone: 'info' })
    onNavigate('#/lab')
  }

  return (
    <div className="stack gap-18 fade-in">
      <div className="hw-hero">
        <div className="row gap-8 wrap">
          <Pill tone="violet">India · National Quantum Mission</Pill>
          <Pill tone="cyan">RRI Bengaluru · anviQa</Pill>
          <Pill tone="green">IBM · Qiskit 2.x</Pill>
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(30px, 4vw, 46px)', marginTop: 12 }}>
          The circuit diagram is <span style={{ color: 'var(--violet)' }}>not the machine</span>.
        </h1>
        <p className="lead" style={{ marginTop: 12, maxWidth: 720 }}>
          Gates on paper hide what actually limits a quantum computer: qubit quality, coherence, connectivity, native gate
          sets, readout speed and the physical trap. Q-matrix now puts those constraints on the same screen as the circuit.
        </p>
        <div className="row gap-8 wrap" style={{ marginTop: 18 }}>
          <Btn variant="primary" size="lg" icon={<Atom size={15} />} onClick={() => onNavigate('#/lab')}>
            Open the workbench
          </Btn>
          <a className="btn lg" href="#hw-sources">
            <BookOpen size={15} /> Sources &amp; further reading
          </a>
        </div>
      </div>

      <div className="cols-4">
        <Stat label="Rb atoms" value="400" hint="anviQa neutral-atom target" accent />
        <Stat label="Ca⁺ ions" value="50" hint="anviQa ion-trap target" />
        <Stat label="Mission" value="₹6,003.65 Cr" hint="8 years · 4 thematic hubs" tone="var(--cyan)" />
        <Stat label="Readout" value="~1000×" hint="RDSNS vs fluorescence" tone="var(--green)" />
      </div>

      <Panel
        title="Choose the machine"
        sub="These profiles drive the workbench noise model, routing estimate and Qiskit export"
        actions={<Pill tone="cyan">3 devices</Pill>}
      >
        <div className="hw-grid">
          {DEVICE_ORDER.map((id) => (
            <DeviceCard key={id} device={DEVICES[id]} onUse={() => useDevice(id)} />
          ))}
        </div>
        <div className="tiny dim" style={{ marginTop: 12 }}>
          Q-matrix models these machines for teaching. It does not control them. Timings are order-of-magnitude figures,
          not manufacturer datasheets.
        </div>
      </Panel>

      <Panel title="Inside an RRI neutral-atom machine" sub="Cold atoms → optical tweezers → Rydberg blockade" tight>
        <div className="hw-steps">
          {STEPS.map((step, i) => (
            <div className="hw-step" key={step.title}>
              <div className="hw-step-no">{String(i + 1).padStart(2, '0')}</div>
              <div className="hw-step-icon">{step.icon}</div>
              <div className="grow">
                <div className="row gap-6 wrap">
                  <strong>{step.title}</strong>
                  <Pill tone="violet">{step.tag}</Pill>
                </div>
                <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.55 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="What RRI Bengaluru is telling us" sub="Four messages that change how a circuit should be taught">
        <div className="hw-grid">
          {MESSAGES.map((m) => (
            <div className="hw-quote" key={m.title}>
              <div className="row gap-6">
                <span className="hw-quote-icon">{m.icon}</span>
                <Pill tone="amber">{m.tag}</Pill>
              </div>
              <strong>{m.title}</strong>
              <p className="tiny muted" style={{ lineHeight: 1.55 }}>{m.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Where India's quantum future needs to focus" sub="The problem statement, stated plainly" tight>
        <div className="hw-needs">
          {NEEDS.map((need) => (
            <div className="hw-need" key={need.title}>
              <Target size={15} color="var(--violet)" />
              <div>
                <strong>{need.title}</strong>
                <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{need.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Learn quantum AI with AI"
        sub="One loop, four stages — the same stages as a Qiskit Pattern"
        actions={<Pill tone="green">Qiskit Patterns</Pill>}
      >
        <div className="hw-loop">
          {LOOP.map((item, i) => (
            <div className="hw-loop-card" key={item.stage}>
              <div className="row gap-6">
                <span className="hw-loop-no">{i + 1}</span>
                <Pill tone="violet">{item.stage}</Pill>
              </div>
              <strong>{item.title}</strong>
              <p className="tiny muted" style={{ lineHeight: 1.55 }}>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="row gap-8 wrap" style={{ marginTop: 14 }}>
          <Btn variant="primary" icon={<FlaskConical size={13} />} onClick={() => onNavigate('#/lab')}>
            Try the loop in the workbench
          </Btn>
          <Btn icon={<GraduationCap size={13} />} onClick={() => onNavigate('#/paths')}>
            See the learning paths
          </Btn>
        </div>
      </Panel>

      <Panel title="Sources" sub="Every link below was checked" tight>
        <div id="hw-sources" className="hw-sources">
          {SOURCES.map((source) => (
            <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="hw-source">
              <div className="grow">
                <span>{source.label}</span>
                <span className="tiny dim" style={{ display: 'block' }}>{source.note}</span>
              </div>
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      </Panel>
    </div>
  )
}
