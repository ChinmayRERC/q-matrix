/**
 * Isometric hardware diagrams for the Hardware department.
 *
 * Two machines, drawn from solids rather than boxes: a neutral-atom stack on an
 * optical table and a dilution refrigerator. Both share the same hotspot
 * interaction so the readout panel can explain one subsystem at a time.
 */

export interface MachinePart {
  id: string
  label: string
  title: string
  body: string
  spec: string
  /** Failure mode worth knowing about, shown in the readout. */
  risk: string
}

export const ATOM_PARTS: MachinePart[] = [
  {
    id: 'chamber',
    label: 'Vacuum',
    title: 'Ultra-high-vacuum chamber',
    body: 'The glass cell holds a cloud of rubidium or strontium at roughly 10⁻¹¹ mbar, colder than interplanetary space. Atoms must travel from the source to the trap without colliding with background gas.',
    spec: '≈10⁻¹¹ mbar · 1 atom per trap site',
    risk: 'A single background collision knocks an atom out of its tweezer and erases its state.',
  },
  {
    id: 'array',
    label: 'Atom array',
    title: 'Optical tweezer array',
    body: 'A focused beam about one micrometre wide creates a tiny trap. One atom sits in each tweezers; an acousto-optic deflector moves the traps and a camera checks which sites are filled, so the array can be rearranged into a defect-free grid.',
    spec: '≈1 µm trap waist · hundreds of sites',
    risk: 'Empty or doubly-loaded sites look like valid qubits unless the camera verifies every shot.',
  },
  {
    id: 'lasers',
    label: 'Lasers',
    title: 'Laser rack',
    body: 'Narrow-linewidth lasers cool the atoms, repump them out of dark states, and drive the two-photon Rydberg transition. Every beam is frequency-stabilised to an atomic reference.',
    spec: '780 nm cooling · 480 nm Rydberg · kHz linewidth',
    risk: 'A laser drifting off resonance silently lowers gate fidelity instead of stopping the machine.',
  },
  {
    id: 'optics',
    label: 'Optics',
    title: 'AOD, objective and beam path',
    body: 'Acousto-optic deflectors steer and shutter beams in microseconds. A high-NA objective focuses them onto the array, and the same lens collects fluorescence on the way back.',
    spec: 'µs switching · diffraction-limited focus',
    risk: 'Thermal drift in the optical path moves the focus off the atoms between calibrations.',
  },
  {
    id: 'control',
    label: 'Control',
    title: 'Classical control rack',
    body: 'An FPGA or PXI chassis sequences laser pulses, camera triggers and magnetic coils with nanosecond timing. It also closes the loop: image the array, decide, reload the traps.',
    spec: 'ns timing · real-time feedback',
    risk: 'Timing skew between channels turns a perfect gate into a correlated error across the array.',
  },
  {
    id: 'detection',
    label: 'Readout',
    title: 'Fluorescence detection',
    body: 'A readout beam scatters photons from atoms still in the bright state. The objective images them onto an sCMOS or EMCCD camera; bright sites read 1, dark sites read 0.',
    spec: '10–100 ms per image · destructive',
    risk: 'Readout destroys the state and is usually the slowest step in the whole machine.',
  },
  {
    id: 'coils',
    label: 'Coils',
    title: 'Magnetic coils and MOT',
    body: 'A quadrupole field plus three pairs of laser beams form a magneto-optical trap. Bias coils then cancel stray fields so the atoms keep their spin coherence.',
    spec: 'µT bias stability · six cooling beams',
    risk: 'A milligauss of stray field dephases the array faster than the laser can correct it.',
  },
  {
    id: 'pump',
    label: 'Pump',
    title: 'Ion pump and vacuum stack',
    body: 'A turbo pump evacuates the chamber; an ion pump or getter keeps it at UHV without vibration. Valves and a differential pumping tube separate the hot atom source from the cold science cell.',
    spec: 'quiet UHV · no moving parts',
    risk: 'A running turbo pump vibrates the table, so it is switched off once UHV is reached.',
  },
]

export const SUPER_PARTS: MachinePart[] = [
  {
    id: 'plates',
    label: 'Plates',
    title: 'Dilution refrigerator plates',
    body: 'The fridge is a stack of thermal stages. Each plate is colder than the one above: about 50 K, 4 K, 1 K, 100 mK and finally the mixing chamber near 10 mK.',
    spec: '300 K → 10 mK across five stages',
    risk: 'A warm stage leaks heat down the wiring and raises the whole base temperature.',
  },
  {
    id: 'mixing',
    label: 'Mixing',
    title: 'Mixing chamber',
    body: 'Helium-3 and helium-4 are mixed and separated in a closed cycle. The mixing chamber sits at the bottom because that is where the coldest, most fragile parts live.',
    spec: '≈10 mK base temperature',
    risk: 'Cooling power is tiny: a few microwatts at 10 mK, easily spent by a bad cable.',
  },
  {
    id: 'chip',
    label: 'Chip',
    title: 'Superconducting qubit chip',
    body: 'Transmon qubits and tunable couplers are patterned in niobium and aluminium on silicon. Josephson junctions set the qubit frequency and nonlinearity.',
    spec: '100+ qubits · 10–30 µs coherence',
    risk: 'Fabrication variation spreads qubit frequencies, so every chip needs individual calibration.',
  },
  {
    id: 'wiring',
    label: 'Wiring',
    title: 'Cryogenic signal wiring',
    body: 'Coaxial lines carry microwave pulses down through attenuators and filters at every plate. The attenuators absorb room-temperature noise before it reaches the qubit.',
    spec: 'hundreds of lines · directional filtering',
    risk: 'One noisy line heats the sample or injects photons that reset a qubit mid-circuit.',
  },
  {
    id: 'microwave',
    label: 'Microwave',
    title: 'Room-temperature RF rack',
    body: 'Signal generators, IQ mixers, arbitrary-waveform generators and digitizers synthesize the pulses and demodulate the readout. The rack is larger than the fridge.',
    spec: '4–8 GHz · ns-scale envelopes',
    risk: 'Phase noise and mixer spurs show up as gate errors that look like decoherence.',
  },
  {
    id: 'shield',
    label: 'Shield',
    title: 'Magnetic and infrared shielding',
    body: 'A mu-metal can and aluminium infrared shields surround the plates. Superconducting circuits are sensitive to trapped flux and to blackbody photons from warmer stages.',
    spec: 'μ-metal + IR baffles',
    risk: 'A trapped flux vortex adds loss and shifts the qubit frequency unpredictably.',
  },
  {
    id: 'readout',
    label: 'Readout',
    title: 'Dispersive readout chain',
    body: 'Each qubit couples to a microwave resonator. A pulse interrogates the resonator; its phase shift reveals the qubit state, and a cryogenic amplifier boosts the signal before room temperature.',
    spec: '≈100 ns–1 µs · single-shot',
    risk: 'The first amplifier’s added noise sets the readout fidelity, not the qubit.',
  },
  {
    id: 'fab',
    label: 'Fab',
    title: 'Fabrication and packaging',
    body: 'Josephson junctions are evaporated in an e-beam or shadow-mask process, then the chip is diced, mounted and wire-bonded into a sample holder.',
    spec: 'nm-scale junctions · superconducting metal',
    risk: 'A junction a few nanometres off changes the qubit frequency by hundreds of MHz.',
  },
]

/** Shared circle marker for a clickable subsystem. */
function Hotspot({
  x,
  y,
  n,
  active,
  onClick,
  label,
}: {
  x: number
  y: number
  n: number
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <g
      className={`hd-hotspot ${active ? 'on' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <circle className="hd-hotspot-ring" cx={x} cy={y} r={17} />
      <circle className="hd-hotspot-core" cx={x} cy={y} r={11} />
      <text x={x} y={y + 3.6} textAnchor="middle" className="hd-hotspot-n">
        {n}
      </text>
    </g>
  )
}

/** A ring of fasteners, drawn on flanges and plates. */
function Bolts({ cx, cy, rx, ry, n = 8 }: { cx: number; cy: number; rx: number; ry: number; n?: number }) {
  return (
    <g className="hd-bolts">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return <circle key={i} cx={cx + Math.cos(a) * rx} cy={cy + Math.sin(a) * ry} r={1.7} />
      })}
    </g>
  )
}

/** Ruler ticks and corner fasteners on the optical table. */
function TableTicks() {
  return (
    <g>
      <g className="hd-ticks">
        {Array.from({ length: 14 }, (_, i) => {
          const x = 148 + i * 17.4
          const y = 427 + i * 9.05
          return <line key={i} x1={x} y1={y} x2={x + 2} y2={y + 7} />
        })}
      </g>
      <g className="hd-bolts">
        {[
          [152, 423],
          [386, 358],
          [637, 423],
          [398, 489],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.4} />
        ))}
      </g>
    </g>
  )
}

export function AtomMachine({
  part,
  onPart,
}: {
  part: string
  onPart: (id: string) => void
}) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )

  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric cutaway of a neutral-atom quantum computer on an optical table">
      <defs>
        <linearGradient id="hd-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ce7ff" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="#7ce7ff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#9b7cff" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id="hd-glow">
          <stop offset="0" stopColor="#62e0f2" stopOpacity="0.55" />
          <stop offset="1" stopColor="#62e0f2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hd-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff7aa8" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ff7aa8" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* floor shadow */}
      <ellipse className="hd-ground-shadow" cx="400" cy="545" rx="270" ry="42" fill="#6b6860" opacity="0.2" />

      {/* optical table top */}
      <polygon className="hd-surf-mid" points="130,410 380,348 650,410 400,478" />
      <polygon className="hd-surf-lo" points="130,410 400,478 400,506 130,438" />
      <polygon className="hd-surf-lo" points="400,478 650,410 650,438 400,506" />
      <polygon className="hd-line" points="130,410 380,348 650,410 400,478" />
      {/* table holes */}
      {[
        [200, 408],
        [250, 396],
        [300, 385],
        [350, 374],
        [450, 386],
        [500, 398],
        [550, 409],
        [300, 435],
        [360, 448],
        [460, 449],
        [520, 433],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="#070a15" opacity="0.6" />
      ))}
      <TableTicks />

      {/* legs */}
      <polygon className="hd-surf-lo" points="148,438 176,432 176,520 148,527" />
      <polygon className="hd-surf-lo" points="608,438 632,432 632,518 608,524" />
      <polygon className="hd-surf-lo" points="374,500 398,494 398,556 374,562" />
      <polygon className="hd-surf-lo" points="404,500 428,494 428,556 404,562" />

      {/* left control rack */}
      <g>
        <polygon className="hd-surf-lo" points="174,300 238,284 238,414 174,430" />
        <polygon className="hd-surf-mid" points="174,300 238,284 258,292 194,308" />
        <polygon className="hd-surf-hi" points="238,284 258,292 258,422 238,414" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x="180" y={312 + i * 20} width="50" height="15" rx="2" fill="#0a0e1c" opacity="0.8" />
            <circle cx="188" cy={319 + i * 20} r="2" fill={i % 2 ? '#62e0f2' : '#5ee2a8'} />
            <circle cx="196" cy={319 + i * 20} r="2" fill={i === 3 ? '#ffc46b' : '#2b3350'} />
          </g>
        ))}
        <rect x="182" y="396" width="44" height="8" rx="2" fill="#0a0e1c" opacity="0.7" />
        <rect x="182" y="406" width="30" height="3" rx="1.5" fill="#62e0f2" opacity="0.5" />
      </g>

      {/* right laser rack */}
      <g>
        <polygon className="hd-surf-lo" points="536,286 604,269 604,400 536,416" />
        <polygon className="hd-surf-mid" points="536,286 604,269 626,278 558,294" />
        <polygon className="hd-surf-hi" points="604,269 626,278 626,409 604,400" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="542" y={300 + i * 26} width="54" height="18" rx="2" fill="#0a0e1c" opacity="0.82" />
            <rect x="547" y={305 + i * 26} width="26" height="8" rx="2" fill="#ff7aa8" opacity={0.7 - i * 0.14} />
            <circle cx="588" cy={309 + i * 26} r="2" fill="#62e0f2" />
          </g>
        ))}
        <rect x="544" y="382" width="48" height="6" rx="2" fill="#0a0e1c" opacity="0.7" />
      </g>

      {/* beam from laser rack to chamber */}
      <path d="M 566 316 L 500 330 L 452 356" className="hd-beam-line" />
      <path d="M 566 342 L 512 356 L 460 372" className="hd-beam-line dim" />
      <path d="M 566 368 L 520 388 L 468 396" className="hd-beam-line dim" />

      {/* chamber body */}
      <g>
        <ellipse cx="400" cy="300" rx="76" ry="26" className="hd-surf-hi" />
        <Bolts cx={400} cy={300} rx={68} ry={21} n={12} />
        <path d="M 324 300 L 324 404 A 76 26 0 0 0 476 404 L 476 300" className="hd-surf-mid" />
        <ellipse cx="400" cy="404" rx="76" ry="26" className="hd-surf-lo" />
        <ellipse cx="400" cy="300" rx="66" ry="21" className="hd-surf-lit" opacity="0.5" />
        <ellipse cx="400" cy="300" rx="52" ry="16" fill="#05070f" opacity="0.8" />
        {/* glass cell */}
        <path d="M 356 316 L 356 392 A 44 15 0 0 0 444 392 L 444 316 A 44 15 0 0 1 356 316 Z" fill="#eef3f4" stroke="#5f5d57" strokeWidth="1" />
        <ellipse cx="400" cy="316" rx="44" ry="15" fill="none" stroke="#7ce7ff" strokeOpacity="0.45" />
        {/* atom array inside */}
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              className="hd-atom"
              cx={372 + col * 14}
              cy={330 + row * 11}
              r="2.6"
              style={{ animationDelay: `${(row * 5 + col) * 0.18}s` }}
            />
          )),
        )}
        {/* MOT coils */}
        <ellipse cx="400" cy="340" rx="84" ry="24" fill="none" stroke="#ffc46b" strokeWidth="5" opacity="0.7" />
        <ellipse cx="400" cy="374" rx="84" ry="24" fill="none" stroke="#ffc46b" strokeWidth="5" opacity="0.5" />
        <ellipse cx="400" cy="340" rx="84" ry="24" fill="none" stroke="#fff" strokeWidth="1" opacity="0.2" />
        {/* ports */}
        <rect x="320" y="330" width="18" height="12" rx="3" className="hd-surf-hi" />
        <rect x="462" y="350" width="18" height="12" rx="3" className="hd-surf-hi" />
        <rect x="392" y="272" width="16" height="10" rx="3" className="hd-surf-hi" />
      </g>

      {/* ion pump below chamber */}
      <g>
        <rect x="374" y="430" width="54" height="42" rx="5" className="hd-surf-mid" />
        <rect x="380" y="438" width="42" height="7" rx="2" fill="#0a0e1c" opacity="0.8" />
        <rect x="380" y="450" width="42" height="3" rx="1.5" fill="#5ee2a8" opacity="0.5" />
        <rect x="380" y="458" width="30" height="3" rx="1.5" fill="#5ee2a8" opacity="0.3" />
        <rect x="386" y="472" width="30" height="10" rx="2" className="hd-surf-lo" />
      </g>

      {/* camera / readout */}
      <g>
        <polygon className="hd-surf-mid" points="486,452 540,438 540,478 486,492" />
        <polygon className="hd-surf-hi" points="486,452 540,438 552,444 498,458" />
        <polygon className="hd-surf-lo" points="540,438 552,444 552,484 540,478" />
        <circle cx="500" cy="472" r="9" fill="#05070f" stroke="#62e0f2" strokeOpacity="0.5" />
        <circle cx="500" cy="472" r="4" fill="#62e0f2" opacity="0.8" />
        <path d="M 500 462 L 466 410" stroke="#62e0f2" strokeOpacity="0.3" strokeDasharray="3 4" />
      </g>

      {/* AOD box on the table front */}
      <g>
        <polygon className="hd-surf-mid" points="286,452 338,439 338,466 286,479" />
        <polygon className="hd-surf-hi" points="286,452 338,439 348,444 296,457" />
        <polygon className="hd-surf-lo" points="338,439 348,444 348,471 338,466" />
        <rect x="296" y="459" width="28" height="4" rx="2" fill="#62e0f2" opacity="0.5" />
        <path d="M 320 448 L 356 400" stroke="#62e0f2" strokeOpacity="0.35" />
      </g>

      {/* cable from control rack to chamber */}
      <path d="M 238 360 C 272 372 286 352 318 356" fill="none" stroke="#9b7cff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 4" />

      {/* hotspots */}
      {hot('chamber', 1, 'Vacuum chamber', 330, 300)}
      {hot('array', 2, 'Optical tweezer array', 400, 356)}
      {hot('lasers', 3, 'Laser rack', 570, 270)}
      {hot('optics', 4, 'AOD and objective', 312, 445)}
      {hot('control', 5, 'Control rack', 206, 292)}
      {hot('detection', 6, 'Fluorescence camera', 520, 430)}
      {hot('coils', 7, 'MOT coils', 480, 340)}
      {hot('pump', 8, 'Ion pump', 430, 432)}

      {/* engraved labels */}
      <text x="206" y="448" className="hd-engrave" textAnchor="middle">CONTROL</text>
      <text x="574" y="424" className="hd-engrave" textAnchor="middle">LASERS</text>
      <text x="400" y="586" className="hd-engrave" textAnchor="middle">COLD-ATOM PROCESSOR · CUTAWAY</text>
    </svg>
  )
}

export function FridgeMachine({
  part,
  onPart,
}: {
  part: string
  onPart: (id: string) => void
}) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )

  const plates = [
    { y: 190, w: 150, label: '50 K' },
    { y: 236, w: 134, label: '4 K' },
    { y: 282, w: 118, label: '1 K' },
    { y: 328, w: 102, label: '100 mK' },
    { y: 374, w: 86, label: '10 mK' },
  ]

  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric cutaway of a dilution refrigerator with a superconducting qubit chip">
      <defs>
        <radialGradient id="hd-chip-glow">
          <stop offset="0" stopColor="#9b7cff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#9b7cff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="hd-ground-shadow" cx="390" cy="552" rx="250" ry="40" fill="#6b6860" opacity="0.2" />

      {/* frame */}
      <rect x="250" y="118" width="270" height="12" rx="4" className="hd-surf-hi" />
      <rect x="240" y="104" width="290" height="14" rx="5" className="hd-surf-mid" />
      <polygon className="hd-surf-lo" points="258,130 274,130 274,548 258,548" />
      <polygon className="hd-surf-lo" points="488,130 504,130 504,548 488,548" />
      <polygon className="hd-surf-lo" points="258,536 504,536 504,548 258,548" />

      {/* shield can */}
      <path d="M 302 170 L 302 430 A 90 22 0 0 0 482 430 L 482 170" fill="none" stroke="#62e0f2" strokeOpacity="0.22" strokeDasharray="6 6" />

      {/* plates */}
      {plates.map((p, i) => (
        <g key={p.label}>
          <ellipse cx="392" cy={p.y} rx={p.w} ry={p.w * 0.24} className={i === 0 ? 'hd-surf-hi' : 'hd-surf-mid'} />
          <ellipse cx="392" cy={p.y + 8} rx={p.w} ry={p.w * 0.24} className="hd-surf-lo" />
          <rect x={392 - p.w} y={p.y} width={p.w * 2} height="8" className="hd-surf-lo" />
          <Bolts cx={392} cy={p.y} rx={p.w - 10} ry={(p.w - 10) * 0.24} n={10} />
          <text x={392 + p.w + 12} y={p.y + 4} className="hd-plate-label">{p.label}</text>
        </g>
      ))}

      {/* central rod and stages */}
      <rect x="386" y="122" width="12" height="300" rx="3" className="hd-surf-mid" />
      <rect x="382" y="180" width="20" height="26" rx="4" className="hd-surf-hi" />
      <rect x="380" y="226" width="24" height="30" rx="5" className="hd-surf-hi" />
      <rect x="378" y="272" width="28" height="34" rx="6" className="hd-surf-hi" />
      <rect x="380" y="318" width="24" height="34" rx="5" className="hd-surf-hi" />

      {/* mixing chamber */}
      <ellipse cx="392" cy="382" rx="44" ry="12" className="hd-surf-hi" />
      <rect x="348" y="382" width="88" height="20" rx="6" className="hd-surf-mid" />
      <ellipse cx="392" cy="402" rx="44" ry="12" className="hd-surf-lo" />

      {/* chip and sample holder */}
      <rect x="356" y="430" width="72" height="12" rx="3" className="hd-surf-hi" />
      <rect x="368" y="418" width="48" height="14" rx="2" fill="#0b1020" stroke="#9b7cff" strokeOpacity="0.6" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={372 + i * 11} y="422" width="6" height="6" rx="1" fill="#9b7cff" opacity={0.35 + i * 0.15} />
      ))}

      {/* wiring looms */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M ${318 + i * 4} 170 C ${334 + i * 3} 260, ${338 + i * 3} 340, ${352 + i * 6} 424`}
          fill="none"
          stroke={i % 2 ? '#ffc46b' : '#62e0f2'}
          strokeOpacity="0.28"
          strokeWidth="1.6"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={`r${i}`}
          d={`M ${466 - i * 4} 170 C ${450 - i * 3} 260, ${446 - i * 3} 340, ${432 - i * 6} 424`}
          fill="none"
          stroke="#9b7cff"
          strokeOpacity="0.25"
          strokeWidth="1.6"
        />
      ))}

      {/* RF racks */}
      <g>
        <polygon className="hd-surf-lo" points="96,304 166,286 166,440 96,458" />
        <polygon className="hd-surf-mid" points="96,304 166,286 190,294 120,312" />
        <polygon className="hd-surf-hi" points="166,286 190,294 190,448 166,440" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="103" y={318 + i * 28} width="52" height="18" rx="2" fill="#0a0e1c" opacity="0.84" />
            <circle cx="112" cy={327 + i * 28} r="2.2" fill={i % 2 ? '#62e0f2' : '#5ee2a8'} />
            <rect x="122" y={324 + i * 28} width="26" height="5" rx="2" fill="#9b7cff" opacity="0.5" />
          </g>
        ))}
        <text x="128" y="474" className="hd-engrave" textAnchor="middle">CONTROL</text>
      </g>
      <g>
        <polygon className="hd-surf-lo" points="594,304 664,286 664,440 594,458" />
        <polygon className="hd-surf-mid" points="594,304 664,286 688,294 618,312" />
        <polygon className="hd-surf-hi" points="664,286 688,294 688,448 664,440" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="601" y={318 + i * 28} width="52" height="18" rx="2" fill="#0a0e1c" opacity="0.84" />
            <rect x="607" y={324 + i * 28} width="20" height="5" rx="2" fill="#ffc46b" opacity="0.55" />
            <circle cx="644" cy={327 + i * 28} r="2.2" fill="#ff7aa8" />
          </g>
        ))}
        <text x="632" y="474" className="hd-engrave" textAnchor="middle">MICROWAVE</text>
      </g>

      {/* cables from racks to top plate */}
      <path d="M 166 292 C 210 250 236 206 300 156" fill="none" stroke="#62e0f2" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 4" />
      <path d="M 594 292 C 550 250 524 206 484 156" fill="none" stroke="#ffc46b" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 4" />

      {/* hotspots */}
      {hot('plates', 1, 'Cryostat plates', 296, 190)}
      {hot('mixing', 2, 'Mixing chamber', 470, 386)}
      {hot('chip', 3, 'Qubit chip', 392, 442)}
      {hot('wiring', 4, 'Cryogenic wiring', 344, 300)}
      {hot('microwave', 5, 'Microwave rack', 630, 270)}
      {hot('shield', 6, 'Magnetic shield', 300, 410)}
      {hot('readout', 7, 'Readout chain', 512, 236)}
      {hot('fab', 8, 'Fabrication', 392, 520)}

      <text x="392" y="592" className="hd-engrave" textAnchor="middle">DILUTION REFRIGERATOR · CUTAWAY</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// More machine anatomies
// ---------------------------------------------------------------------------

export const ION_PARTS: MachinePart[] = [
  {
    id: 'chamber',
    label: 'Vacuum',
    title: 'Stainless UHV chamber',
    body: 'A sealed steel sphere with sapphire viewports holds the trap at ultra-high vacuum. Every laser beam enters through a window; every electrical line enters through a ceramic feedthrough.',
    spec: '≈10⁻¹¹ mbar · sapphire viewports',
    risk: 'A virtual leak or a dirty window scatters light and raises the background counts.',
  },
  {
    id: 'chain',
    label: 'Ion chain',
    title: 'Linear Paul trap and ion chain',
    body: 'Positively charged ions are held in a line by oscillating electric fields. Their shared motion couples every ion to every other ion, which is where all-to-all connectivity comes from.',
    spec: '10–50 ions · all-to-all via motion',
    risk: 'Heating of the motional mode turns a two-qubit gate into a thermal mess.',
  },
  {
    id: 'electrodes',
    label: 'Electrodes',
    title: 'Gold blade electrodes',
    body: 'Shaped electrodes create the quadrupole field. Changing their voltages shuttles an ion through junctions, so one trap can route many pairs without physically moving lasers.',
    spec: 'RF ≈ 10–50 MHz · µm-scale gaps',
    risk: 'Surface contamination charges up and shifts the trap frequency overnight.',
  },
  {
    id: 'lasers',
    label: 'Lasers',
    title: 'Cooling and gate lasers',
    body: 'Several narrow-linewidth wavelengths cool the ions, prepare the hyperfine state, drive Raman transitions and read out fluorescence. Each beam is switched by an AOM.',
    spec: '397 / 729 / 854 nm (Ca⁺) · kHz linewidth',
    risk: 'A mode-hop changes the detuning and silently lowers gate fidelity.',
  },
  {
    id: 'camera',
    label: 'Readout',
    title: 'PMT or EMCCD imaging',
    body: 'A readout beam scatters photons from a bright ion. A photomultiplier or camera counts them; a dark ion means the other state. The readout is destructive and can be repeated.',
    spec: '≈100 µs–1 ms · state-dependent fluorescence',
    risk: 'Detector dark counts and stray light set a ceiling on single-shot fidelity.',
  },
  {
    id: 'rf',
    label: 'RF drive',
    title: 'Trap RF resonator',
    body: 'A high-Q resonator drives the electrodes at radio frequency. Its amplitude and phase stability directly set how tightly the ions are confined.',
    spec: '10–50 MHz · high-Q resonator',
    risk: 'RF pickup on the detection path appears as fake ion counts.',
  },
  {
    id: 'pump',
    label: 'Pump',
    title: 'Ion pump and getter',
    body: 'A quiet ion pump keeps the chamber at UHV. No turbo pump runs during operation, because vibration would heat the ion motion.',
    spec: 'quiet UHV · no moving parts',
    risk: 'A slowly rising pressure shortens the ion lifetime and corrupts long experiments.',
  },
]

export const PHOTONIC_PARTS: MachinePart[] = [
  {
    id: 'source',
    label: 'Source',
    title: 'Squeezed-light source',
    body: 'A nonlinear crystal or optical parametric oscillator produces squeezed vacuum: light whose noise is below the shot-noise limit in one quadrature.',
    spec: '≈1064 nm pump · >10 dB squeezing',
    risk: 'Loss after the source destroys squeezing faster than any detector inefficiency.',
  },
  {
    id: 'chip',
    label: 'Chip',
    title: 'Photonic integrated circuit',
    body: 'Waveguides, beam splitters and phase shifters are patterned on silicon nitride or lithium niobate. Photons interfere on-chip instead of on a metre-wide table.',
    spec: 'silicon nitride / LiNbO₃ · µm waveguides',
    risk: 'Fabrication variation shifts phase shifters and needs per-chip calibration.',
  },
  {
    id: 'phase',
    label: 'Interference',
    title: 'Phase shifters and interferometer',
    body: 'A mesh of Mach-Zehnder interferometers mixes modes. The unitary is set electrically, so the same chip can run many different circuits.',
    spec: 'thermo-optic or electro-optic · ns–µs tuning',
    risk: 'Thermal crosstalk between neighbouring phase shifters drifts the whole mesh.',
  },
  {
    id: 'fiber',
    label: 'Fiber',
    title: 'Low-loss fibre coupling',
    body: 'Fibre carries photons between the source, the chip and the detectors. Coupling loss at each interface is the dominant error in many photonic experiments.',
    spec: '<0.2 dB/km fibre · <1 dB per coupling',
    risk: 'A misaligned fibre coupler loses photons and looks exactly like a detector failure.',
  },
  {
    id: 'detectors',
    label: 'Detectors',
    title: 'SNSPD detector array',
    body: 'Superconducting nanowires absorb single photons and produce measurable voltage pulses with high efficiency and low dark counts.',
    spec: '>90% efficiency · <100 ps jitter',
    risk: 'Detector efficiency is part of the computation, not an external measurement detail.',
  },
  {
    id: 'cryo',
    label: 'Cryostat',
    title: 'Detector cryostat',
    body: 'SNSPDs operate near 1–2 K. A compact cryostat with a cold finger keeps the nanowires superconducting while fibres bring light in.',
    spec: '≈1–2 K · fibre feedthrough',
    risk: 'A warm stage raises dark counts and can quench the nanowire.',
  },
  {
    id: 'control',
    label: 'Control',
    title: 'Bias and timing electronics',
    body: 'Bias currents, phase voltages, pump lasers and time-tagging electronics are synchronised to picoseconds so photon arrivals can be correlated.',
    spec: 'ps timing · multi-channel bias',
    risk: 'Clock skew between channels erases the interference you are trying to measure.',
  },
]

export const NV_PARTS: MachinePart[] = [
  {
    id: 'diamond',
    label: 'Diamond',
    title: 'Diamond sample',
    body: 'A millimetre-scale diamond holds nitrogen-vacancy centres: a nitrogen atom next to a missing carbon atom. The defect is a stable room-temperature qubit.',
    spec: 'room temperature · optically addressable',
    risk: 'Surface termination and strain shift the zero-field splitting from sample to sample.',
  },
  {
    id: 'nv',
    label: 'NV spin',
    title: 'Electron and nuclear spin',
    body: 'The NV electron spin is manipulated with microwaves and read out optically. A nearby ¹⁴N or ¹³C nucleus can act as a long-lived memory qubit.',
    spec: 'ms coherence (electron) · s–min (nuclear)',
    risk: 'Magnetic noise from the surface shortens coherence as the defect nears the edge.',
  },
  {
    id: 'laser',
    label: 'Laser',
    title: '532 nm pump laser',
    body: 'Green light initialises the spin and drives fluorescence. The spin-dependent brightness is what makes optical readout possible at room temperature.',
    spec: '532 nm · ns pulses',
    risk: 'Laser intensity noise translates directly into readout noise.',
  },
  {
    id: 'objective',
    label: 'Objective',
    title: 'Confocal microscope',
    body: 'A high-NA objective focuses the laser onto one defect and collects the red fluorescence. A pinhole rejects light from outside the focal volume.',
    spec: 'NA ≈ 0.9–1.4 · diffraction-limited spot',
    risk: 'The objective drifts out of focus with temperature, losing the single-defect signal.',
  },
  {
    id: 'microwave',
    label: 'Microwave',
    title: 'Spin-control antenna',
    body: 'A microwave antenna or coplanar waveguide delivers 2.8 GHz pulses that rotate the electron spin. Rabi and Ramsey sequences all live here.',
    spec: '≈2.87 GHz · ns–µs pulses',
    risk: 'Antenna heating and standing waves make the Rabi frequency vary across the sample.',
  },
  {
    id: 'apd',
    label: 'Readout',
    title: 'Single-photon counter',
    body: 'An avalanche photodiode counts the red fluorescence. Bright means one spin state, dark the other; repeated shots build the contrast.',
    spec: 'single photon · ~ns timing',
    risk: 'APD dead time and afterpulsing limit the maximum count rate.',
  },
  {
    id: 'stage',
    label: 'Motion',
    title: 'Nanopositioning stage',
    body: 'Piezo stages scan the diamond under the objective with nanometre precision, so individual defects can be found and addressed.',
    spec: 'nm resolution · closed loop',
    risk: 'Stage hysteresis moves the spot off the defect between scans unless it is closed-loop.',
  },
  {
    id: 'magnet',
    label: 'Magnet',
    title: 'Bias magnetic field',
    body: 'A small permanent or electromagnet splits the spin levels and defines the quantization axis. Field stability sets the transition frequency.',
    spec: '≈mT bias · µT stability',
    risk: 'A drifting supply moves the resonance off the fixed microwave frequency.',
  },
]

export const SILICON_PARTS: MachinePart[] = [
  {
    id: 'fridge',
    label: 'Cryostat',
    title: 'Dilution refrigerator',
    body: 'Silicon spin qubits operate below 1 K, where phonon scattering and charge noise are suppressed. The chip sits on the mixing chamber at the bottom of the fridge.',
    spec: '≈10–100 mK',
    risk: 'A single warm cable can raise the electron temperature above the operating point.',
  },
  {
    id: 'chip',
    label: 'Chip',
    title: 'Silicon quantum-dot chip',
    body: 'Gate-defined quantum dots confine single electrons in isotopically enriched ²⁸Si, where the nuclear-spin background is almost zero.',
    spec: '²⁸Si · gate-defined dots',
    risk: 'Charge traps at the Si/SiO₂ interface cause random telegraph noise.',
  },
  {
    id: 'dots',
    label: 'Qubits',
    title: 'Electron spin qubits',
    body: 'Each electron spin is a qubit. Single-qubit rotations use microwaves; two-qubit gates use the exchange interaction when wavefunctions overlap.',
    spec: 'µs coherence · ns–µs gates',
    risk: 'Valley leakage and dot-to-dot variability limit yield across a wafer.',
  },
  {
    id: 'gates',
    label: 'Gates',
    title: 'Platinum gate electrodes',
    body: 'Nanoscale gates define the dots and tune tunnel barriers. The same gates can be used for readout through charge sensing.',
    spec: 'tens of nm gates · CMOS-compatible',
    risk: 'Gate bias drift moves the operating point; recalibration is constant.',
  },
  {
    id: 'magnet',
    label: 'Magnet',
    title: 'Vector magnet',
    body: 'A superconducting or room-temperature vector magnet sets the Zeeman splitting and enables addressability of individual spins.',
    spec: '≈1 T · three axes',
    risk: 'Flux jumps in a superconducting magnet shift the field mid-experiment.',
  },
  {
    id: 'rf',
    label: 'RF',
    title: 'RF reflectometry and pulses',
    body: 'Microwave pulses drive the spins; RF reflectometry senses the charge state through a resonator coupled to the dot.',
    spec: 'GHz drive · MHz reflectometry',
    risk: 'Cable loss and reflections distort the pulse that reaches the chip.',
  },
  {
    id: 'readout',
    label: 'Readout',
    title: 'Charge sensing',
    body: 'A nearby single-electron transistor or quantum point contact detects whether an electron tunnelled, converting a spin state into a charge signal.',
    spec: 'single-electron sensitivity',
    risk: 'Sensor drift and charge noise reduce the visibility of the spin-dependent signal.',
  },
]

/** Shared isometric optical table used by the room-temperature machines. */
function TableBase() {
  return (
    <g>
      <ellipse className="hd-ground-shadow" cx="400" cy="545" rx="270" ry="42" fill="#6b6860" opacity="0.2" />
      <polygon className="hd-surf-mid" points="130,410 380,348 650,410 400,478" />
      <polygon className="hd-surf-lo" points="130,410 400,478 400,506 130,438" />
      <polygon className="hd-surf-lo" points="400,478 650,410 650,438 400,506" />
      <polygon className="hd-line" points="130,410 380,348 650,410 400,478" />
      <polygon points="140,412 380,354 638,412 400,472" fill="#ffffff" opacity="0.025" />
      {[
        [200, 408],
        [250, 396],
        [300, 385],
        [350, 374],
        [450, 386],
        [500, 398],
        [550, 409],
        [300, 435],
        [360, 448],
        [460, 449],
        [520, 433],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="#070a15" opacity="0.65" />
      ))}
      <TableTicks />
      <polygon className="hd-surf-lo" points="148,438 176,432 176,520 148,527" />
      <polygon className="hd-surf-lo" points="608,438 632,432 632,518 608,524" />
      <polygon className="hd-surf-lo" points="374,500 398,494 398,556 374,562" />
      <polygon className="hd-surf-lo" points="404,500 428,494 428,556 404,562" />
    </g>
  )
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7ce7ff" stopOpacity="0.22" />
        <stop offset="0.6" stopColor="#7ce7ff" stopOpacity="0.04" />
        <stop offset="1" stopColor="#9b7cff" stopOpacity="0.18" />
      </linearGradient>
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor="#62e0f2" stopOpacity="0.5" />
        <stop offset="1" stopColor="#62e0f2" stopOpacity="0" />
      </radialGradient>
      {/* TableBase is shared, so it needs a stable gradient id. */}
      <radialGradient id="hd-glow">
        <stop offset="0" stopColor="#62e0f2" stopOpacity="0.5" />
        <stop offset="1" stopColor="#62e0f2" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5ee2a8" stopOpacity="0.08" />
        <stop offset="1" stopColor="#5ee2a8" stopOpacity="0.9" />
      </linearGradient>
    </defs>
  )
}

export function IonMachine({ part, onPart }: { part: string; onPart: (id: string) => void }) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )
  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric cutaway of a trapped-ion quantum computer">
      <Defs id="ion" />
      <TableBase />

      {/* control rack */}
      <g>
        <polygon className="hd-surf-lo" points="160,286 224,270 224,402 160,418" />
        <polygon className="hd-surf-mid" points="160,286 224,270 246,278 182,294" />
        <polygon className="hd-surf-hi" points="224,270 246,278 246,410 224,402" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x="166" y={298 + i * 20} width="50" height="14" rx="2" fill="#0a0e1c" opacity="0.82" />
            <circle cx="174" cy={305 + i * 20} r="2" fill={i % 2 ? '#62e0f2' : '#5ee2a8'} />
            <circle cx="182" cy={305 + i * 20} r="2" fill={i === 2 ? '#ffc46b' : '#2b3350'} />
          </g>
        ))}
        <text x="196" y="434" className="hd-engrave" textAnchor="middle">CONTROL</text>
      </g>

      {/* chamber pedestal */}
      <rect x="382" y="356" width="36" height="64" rx="5" className="hd-surf-lo" />
      <ellipse cx="400" cy="356" rx="30" ry="9" className="hd-surf-mid" />

      {/* chamber */}
      <g>
        <ellipse cx="400" cy="248" rx="80" ry="25" className="hd-surf-hi" />
        <path d="M 320 248 L 320 356 A 80 25 0 0 0 480 356 L 480 248" className="hd-surf-mid" />
        <ellipse cx="400" cy="356" rx="80" ry="25" className="hd-surf-lo" />
        <path d="M 320 248 L 320 356 A 80 25 0 0 0 480 356 L 480 248" fill="none" stroke="#3b4a77" strokeWidth="1" />
        <ellipse cx="400" cy="248" rx="62" ry="17" className="hd-surf-lit" opacity="0.55" />
        <Bolts cx={400} cy={248} rx={58} ry={15} n={12} />
        {/* viewport */}
        <ellipse cx="400" cy="315" rx="52" ry="42" fill="#eef3f4" stroke="#5f5d57" strokeWidth="1.1" />
        <Bolts cx={400} cy={315} rx={57} ry={46} n={10} />
        <ellipse cx="400" cy="315" rx="44" ry="35" fill="none" stroke="#7ce7ff" strokeOpacity="0.18" />
        {/* trap electrodes */}
        {[300, 310, 326, 336].map((y, i) => (
          <line key={y} x1="362" y1={y} x2="438" y2={y} stroke="#ffc46b" strokeWidth={i === 1 || i === 2 ? 3 : 2} opacity="0.8" />
        ))}
        {[382, 391, 400, 409, 418].map((x, i) => (
          <circle key={x} cx={x} cy="318" r="3.4" className="hd-atom" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
        {/* flanges */}
        <rect x="310" y="300" width="14" height="30" rx="3" className="hd-surf-hi" />
        <rect x="476" y="300" width="14" height="30" rx="3" className="hd-surf-hi" />
        <rect x="392" y="218" width="16" height="16" rx="3" className="hd-surf-hi" />
        <rect x="388" y="210" width="24" height="7" rx="2" className="hd-surf-lo" />
      </g>

      {/* laser beams */}
      <path d="M 598 300 L 500 312 L 452 314" className="hd-beam-line ion" />
      <path d="M 598 326 L 510 330 L 452 326" className="hd-beam-line ion dim" />
      <path d="M 598 352 L 520 350 L 452 332" className="hd-beam-line ion dim" />

      {/* laser rack */}
      <g>
        <polygon className="hd-surf-lo" points="566,278 626,263 626,380 566,395" />
        <polygon className="hd-surf-mid" points="566,278 626,263 646,271 586,286" />
        <polygon className="hd-surf-hi" points="626,263 646,271 646,389 626,380" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="572" y={290 + i * 26} width="48" height="18" rx="2" fill="#0a0e1c" opacity="0.84" />
            <rect x="577" y={295 + i * 26} width="22" height="8" rx="2" fill="#5ee2a8" opacity={0.7 - i * 0.15} />
            <circle cx="612" cy={299 + i * 26} r="2" fill="#62e0f2" />
          </g>
        ))}
        <text x="600" y="412" className="hd-engrave" textAnchor="middle">LASERS</text>
      </g>

      {/* ion pump */}
      <g>
        <rect x="368" y="402" width="64" height="38" rx="5" className="hd-surf-mid" />
        <rect x="376" y="410" width="48" height="6" rx="2" fill="#0a0e1c" opacity="0.8" />
        <rect x="376" y="421" width="34" height="3" rx="1.5" fill="#5ee2a8" opacity="0.5" />
        <rect x="384" y="440" width="32" height="10" rx="2" className="hd-surf-lo" />
      </g>

      {/* camera + RF box */}
      <g>
        <polygon className="hd-surf-mid" points="486,430 540,416 540,452 486,466" />
        <polygon className="hd-surf-hi" points="486,430 540,416 552,422 498,436" />
        <circle cx="500" cy="448" r="8" fill="#05070f" stroke="#62e0f2" strokeOpacity="0.5" />
        <circle cx="500" cy="448" r="3.4" fill="#62e0f2" opacity="0.85" />
      </g>
      <g>
        <polygon className="hd-surf-mid" points="276,444 328,431 328,458 276,471" />
        <polygon className="hd-surf-hi" points="276,444 328,431 338,436 286,449" />
        <rect x="286" y="451" width="28" height="4" rx="2" fill="#ffc46b" opacity="0.6" />
      </g>

      {hot('chamber', 1, 'UHV chamber', 318, 258)}
      {hot('chain', 2, 'Ion chain', 400, 282)}
      {hot('electrodes', 3, 'Blade electrodes', 448, 304)}
      {hot('lasers', 4, 'Laser rack', 566, 262)}
      {hot('camera', 5, 'Fluorescence camera', 522, 420)}
      {hot('rf', 6, 'RF resonator', 300, 446)}
      {hot('pump', 7, 'Ion pump', 430, 410)}

      <text x="400" y="586" className="hd-engrave" textAnchor="middle">TRAPPED-ION PROCESSOR · CUTAWAY</text>
    </svg>
  )
}

export function PhotonicMachine({ part, onPart }: { part: string; onPart: (id: string) => void }) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )
  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric diagram of a photonic quantum computer with squeezed light, a photonic chip and SNSPD detectors">
      <Defs id="ph" />
      <TableBase />

      {/* control rack */}
      <g>
        <polygon className="hd-surf-lo" points="150,300 212,285 212,404 150,420" />
        <polygon className="hd-surf-mid" points="150,300 212,285 234,293 172,308" />
        <polygon className="hd-surf-hi" points="212,285 234,293 234,412 212,404" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="156" y={312 + i * 22} width="48" height="15" rx="2" fill="#0a0e1c" opacity="0.84" />
            <circle cx="164" cy={319 + i * 22} r="2" fill={i < 2 ? '#62e0f2' : '#9b7cff'} />
          </g>
        ))}
        <text x="190" y="438" className="hd-engrave" textAnchor="middle">CONTROL</text>
      </g>

      {/* squeezed light source */}
      <g>
        <polygon className="hd-surf-lo" points="214,352 292,334 292,392 214,410" />
        <polygon className="hd-surf-mid" points="214,352 292,334 314,342 236,360" />
        <polygon className="hd-surf-hi" points="292,334 314,342 314,400 292,392" />
        <rect x="222" y="362" width="56" height="10" rx="2" fill="#0a0e1c" opacity="0.8" />
        <rect x="226" y="366" width="22" height="3" rx="1.5" fill="#5ee2a8" opacity="0.7" />
        <circle cx="264" cy="367" r="2.4" fill="#ffc46b" />
        <text x="264" y="390" className="hd-plate-label" textAnchor="middle">SQUEEZER</text>
      </g>

      {/* fibre run source -> chip */}
      <path d="M 292 378 C 320 396 338 404 362 410" fill="none" stroke="#5ee2a8" strokeOpacity="0.55" strokeWidth="2.4" strokeDasharray="7 5" />
      <path d="M 292 386 C 320 404 338 412 362 418" fill="none" stroke="#5ee2a8" strokeOpacity="0.25" strokeWidth="2" />

      {/* photonic chip on a stage */}
      <g>
        <polygon className="hd-surf-lo" points="350,442 470,412 470,436 350,466" />
        <polygon className="hd-surf-mid" points="358,414 462,388 470,412 350,442" />
        <polygon className="hd-surf-hi" points="358,414 462,388 462,400 358,426" />
        {/* waveguides */}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M ${368 + i * 6} ${428 - i * 3} C 392 ${420 - i * 3}, 414 ${420 - i * 3}, 434 ${410 - i * 3} L 458 ${402 - i * 3}`}
            fill="none"
            stroke="#5ee2a8"
            strokeOpacity={0.45 + i * 0.1}
            strokeWidth="1.4"
          />
        ))}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={388 + i * 20} y={416 - i * 4} width="8" height="4" rx="1" fill="#9b7cff" opacity="0.8" />
        ))}
        <text x="410" y="452" className="hd-plate-label" textAnchor="middle">PHOTONIC CHIP</text>
      </g>

      {/* fibre chip -> detectors */}
      <path d="M 462 400 C 500 388 520 372 540 360" fill="none" stroke="#5ee2a8" strokeOpacity="0.55" strokeWidth="2.2" strokeDasharray="6 5" />
      <path d="M 458 412 C 500 402 522 388 542 376" fill="none" stroke="#ff7aa8" strokeOpacity="0.4" strokeWidth="1.8" />

      {/* detector cryostat */}
      <g>
        <ellipse cx="584" cy="330" rx="36" ry="12" className="hd-surf-hi" />
        <rect x="548" y="330" width="72" height="70" className="hd-surf-mid" />
        <ellipse cx="584" cy="400" rx="36" ry="12" className="hd-surf-lo" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="556" y={340 + i * 18} width="56" height="11" rx="2" fill="#0a0e1c" opacity="0.75" />
            <circle cx="564" cy={345 + i * 18} r="2" fill="#ff7aa8" />
          </g>
        ))}
        <path d="M 584 330 L 584 300 L 560 300" fill="none" stroke="#62e0f2" strokeOpacity="0.4" strokeWidth="2" />
        <text x="584" y="418" className="hd-engrave" textAnchor="middle">SNSPD</text>
      </g>

      {/* tabletop optical elements */}
      <g>
        {[
          [318, 388],
          [332, 384],
          [346, 380],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="7" height="12" rx="1" className="hd-surf-hi" />
            <line x1={x + 3.5} y1={y} x2={x + 3.5} y2={y - 8} stroke="#62e0f2" strokeOpacity="0.5" />
          </g>
        ))}
      </g>

      {hot('source', 1, 'Squeezed-light source', 238, 336)}
      {hot('fiber', 2, 'Fibre coupling', 330, 414)}
      {hot('chip', 3, 'Photonic chip', 386, 440)}
      {hot('phase', 4, 'Phase shifters', 432, 410)}
      {hot('detectors', 5, 'SNSPD detectors', 560, 346)}
      {hot('cryo', 6, 'Detector cryostat', 620, 392)}
      {hot('control', 7, 'Bias and timing', 186, 294)}

      <text x="400" y="586" className="hd-engrave" textAnchor="middle">PHOTONIC PROCESSOR · CUTAWAY</text>
    </svg>
  )
}

export function NvMachine({ part, onPart }: { part: string; onPart: (id: string) => void }) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )
  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric diagram of a diamond nitrogen-vacancy scanning magnetometer">
      <Defs id="nv" />
      <TableBase />

      {/* rack */}
      <g>
        <polygon className="hd-surf-lo" points="158,300 220,285 220,404 158,420" />
        <polygon className="hd-surf-mid" points="158,300 220,285 242,293 180,308" />
        <polygon className="hd-surf-hi" points="220,285 242,293 242,412 220,404" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="164" y={312 + i * 22} width="48" height="15" rx="2" fill="#0a0e1c" opacity="0.84" />
            <circle cx="172" cy={319 + i * 22} r="2" fill={i === 1 ? '#5ee2a8' : '#62e0f2'} />
          </g>
        ))}
        <text x="198" y="438" className="hd-engrave" textAnchor="middle">CONTROL</text>
      </g>

      {/* green pump laser */}
      <polygon className="hd-surf-lo" points="262,369 314,356 314,392 262,405" />
      <g>
        <polygon className="hd-surf-lo" points="252,318 324,301 324,352 252,369" />
        <polygon className="hd-surf-mid" points="252,318 324,301 344,308 272,325" />
        <polygon className="hd-surf-hi" points="324,301 344,308 344,359 324,352" />
        <rect x="260" y="328" width="54" height="10" rx="2" fill="#0a0e1c" opacity="0.8" />
        <rect x="264" y="332" width="24" height="3" rx="1.5" fill="#5ee2a8" opacity="0.85" />
        <text x="298" y="362" className="hd-plate-label" textAnchor="middle">532 nm</text>
      </g>

      {/* confocal tower */}
      <rect x="382" y="396" width="36" height="34" rx="4" className="hd-surf-lo" />
      <ellipse cx="400" cy="396" rx="26" ry="8" className="hd-surf-mid" />
      <g>
        <rect x="368" y="300" width="64" height="16" rx="3" className="hd-surf-hi" />
        <rect x="378" y="316" width="44" height="58" rx="6" className="hd-surf-mid" />
        <ellipse cx="400" cy="376" rx="22" ry="7" className="hd-surf-hi" />
        <rect x="388" y="378" width="24" height="12" rx="2" fill="#05070f" stroke="#62e0f2" strokeOpacity="0.5" />
        <rect x="386" y="390" width="28" height="6" rx="2" className="hd-surf-lit" />
        <text x="400" y="294" className="hd-plate-label" textAnchor="middle">OBJECTIVE</text>
      </g>

      {/* dichroic + APD */}
      <g>
        <polygon className="hd-surf-hi" points="380,272 420,262 420,278 380,288" />
        <polygon className="hd-surf-lo" points="380,288 420,278 420,284 380,294" />
        <path d="M 400 262 L 400 226 L 486 226" fill="none" stroke="#ff7aa8" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="508" cy="226" r="10" fill="#0a0e1c" stroke="#ff7aa8" strokeOpacity="0.6" />
        <circle cx="508" cy="226" r="4" fill="#ff7aa8" opacity="0.8" />
        <rect x="496" y="240" width="24" height="8" rx="2" className="hd-surf-lo" />
        <text x="522" y="258" className="hd-plate-label">APD</text>
      </g>
      <path d="M 324 334 L 366 300 L 400 288" fill="none" stroke="#5ee2a8" strokeOpacity="0.55" strokeWidth="2.4" />
      <path d="M 400 288 L 400 262" fill="none" stroke="#5ee2a8" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="4 4" />

      {/* diamond + stage */}
      <g>
        <polygon className="hd-surf-lo" points="340,430 460,400 460,424 340,454" />
        <polygon className="hd-surf-mid" points="350,414 450,388 460,400 340,430" />
        <polygon className="hd-surf-hi" points="350,414 450,388 450,398 350,424" />
        <polygon points="382,406 418,397 430,406 394,415" fill="#9ff3ff" opacity="0.55" />
        <polygon points="382,406 394,415 394,423 382,414" fill="#62e0f2" opacity="0.28" />
        <polygon points="394,415 430,406 430,414 394,423" fill="#62e0f2" opacity="0.18" />
        <circle cx="406" cy="409" r="4" fill="#ff7aa8" />
        <text x="400" y="446" className="hd-plate-label" textAnchor="middle">DIAMOND</text>
      </g>

      {/* magnet coils */}
      <ellipse cx="400" cy="390" rx="70" ry="20" fill="none" stroke="#ffc46b" strokeWidth="4" opacity="0.55" />
      <ellipse cx="400" cy="404" rx="70" ry="20" fill="none" stroke="#ffc46b" strokeWidth="3" opacity="0.35" />

      {/* microwave antenna */}
      <path d="M 430 388 L 470 384 L 470 356" fill="none" stroke="#9b7cff" strokeOpacity="0.65" strokeWidth="2" />
      <circle cx="470" cy="354" r="4" fill="#9b7cff" />

      {hot('laser', 1, 'Green pump laser', 270, 300)}
      {hot('objective', 2, 'Confocal objective', 400, 312)}
      {hot('nv', 3, 'NV centre qubit', 406, 409)}
      {hot('diamond', 4, 'Diamond sample', 360, 420)}
      {hot('magnet', 5, 'Bias magnet', 334, 392)}
      {hot('microwave', 6, 'Microwave antenna', 474, 372)}
      {hot('apd', 7, 'Single-photon counter', 508, 212)}
      {hot('stage', 8, 'Nanopositioner', 430, 436)}

      <text x="400" y="586" className="hd-engrave" textAnchor="middle">NV SCANNING MAGNETOMETER · CUTAWAY</text>
    </svg>
  )
}

export function SiliconMachine({ part, onPart }: { part: string; onPart: (id: string) => void }) {
  const hot = (id: string, n: number, label: string, x: number, y: number) => (
    <Hotspot x={x} y={y} n={n} label={label} active={part === id} onClick={() => onPart(id)} />
  )
  return (
    <svg className="hd-svg" viewBox="0 0 760 620" role="img" aria-label="Isometric cutaway of a silicon spin-qubit cryostat with a quantum dot chip">
      <Defs id="si" />
      <ellipse className="hd-ground-shadow" cx="390" cy="552" rx="250" ry="40" fill="#6b6860" opacity="0.2" />

      {/* frame */}
      <rect x="250" y="118" width="270" height="12" rx="4" className="hd-surf-hi" />
      <rect x="240" y="104" width="290" height="14" rx="5" className="hd-surf-mid" />
      <polygon className="hd-surf-lo" points="258,130 274,130 274,548 258,548" />
      <polygon className="hd-surf-lo" points="488,130 504,130 504,548 488,548" />
      <polygon className="hd-surf-lo" points="258,536 504,536 504,548 258,548" />

      {/* cryostat plates */}
      {[
        { y: 178, w: 140 },
        { y: 222, w: 124 },
        { y: 266, w: 108 },
        { y: 310, w: 92 },
        { y: 354, w: 76 },
      ].map((p, i) => (
        <g key={p.y}>
          <ellipse cx="392" cy={p.y} rx={p.w} ry={p.w * 0.24} className={i === 0 ? 'hd-surf-hi' : 'hd-surf-mid'} />
          <ellipse cx="392" cy={p.y + 8} rx={p.w} ry={p.w * 0.24} className="hd-surf-lo" />
          <rect x={392 - p.w} y={p.y} width={p.w * 2} height="8" className="hd-surf-lo" />
          <Bolts cx={392} cy={p.y} rx={p.w - 10} ry={(p.w - 10) * 0.24} n={10} />
        </g>
      ))}
      <rect x="386" y="122" width="12" height="250" rx="3" className="hd-surf-mid" />
      <rect x="380" y="168" width="24" height="22" rx="4" className="hd-surf-hi" />
      <rect x="378" y="212" width="28" height="26" rx="4" className="hd-surf-hi" />
      <rect x="380" y="256" width="24" height="28" rx="4" className="hd-surf-hi" />

      {/* sample + magnet */}
      <g>
        <ellipse cx="392" cy="382" rx="60" ry="16" fill="none" stroke="#ffc46b" strokeWidth="5" opacity="0.55" />
        <ellipse cx="392" cy="394" rx="60" ry="16" fill="none" stroke="#ffc46b" strokeWidth="3" opacity="0.32" />
        <rect x="348" y="392" width="88" height="12" rx="3" className="hd-surf-hi" />
        <polygon className="hd-surf-mid" points="360,404 424,404 436,418 372,418" />
        <rect x="372" y="418" width="64" height="9" rx="2" className="hd-surf-lo" />
        <rect x="380" y="427" width="48" height="6" rx="1.5" fill="#0a0e1c" />
        {/* chip */}
        <polygon className="hd-surf-lit" points="382,400 424,392 436,400 394,408" />
        <polygon className="hd-surf-hi" points="382,400 394,408 394,414 382,406" />
        <polygon className="hd-surf-mid" points="394,408 436,400 436,406 394,414" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={390 + i * 8} cy={401 + i * 0.1} r="2" fill="#9b7cff" className="hd-atom" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
        <text x="410" y="446" className="hd-plate-label" textAnchor="middle">QUANTUM DOT CHIP</text>
      </g>

      {/* wiring */}
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${322 + i * 4} 178 C ${338 + i * 3} 260, ${344 + i * 3} 340, ${366 + i * 6} 392`}
          fill="none"
          stroke={i % 2 ? '#ffc46b' : '#62e0f2'}
          strokeOpacity="0.28"
          strokeWidth="1.6"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={`r${i}`}
          d={`M ${462 - i * 4} 178 C ${446 - i * 3} 260, ${440 - i * 3} 340, ${428 - i * 6} 392`}
          fill="none"
          stroke="#9b7cff"
          strokeOpacity="0.26"
          strokeWidth="1.6"
        />
      ))}

      {/* racks */}
      <g>
        <polygon className="hd-surf-lo" points="96,304 166,286 166,440 96,458" />
        <polygon className="hd-surf-mid" points="96,304 166,286 190,294 120,312" />
        <polygon className="hd-surf-hi" points="166,286 190,294 190,448 166,440" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="103" y={318 + i * 28} width="52" height="18" rx="2" fill="#0a0e1c" opacity="0.84" />
            <circle cx="112" cy={327 + i * 28} r="2.2" fill={i % 2 ? '#62e0f2' : '#5ee2a8'} />
            <rect x="122" y={324 + i * 28} width="26" height="5" rx="2" fill="#9b7cff" opacity="0.5" />
          </g>
        ))}
        <text x="128" y="474" className="hd-engrave" textAnchor="middle">CONTROL</text>
      </g>
      <g>
        <polygon className="hd-surf-lo" points="594,304 664,286 664,440 594,458" />
        <polygon className="hd-surf-mid" points="594,304 664,286 688,294 618,312" />
        <polygon className="hd-surf-hi" points="664,286 688,294 688,448 664,440" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="601" y={318 + i * 28} width="52" height="18" rx="2" fill="#0a0e1c" opacity="0.84" />
            <rect x="607" y={324 + i * 28} width="20" height="5" rx="2" fill="#ffc46b" opacity="0.55" />
            <circle cx="644" cy={327 + i * 28} r="2.2" fill="#ff7aa8" />
          </g>
        ))}
        <text x="632" y="474" className="hd-engrave" textAnchor="middle">RF / MAGNET</text>
      </g>

      <path d="M 166 292 C 210 250 236 206 300 156" fill="none" stroke="#62e0f2" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 4" />
      <path d="M 594 292 C 550 250 524 206 484 156" fill="none" stroke="#ffc46b" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="5 4" />

      {hot('fridge', 1, 'Dilution refrigerator', 300, 178)}
      {hot('chip', 2, 'Quantum dot chip', 410, 400)}
      {hot('dots', 3, 'Electron spin qubits', 392, 386)}
      {hot('gates', 4, 'Gate electrodes', 440, 416)}
      {hot('magnet', 5, 'Vector magnet', 336, 382)}
      {hot('rf', 6, 'RF reflectometry', 632, 300)}
      {hot('readout', 7, 'Charge sensing', 494, 442)}

      <text x="392" y="592" className="hd-engrave" textAnchor="middle">SILICON SPIN-QUBIT CRYOSTAT · CUTAWAY</text>
    </svg>
  )
}

export interface MachineDef {
  id: string
  name: string
  short: string
  caption: string
  parts: MachinePart[]
}

export const MACHINES: MachineDef[] = [
  { id: 'atom', name: 'Neutral atoms', short: 'Neutral atoms', caption: 'Cold-atom processor · optical table', parts: ATOM_PARTS },
  { id: 'super', name: 'Superconducting', short: 'Superconducting', caption: 'Dilution refrigerator · qubit chip', parts: SUPER_PARTS },
  { id: 'ion', name: 'Trapped ions', short: 'Trapped ions', caption: 'Paul trap · laser-addressed ion chain', parts: ION_PARTS },
  { id: 'photonic', name: 'Photonic', short: 'Photonic', caption: 'Photonic chip · squeezed light · SNSPDs', parts: PHOTONIC_PARTS },
  { id: 'nv', name: 'Diamond NV', short: 'Diamond NV', caption: 'Confocal microscope · NV ensemble', parts: NV_PARTS },
  { id: 'silicon', name: 'Silicon spin', short: 'Silicon spin', caption: 'Cryostat · gate-defined quantum dots', parts: SILICON_PARTS },
]
