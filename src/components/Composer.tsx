/**
 * The circuit workbench: gate palette, drag-and-drop board, live simulation,
 * QASM / SDK exchange and the numpy cross-check.
 *
 * The circuit itself lives in the persisted store so the learner can jump to a
 * lesson and come back without losing their build. Undo history is local to the
 * composer because it is a editing session, not permanent progress.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Braces,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  Copy,
  Download,
  FlaskConical,
  Layers,
  Play,
  RotateCcw,
  Server,
  Trash2,
  Upload,
  Undo2,
  Redo2,
  WifiOff,
  Plus,
  Minus,
  Zap,
} from 'lucide-react'
import {
  GATE_LIBRARY,
  PALETTE_ORDER,
  type GateKind,
  type GateCategory,
} from '../lib/quantum/core'
import {
  addGate,
  canPlace,
  emptyCircuit,
  moveGate,
  removeGate,
  updateGate,
  validateCircuit,
  type Circuit,
  type Gate,
} from '../lib/quantum/circuit'
import { NOISE_PRESETS, simulate, type SimResult } from '../lib/quantum/simulator'
import {
  DEVICES,
  DEVICE_LIST,
  deviceById,
  deviceNoise,
  evaluateHardware,
  formatDuration,
  type DeviceId,
} from '../lib/quantum/hardware'
import { TEMPLATES, templateById } from '../lib/quantum/templates'
import { parseQasm, toCirqPython, toPennyLanePython, toQasm, toQiskitPython } from '../lib/quantum/qasm'
import { circuitVerdict, matchTemplate, optimizeCircuit } from '../lib/insights'
import { API_BASE } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { Btn, Chip, Modal, Panel, Pill, Tabs } from './ui'
import { CircuitBoard, GATE_MIME, MOVE_MIME } from './CircuitBoard'
import { Histogram, StatePanel } from './Visuals'
import { Inspector } from './Inspector'
import { HardwareRun } from './HardwareRun'
import { TutorPanel } from './TutorPanel'

const GROUPS: Array<{ label: string; categories: GateCategory[] }> = [
  { label: 'Prepare', categories: ['basis'] },
  { label: 'Phase', categories: ['phase'] },
  { label: 'Rotate', categories: ['rotation'] },
  { label: 'Entangle', categories: ['controlled'] },
  { label: 'Multi-qubit', categories: ['multi'] },
  { label: 'Measure', categories: ['measure', 'utility'] },
]

type ModalKind = null | 'templates' | 'import' | 'export' | 'crosscheck'

export function Composer({
  embedded = false,
  initialTemplate,
  onSolved,
}: {
  embedded?: boolean
  initialTemplate?: string
  onSolved?: () => void
}) {
  const circuit = useAppStore((s) => s.circuit)
  const setCircuit = useAppStore((s) => s.setCircuit)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const toast = useAppStore((s) => s.toast)
  const inspectCircuitResult = useAppStore((s) => s.inspectCircuitResult)
  const recordNoiseRun = useAppStore((s) => s.recordNoiseRun)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [armed, setArmed] = useState<GateKind | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [seed, setSeed] = useState(1)
  const [qasmSource, setQasmSource] = useState('')
  const [qasmIssues, setQasmIssues] = useState<{ errors: string[]; warnings: string[] } | null>(null)
  const [exportTab, setExportTab] = useState<'qasm' | 'qiskit' | 'cirq' | 'pennylane'>('qasm')
  const [copied, setCopied] = useState(false)
  const [crosscheck, setCrosscheck] = useState<{ ok: boolean; detail: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [, forceRender] = useState(0)
  const history = useRef<{ past: Circuit[]; future: Circuit[] }>({ past: [], future: [] })

  const deviceId: DeviceId = settings.device ?? 'ideal'
  const device = deviceById(deviceId)

  const chooseDevice = (id: DeviceId) => {
    const profile = deviceById(id)
    setSettings({
      device: id,
      noisy: !!profile && profile.noise.depolarizing > 0,
      // Keep the learner's manual level when switching back to ideal/custom.
      noiseLevel: profile && profile.noise.depolarizing > 0 ? profile.noise.depolarizing : settings.noiseLevel,
    })
    if (profile?.noise.depolarizing) recordNoiseRun()
  }

  // Load a lesson/challenge preset once, replacing whatever was on the canvas.
  useEffect(() => {
    if (!initialTemplate) return
    const template = templateById(initialTemplate)
    if (!template) return
    setCircuit(template.build())
    history.current = { past: [], future: [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate])

  const commit = (next: Circuit) => {
    history.current.past.push(circuit)
    if (history.current.past.length > 60) history.current.past.shift()
    history.current.future = []
    setCircuit(next)
    forceRender((v) => v + 1)
  }

  const undo = () => {
    const prev = history.current.past.pop()
    if (!prev) return
    history.current.future.push(circuit)
    setCircuit(prev)
    forceRender((v) => v + 1)
  }

  const redo = () => {
    const next = history.current.future.pop()
    if (!next) return
    history.current.past.push(circuit)
    setCircuit(next)
    forceRender((v) => v + 1)
  }

  const activeNoise = useMemo(
    () =>
      deviceId === 'custom'
        ? settings.noisy
          ? {
              depolarizing: settings.noiseLevel,
              amplitudeDamping: settings.noiseLevel * 0.5,
              readoutError: settings.noiseLevel * 0.6,
            }
          : undefined
        : deviceNoise(deviceId),
    [deviceId, settings.noisy, settings.noiseLevel],
  )

  const sim = useMemo<SimResult | null>(() => {
    try {
      return simulate(circuit, { shots: settings.shots, seed, noise: activeNoise })
    } catch {
      return null
    }
  }, [circuit, settings.shots, seed, activeNoise])

  const issues = useMemo(() => validateCircuit(circuit), [circuit])
  const verdict = useMemo(() => circuitVerdict(circuit, sim ?? undefined), [circuit, sim])
  const matched = useMemo(() => matchTemplate(circuit, TEMPLATES), [circuit])
  const report = useMemo(() => evaluateHardware(circuit, deviceId), [circuit, deviceId])

  const run = () => {
    setSeed((s) => s + 1)
    if (settings.noisy) recordNoiseRun()
    try {
      const noise =
        deviceId === 'custom'
          ? settings.noisy
            ? {
                depolarizing: settings.noiseLevel,
                amplitudeDamping: settings.noiseLevel * 0.5,
                readoutError: settings.noiseLevel * 0.6,
              }
            : undefined
          : deviceNoise(deviceId)
      const result = simulate(circuit, { shots: settings.shots, seed: seed + 1, noise })
      inspectCircuitResult(result, matched)
      toast({
        title: `Ran ${circuit.gates.length} gates in ${result.durationMs.toFixed(1)} ms`,
        detail: `${result.shots.toLocaleString()} shots · ${Object.keys(result.counts).length} outcomes`,
        tone: 'info',
      })
      onSolved?.()
    } catch (err) {
      toast({ title: 'Simulation failed', detail: err instanceof Error ? err.message : 'Unknown error', tone: 'error' })
    }
  }

  const patchGate = (id: string, patch: Partial<Gate>) => {
    commit(updateGate(circuit, id, patch))
  }

  const del = (id: string) => {
    commit(removeGate(circuit, id))
    if (selectedId === id) setSelectedId(null)
  }

  const place = (kind: GateKind, qubits: number[], column: number) => {
    if (!canPlace(circuit, kind, qubits, column).ok && canPlace(circuit, kind, qubits, column).reason) return
    commit(addGate(circuit, kind, qubits, column))
    setSelectedId(null)
  }

  const move = (id: string, qubits: number[], column: number) => {
    commit(moveGate(circuit, id, column, qubits))
  }

  const optimize = () => {
    const result = optimizeCircuit(circuit)
    if (!result.removed.length) return
    commit(result.circuit)
    toast({ title: `Removed ${result.removed.length} redundant gates`, detail: 'Identical self-inverse gates cancelled out.', tone: 'info' })
  }

  const setQubits = (n: number) => {
    const kept = circuit.gates.filter((g) => g.qubits.every((q) => q < n))
    commit({ ...circuit, numQubits: n, gates: kept })
    if (kept.length !== circuit.gates.length) {
      toast({ title: 'Removed out-of-range gates', detail: `The register is now ${n} qubit${n > 1 ? 's' : ''}.`, tone: 'info' })
    }
  }

  const runCrosscheck = async () => {
    setChecking(true)
    setCrosscheck(null)
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuit: {
            numQubits: circuit.numQubits,
            gates: circuit.gates.map((g) => ({ kind: g.kind, qubits: g.qubits, params: g.params, column: g.column, condition: g.condition })),
          },
          shots: 64,
          expected_probabilities: sim?.probabilities ?? undefined,
          noise: activeNoise,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(body.detail ?? `server returned ${res.status}`)
      }
      const data = (await res.json()) as { agrees?: boolean; max_abs_diff?: number; backend?: string }
      const diff = data.max_abs_diff ?? 0
      const model = data.backend === 'numpy-density' ? 'NumPy density matrix' : 'NumPy statevector'
      setCrosscheck({ ok: !!data.agrees, detail: `${model} agrees to ${diff.toExponential(2)} max abs difference.` })
    } catch (err) {
      setCrosscheck({ ok: false, detail: err instanceof Error ? err.message : 'The API is not reachable.' })
    } finally {
      setChecking(false)
    }
  }

  const exportCode =
    exportTab === 'qasm'
      ? toQasm(circuit)
      : exportTab === 'qiskit'
        ? toQiskitPython(circuit, deviceId)
        : exportTab === 'cirq'
          ? toCirqPython(circuit)
          : toPennyLanePython(circuit)

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast({ title: 'Clipboard blocked', detail: 'Select the code and copy manually.', tone: 'error' })
    }
  }

  const importQasm = () => {
    const result = parseQasm(qasmSource)
    setQasmIssues({ errors: result.errors, warnings: result.warnings })
    if (result.errors.length) return
    commit(result.circuit)
    setModal(null)
    setQasmSource('')
    toast({
      title: 'Circuit imported',
      detail: `${result.circuit.numQubits} qubits · ${result.circuit.gates.length} gates${result.warnings.length ? ` · ${result.warnings.length} warning(s)` : ''}`,
      tone: 'info',
    })
  }

  const loadTemplate = (id: string) => {
    const template = templateById(id)
    if (!template) return
    commit(template.build())
    setSelectedId(null)
    setModal(null)
    toast({ title: template.name, detail: template.tagline, tone: 'info' })
  }

  // Keyboard: delete selected gate, undo/redo, escape to disarm.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        del(selectedId)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if (e.key === 'Escape') {
        setArmed(null)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const palette = (category: GateCategory) =>
    PALETTE_ORDER.filter((k) => GATE_LIBRARY[k].category === category)

  return (
    <div className={embedded ? 'stack gap-16' : 'workbench-layout'}>
      {/* ---------------------------------------------------------------- */}
      {/* Palette + workbench toolbar                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="stack gap-14">
        <Panel title="Gates" sub="Drag onto a wire, or tap then tap" tight>
          <div className="palette">
            {GROUPS.map((group) => {
              const gates = group.categories.flatMap(palette)
              if (!gates.length) return null
              return (
                <div className="palette-group" key={group.label}>
                  <div className="eyebrow" style={{ fontSize: 9.5 }}>{group.label}</div>
                  <div className="palette-grid">
                    {gates.map((kind) => {
                      const spec = GATE_LIBRARY[kind]
                      return (
                        <button
                          key={kind}
                          type="button"
                          draggable
                          className="palette-gate"
                          data-tone={spec.tone}
                          title={`${spec.name} — ${spec.blurb}`}
                          style={armed === kind ? { outline: '2px solid var(--violet)', outlineOffset: 1 } : undefined}
                          onDragStart={(e) => {
                            ;(window as unknown as { __qgate?: GateKind }).__qgate = kind
                            e.dataTransfer.setData(GATE_MIME, kind)
                            e.dataTransfer.effectAllowed = 'copy'
                            setArmed(null)
                          }}
                          onDragEnd={() => {
                            ;(window as unknown as { __qgate?: GateKind }).__qgate = undefined
                          }}
                          onClick={() => setArmed(armed === kind ? null : kind)}
                        >
                          {spec.short}
                          <small>{spec.name.split(' ')[0]}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          {armed && (
            <div className="insight tip" style={{ marginTop: 10 }}>
              <span className="dot" />
              <div className="grow">
                <div className="t">{GATE_LIBRARY[armed].short} armed</div>
                <div className="d">Tap a wire to place it. {GATE_LIBRARY[armed].arity > 1 ? `It spans ${GATE_LIBRARY[armed].arity} qubits.` : ''}</div>
              </div>
              <button className="chip" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => setArmed(null)}>
                esc
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Backend" sub="Pick the machine the circuit must run on" tight>
          <div className="stack gap-10">
            <div className="param-row">
              <label style={{ minWidth: 44 }}>Target</label>
              <select
                className="code-area"
                style={{ minHeight: 0, padding: '5px 7px', fontSize: 11, width: 'auto', flex: 1, minWidth: 0 }}
                value={deviceId}
                onChange={(e) => chooseDevice(e.target.value as DeviceId)}
              >
                {DEVICE_LIST.map((id) => (
                  <option key={id} value={id}>
                    {id === 'custom' ? 'Custom noise' : DEVICES[id].name}
                  </option>
                ))}
              </select>
            </div>

            {device ? (
              <div className="stack gap-8">
                <div className="row gap-6 wrap">
                  <Pill tone="cyan">{device.connectivity === 'all-to-all' ? 'all-to-all' : 'nearest-neighbour'}</Pill>
                  {device.physicalQubits > 0 && <Pill tone="violet">{device.physicalQubits}q target</Pill>}
                </div>
                <div className="tiny muted">{device.connectionNote}</div>
                <div className="tiny dim mono">{device.basis.join(' · ')}</div>
                {device.id !== 'ideal' && (
                  <div className="cols-2">
                    <div className="stat" style={{ padding: 9 }}>
                      <div className="k">2Q gate</div>
                      <div className="v" style={{ fontSize: 16 }}>{formatDuration(device.twoQubitNs / 1e6)}</div>
                      <div className="h">readout {formatDuration(device.readoutNs / 1e6)}</div>
                    </div>
                    <div className="stat" style={{ padding: 9 }}>
                      <div className="k">This circuit</div>
                      <div className="v" style={{ fontSize: 16 }}>{report.nativeTwoQubit} 2Q</div>
                      <div className="h">{report.swaps ? `${report.swaps} SWAP · ` : ''}{formatDuration(report.estimatedMs)}/shot</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="row gap-6 wrap">
                  <label className="row gap-8" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.noisy}
                      onChange={(e) => {
                        setSettings({ noisy: e.target.checked })
                        if (e.target.checked) recordNoiseRun()
                      }}
                    />
                    <span className="small">Noisy hardware</span>
                  </label>
                  <span className="grow" />
                  <Pill tone={settings.noisy ? 'amber' : 'green'}>{settings.noisy ? 'mixed state' : 'ideal'}</Pill>
                </div>
                {settings.noisy && (
                  <div className="param-row">
                    <label>p</label>
                    <input
                      type="range"
                      min={0.001}
                      max={0.08}
                      step={0.001}
                      value={settings.noiseLevel}
                      onChange={(e) => setSettings({ noiseLevel: Number(e.target.value) })}
                    />
                    <span className="tiny mono dim">{settings.noiseLevel.toFixed(3)}</span>
                  </div>
                )}
                <div className="row gap-6 wrap">
                  {Object.entries(NOISE_PRESETS).map(([name, preset]) => (
                    <Chip
                      key={name}
                      on={settings.noisy && Math.abs(preset.depolarizing - settings.noiseLevel) < 1e-6}
                      onClick={() =>
                        setSettings({
                          noisy: preset.depolarizing > 0,
                          noiseLevel: preset.depolarizing > 0 ? preset.depolarizing : 0.02,
                        })
                      }
                    >
                      {name}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            <div className="param-row">
              <label style={{ minWidth: 44 }}>Shots</label>
              <select
                className="code-area"
                style={{ minHeight: 0, padding: '5px 7px', fontSize: 11, width: 'auto', flex: 1 }}
                value={settings.shots}
                onChange={(e) => setSettings({ shots: Number(e.target.value) })}
              >
                {[128, 512, 1024, 4096, 8192].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="divider" />
            <div className="row gap-6 wrap">
              <Btn size="sm" variant="ghost" icon={<Server size={12} />} onClick={() => setModal('crosscheck')} disabled={checking}>
                {checking ? 'Checking…' : 'NumPy check'}
              </Btn>
              {crosscheck && <Pill tone={crosscheck.ok ? 'green' : 'rose'}>{crosscheck.ok ? 'matches' : 'differs'}</Pill>}
            </div>
          </div>
        </Panel>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Board                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="stack gap-14" style={{ minWidth: 0 }}>
        <Panel tight>
          <div className="row gap-8 wrap" style={{ padding: '0 2px 10px' }}>
            <Btn size="sm" variant="ghost" icon={<ChevronsUpDown size={12} />} onClick={() => setModal('templates')}>
              Templates
            </Btn>
            <div className="row gap-4">
              <button className="icon-btn" onClick={undo} title="Undo (⌘Z)">
                <Undo2 size={14} />
              </button>
              <button className="icon-btn" onClick={redo} title="Redo (⇧⌘Z)">
                <Redo2 size={14} />
              </button>
            </div>
            <div className="row gap-4" title="Register size">
              <button className="icon-btn" onClick={() => setQubits(Math.max(1, circuit.numQubits - 1))} disabled={circuit.numQubits <= 1}>
                <Minus size={13} />
              </button>
              <span className="pill mono">{circuit.numQubits}q</span>
              <button className="icon-btn" onClick={() => setQubits(Math.min(6, circuit.numQubits + 1))} disabled={circuit.numQubits >= 6}>
                <Plus size={13} />
              </button>
            </div>
            <div className="grow" />
            <button className="icon-btn" title="Import OpenQASM" onClick={() => setModal('import')}>
              <Upload size={14} />
            </button>
            <button className="icon-btn" title="Export circuit" onClick={() => setModal('export')}>
              <Download size={14} />
            </button>
            <button
              className="icon-btn"
              title="Clear circuit"
              onClick={() => {
                if (!circuit.gates.length) return
                commit(emptyCircuit(circuit.numQubits, 'Untitled circuit'))
                setSelectedId(null)
              }}
            >
              <Trash2 size={14} />
            </button>
            <Btn size="sm" variant="primary" icon={<Play size={12} />} onClick={run}>
              Run
            </Btn>
          </div>

          <CircuitBoard
            circuit={circuit}
            selectedId={selectedId}
            armed={armed}
            onSelect={setSelectedId}
            onPlace={place}
            onMove={move}
            onDelete={del}
            onArmedUsed={() => setArmed(null)}
          />

          <div className="row gap-8 wrap" style={{ paddingTop: 10 }}>
            <Pill tone={issues.some((i) => i.level === 'error') ? 'pink' : 'green'}>
              {issues.some((i) => i.level === 'error') ? `${issues.filter((i) => i.level === 'error').length} error(s)` : 'valid'}
            </Pill>
            <span className="tiny dim">{verdict}</span>
            {matched && <Pill tone="violet">{matched} template</Pill>}
            {device && <Pill tone="cyan">{device.short}</Pill>}
            {sim && <span className="tiny dim mono">· solved in {sim.durationMs.toFixed(1)} ms</span>}
            <span className="grow" />
            <span className="tiny dim">⌘Z undo · Del delete · double-click a gate</span>
          </div>
        </Panel>

        <div className={embedded ? 'stack gap-14' : 'grid'} style={embedded ? undefined : { gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 14 }}>
          <Panel title="State" sub="Live statevector · replay it gate by gate" tight>
            <StatePanel sim={sim} />
          </Panel>
          <Panel title="Measurement" sub="Sampled shot histogram" tight>
            <Histogram sim={sim} expected={sim?.probabilities} />
          </Panel>
        </div>

        {embedded && (
          <TutorPanel circuit={circuit} sim={sim} askRef={undefined} height={420} />
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Inspector + tutor                                                 */}
      {/* ---------------------------------------------------------------- */}
      {!embedded && (
        <div className="stack gap-14">
          <Inspector
            circuit={circuit}
            sim={sim}
            deviceId={deviceId}
            selectedId={selectedId}
            onPatch={patchGate}
            onDelete={del}
            onOptimize={optimize}
            onExplain={(insight) => {
              window.dispatchEvent(new CustomEvent('nova-ask', { detail: `${insight.title}. ${insight.detail}` }))
            }}
          />
          <HardwareRun circuit={circuit} shots={settings.shots} />
          <TutorPanel circuit={circuit} sim={sim} />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Modals                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Modal open={modal === 'templates'} onClose={() => setModal(null)} title="Circuit templates" wide>
        <div className="card-grid">
          {TEMPLATES.map((template) => (
            <button key={template.id} className="topic-card" onClick={() => loadTemplate(template.id)} style={{ cursor: 'pointer' }}>
              <div className="row gap-6">
                <Pill tone={template.difficulty === 'starter' ? 'green' : template.difficulty === 'intermediate' ? 'amber' : 'pink'}>
                  {template.difficulty}
                </Pill>
                <span className="grow" />
                {matched === template.id && <Check size={13} color="var(--green)" />}
              </div>
              <h3>{template.name}</h3>
              <p>{template.tagline}</p>
              <div className="foot">
                <span className="tiny dim mono">{template.build().gates.length} gates</span>
                <span className="tiny" style={{ color: 'var(--violet)' }}>Load →</span>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        title="Import OpenQASM 2.0"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={importQasm} disabled={!qasmSource.trim()}>
              Import circuit
            </Btn>
          </>
        }
      >
        <div className="stack gap-10">
          <textarea
            className="code-area"
            spellCheck={false}
            placeholder={`OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0],q[1];\nmeasure q -> c;`}
            value={qasmSource}
            onChange={(e) => {
              setQasmSource(e.target.value)
              setQasmIssues(null)
            }}
          />
          {qasmIssues && (
            <div className="stack gap-6">
              {qasmIssues.errors.map((e, i) => (
                <div className="insight error" key={`e${i}`}>
                  <span className="dot" />
                  <div className="d">{e}</div>
                </div>
              ))}
              {qasmIssues.warnings.map((w, i) => (
                <div className="insight warning" key={`w${i}`}>
                  <span className="dot" />
                  <div className="d">{w}</div>
                </div>
              ))}
            </div>
          )}
          <div className="tiny dim">
            Supported: h x y z s sdg t tdg rx ry rz u cx cz swap crx cry crz ccx cswap measure barrier. Importing replaces the
            current canvas.
          </div>
        </div>
      </Modal>

      <Modal
        open={modal === 'export'}
        onClose={() => setModal(null)}
        title="Export circuit"
        wide
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModal(null)}>
              Close
            </Btn>
            <Btn variant="primary" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyExport}>
              {copied ? 'Copied' : 'Copy'}
            </Btn>
          </>
        }
      >
        <div className="stack gap-12">
          <Tabs
            tabs={[
              { id: 'qasm', label: 'OpenQASM' },
              { id: 'qiskit', label: 'Qiskit' },
              { id: 'cirq', label: 'Cirq' },
              { id: 'pennylane', label: 'PennyLane' },
            ]}
            value={exportTab}
            onChange={setExportTab}
          />
          <pre className="code">{exportCode}</pre>
          <div className="tiny dim">
            These exporters mirror the browser engine gate-for-gate. Run them with your own SDK install; the platform itself
            stays client-side.
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'crosscheck'} onClose={() => setModal(null)} title="Independent NumPy simulator" wide>
        <div className="stack gap-14">
          <p className="lead">
            The browser engine is cross-checked against a second NumPy implementation on the API server: statevector for
            ideal runs, density matrix when a noise preset is active. Agreement to ~1e-15 means the gate algebra, qubit
            ordering and noise channel are all consistent.
          </p>
          <div className="cols-3">
            <div className="stat">
              <div className="k">Client</div>
              <div className="v" style={{ fontSize: 15 }}>TypeScript</div>
              <div className="h">{circuit.numQubits} qubits · {circuit.gates.length} gates</div>
            </div>
            <div className="stat">
              <div className="k">Server</div>
              <div className="v" style={{ fontSize: 15 }}>NumPy</div>
              <div className="h">little-endian statevector</div>
            </div>
            <div className="stat accent">
              <div className="k">Result</div>
              <div className="v" style={{ fontSize: 15, color: crosscheck ? (crosscheck.ok ? 'var(--green)' : 'var(--pink)') : undefined }}>
                {checking ? '…' : crosscheck ? (crosscheck.ok ? 'Agrees' : 'Differs') : 'Not run'}
              </div>
              <div className="h">{crosscheck?.detail ?? 'Start the API with npm run api'}</div>
            </div>
          </div>
          {circuit.gates.some((g) => g.condition) && (
            <div className="insight warning">
              <span className="dot" />
              <div>
                <div className="t">Classical feed-forward detected</div>
                <div className="d">
                  The NumPy endpoint only checks deterministic circuits, because conditional gates need shot-by-shot collapse.
                  Remove the conditions to compare.
                </div>
              </div>
            </div>
          )}
          <div className="row gap-8">
            <Btn variant="primary" icon={<Server size={13} />} onClick={runCrosscheck} disabled={checking}>
              {checking ? 'Comparing…' : 'Run comparison'}
            </Btn>
            <Btn variant="ghost" icon={<FlaskConical size={13} />} onClick={() => setModal(null)}>
              Back to lab
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
