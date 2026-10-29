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
      <ellipse cx="400" cy="545" rx="270" ry="42" fill="#000" opacity="0.38" />
      <ellipse cx="400" cy="545" rx="270" ry="42" fill="url(#hd-glow)" opacity="0.25" />

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
        <path d="M 324 300 L 324 404 A 76 26 0 0 0 476 404 L 476 300" className="hd-surf-mid" />
        <ellipse cx="400" cy="404" rx="76" ry="26" className="hd-surf-lo" />
        <ellipse cx="400" cy="300" rx="66" ry="21" className="hd-surf-lit" opacity="0.5" />
        <ellipse cx="400" cy="300" rx="52" ry="16" fill="#05070f" opacity="0.8" />
        {/* glass cell */}
        <path d="M 356 316 L 356 392 A 44 15 0 0 0 444 392 L 444 316 A 44 15 0 0 1 356 316 Z" fill="url(#hd-glass)" stroke="#7ce7ff" strokeOpacity="0.35" />
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
        <circle cx="400" cy="356" r="46" fill="url(#hd-glow)" opacity="0.5" />
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

      <ellipse cx="390" cy="552" rx="250" ry="40" fill="#000" opacity="0.4" />
      <ellipse cx="390" cy="552" rx="250" ry="40" fill="url(#hd-chip-glow)" opacity="0.2" />

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
      <circle cx="392" cy="392" r="34" fill="url(#hd-chip-glow)" />

      {/* chip and sample holder */}
      <rect x="356" y="430" width="72" height="12" rx="3" className="hd-surf-hi" />
      <rect x="368" y="418" width="48" height="14" rx="2" fill="#0b1020" stroke="#9b7cff" strokeOpacity="0.6" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={372 + i * 11} y="422" width="6" height="6" rx="1" fill="#9b7cff" opacity={0.35 + i * 0.15} />
      ))}
      <circle cx="392" cy="425" r="30" fill="url(#hd-chip-glow)" opacity="0.7" />

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
