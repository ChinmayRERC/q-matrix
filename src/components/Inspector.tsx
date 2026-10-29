/**
 * Right-hand analysis rail: live insights, complexity metrics, and an editor for
 * the currently selected gate. Everything shown here is derived from the circuit
 * and the simulation result, never from a separate source of truth.
 */
import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles, Trash2, Wand2, Info } from 'lucide-react'
import { GATE_LIBRARY, type GateKind } from '../lib/quantum/core'
import { describeGate, type Circuit, type Gate } from '../lib/quantum/circuit'
import { summarizeDensity, summarizeState } from '../lib/quantum/analysis'
import type { SimResult } from '../lib/quantum/simulator'
import { evaluateHardware, formatDuration, type DeviceId } from '../lib/quantum/hardware'
import { analyzeCircuit, gateInventory, scoreComplexity, type Insight } from '../lib/insights'
import { Panel, Pill, Btn, Empty } from './ui'

const LEVEL_ICON = {
  error: <AlertTriangle size={13} />,
  warning: <AlertTriangle size={13} />,
  win: <CheckCircle2 size={13} />,
  tip: <Lightbulb size={13} />,
} as const

const LEVEL_TONE = {
  error: 'pink',
  warning: 'amber',
  win: 'green',
  tip: 'cyan',
} as const

export function Inspector({
  circuit,
  sim,
  deviceId,
  selectedId,
  onPatch,
  onDelete,
  onOptimize,
  onExplain,
}: {
  circuit: Circuit
  sim: SimResult | null
  deviceId: DeviceId
  selectedId: string | null
  onPatch: (id: string, patch: Partial<Gate>) => void
  onDelete: (id: string) => void
  onOptimize: () => void
  onExplain: (insight: Insight) => void
}) {
  const insights = useMemo(() => analyzeCircuit(circuit, sim ?? undefined), [circuit, sim])
  const complexity = useMemo(() => scoreComplexity(circuit), [circuit])
  const inventory = useMemo(() => gateInventory(circuit), [circuit])
  const report = useMemo(() => evaluateHardware(circuit, deviceId), [circuit, deviceId])
  const summary = useMemo(
    () => (sim ? (sim.rho ? summarizeDensity(sim.rho, sim.numQubits) : summarizeState(sim.state, sim.numQubits)) : null),
    [sim],
  )
  const gate = circuit.gates.find((g) => g.id === selectedId) ?? null

  return (
    <div className="stack gap-14">
      {gate && (
        <Panel title="Selected gate" sub={describeGate(gate)} tight actions={<Pill tone="violet">{GATE_LIBRARY[gate.kind].name}</Pill>}>
          <div className="stack gap-10">
            <div className="row gap-8 wrap">
              <span className="tiny dim" style={{ minWidth: 46 }}>Qubits</span>
              {gate.qubits.map((q, slot) => (
                <select
                  key={slot}
                  className="code-area"
                  style={{ width: 74, minHeight: 0, padding: '5px 7px', fontSize: 11 }}
                  value={q}
                  onChange={(e) => {
                    const next = [...gate.qubits]
                    next[slot] = Number(e.target.value)
                    onPatch(gate.id, { qubits: next })
                  }}
                >
                  {Array.from({ length: circuit.numQubits }, (_, i) => (
                    <option key={i} value={i}>
                      q{i}
                    </option>
                  ))}
                </select>
              ))}
              <div className="grow" />
              <div className="row gap-4">
                <button className="icon-btn" title="Move one column earlier" onClick={() => onPatch(gate.id, { column: Math.max(0, gate.column - 1) })}>
                  ←
                </button>
                <span className="pill mono">col {gate.column}</span>
                <button className="icon-btn" title="Move one column later" onClick={() => onPatch(gate.id, { column: gate.column + 1 })}>
                  →
                </button>
              </div>
            </div>

            {gate.params.map((p, i) => (
              <div className="param-row" key={i}>
                <label>{['θ', 'φ', 'λ'][i] ?? `p${i}`}</label>
                <input
                  type="range"
                  min={0}
                  max={2 * Math.PI}
                  step={0.01}
                  value={p}
                  onChange={(e) => {
                    const next = [...gate.params]
                    next[i] = Number(e.target.value)
                    onPatch(gate.id, { params: next })
                  }}
                />
                <input
                  type="number"
                  step={0.01}
                  value={Number(p.toFixed(3))}
                  onChange={(e) => {
                    const next = [...gate.params]
                    next[i] = Number(e.target.value)
                    onPatch(gate.id, { params: next })
                  }}
                />
                <span className="tiny dim mono">{(p / Math.PI).toFixed(2)}π</span>
              </div>
            ))}

            {gate.kind !== 'M' && gate.kind !== 'BARRIER' && (
              <div className="row gap-8 wrap">
                <label className="row gap-6 tiny muted" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!gate.condition}
                    onChange={(e) =>
                      onPatch(gate.id, {
                        condition: e.target.checked ? { qubit: 0, value: 1 } : undefined,
                      })
                    }
                  />
                  Classically controlled
                </label>
                {gate.condition && (
                  <>
                    <select
                      className="code-area"
                      style={{ width: 70, minHeight: 0, padding: '4px 6px', fontSize: 11 }}
                      value={gate.condition.qubit}
                      onChange={(e) => onPatch(gate.id, { condition: { ...gate.condition!, qubit: Number(e.target.value) } })}
                    >
                      {Array.from({ length: circuit.numQubits }, (_, i) => (
                        <option key={i} value={i}>
                          c{i}
                        </option>
                      ))}
                    </select>
                    <span className="tiny dim">=</span>
                    <select
                      className="code-area"
                      style={{ width: 54, minHeight: 0, padding: '4px 6px', fontSize: 11 }}
                      value={gate.condition.value}
                      onChange={(e) => onPatch(gate.id, { condition: { ...gate.condition!, value: Number(e.target.value) as 0 | 1 } })}
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                    </select>
                  </>
                )}
              </div>
            )}

            <div className="row gap-6">
              <Btn size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={() => onDelete(gate.id)}>
                Delete gate
              </Btn>
              <div className="grow" />
              <span className="tiny dim">double-click a gate to delete</span>
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="Target hardware"
        sub={deviceId === 'custom' ? 'Manual noise mode' : report.device.name}
        tight
        actions={
          <Pill tone={deviceId === 'custom' ? 'slate' : report.device.id === 'ideal' ? 'green' : 'cyan'}>
            {deviceId === 'custom' ? 'custom' : report.device.connectivity === 'all-to-all' ? 'all-to-all' : 'routed'}
          </Pill>
        }
      >
        {deviceId === 'custom' ? (
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>
            You are using the manual noise slider. Pick a real device in the Backend panel to see routing, timing and
            readout costs for this exact circuit.
          </div>
        ) : (
          <div className="stack gap-8">
            <div className="cols-2">
              <div className="stat">
                <div className="k">Native 2Q</div>
                <div className="v">{report.nativeTwoQubit}</div>
                <div className="h">{report.programTwoQubit} written by you</div>
              </div>
              <div className="stat">
                <div className="k">SWAP routing</div>
                <div className="v">{report.swaps}</div>
                <div className="h">{report.swaps ? `+${Math.round(report.overhead * 100)}% gates` : 'no detours'}</div>
              </div>
            </div>
            <div className="cols-2">
              <div className="stat">
                <div className="k">Time / shot</div>
                <div className="v">{formatDuration(report.estimatedMs)}</div>
                <div className="h">depth {report.depth} · gate + readout</div>
              </div>
              <div className="stat">
                <div className="k">Readout</div>
                <div className="v" style={{ fontSize: 13 }}>{report.device.readoutLabel}</div>
                <div className="h">{report.device.connectionNote}</div>
              </div>
            </div>
            <div className={`insight ${report.swaps ? 'warning' : 'tip'}`}>
              <span className="dot" />
              <div>
                <div className="t">{report.verdict}</div>
                <div className="d">{report.device.note}</div>
              </div>
            </div>
            <div className="tiny dim">Order-of-magnitude teaching estimates, not a device datasheet.</div>
          </div>
        )}
      </Panel>

      <Panel
        title="Analysis"
        sub={summary ? summary.description : 'Structural checks run as you build.'}
        tight
        actions={
          <Btn size="sm" variant="ghost" icon={<Wand2 size={12} />} onClick={onOptimize} disabled={complexity.removable === 0} title="Remove cancelling gate pairs">
            Optimise
          </Btn>
        }
      >
        <div className="stack gap-8">
          <div className="cols-2">
            <div className="stat">
              <div className="k">Gates</div>
              <div className="v">{complexity.gates}</div>
              <div className="h">depth {complexity.depth} · cost {complexity.cost}</div>
            </div>
            <div className="stat">
              <div className="k">Entangling</div>
              <div className="v">{complexity.twoQubit}</div>
              <div className="h">{complexity.removable ? `${complexity.removable} removable` : 'no cancelling pairs'}</div>
            </div>
          </div>

          {summary && (
            <div className="cols-3">
              <div className="stat">
                <div className="k">{summary.mixed ? 'Entropy' : 'Outcome entropy'}</div>
                <div className="v">{summary.entropy.toFixed(2)}</div>
                <div className="h">bits{summary.mixed ? ' · von Neumann' : ''}</div>
              </div>
              <div className="stat">
                <div className="k">Purity</div>
                <div className="v">{summary.purity.toFixed(2)}</div>
                <div className="h">{summary.purity > 0.999 ? 'pure state' : 'mixed state'}</div>
              </div>
              <div className="stat">
                <div className="k">Entanglement</div>
                <div className="v">{summary.maxEntanglementEntropy.toFixed(2)}</div>
                <div className="h">
                  bits{summary.numQubits === 2 && !summary.mixed ? ` · C ${summary.concurrence.toFixed(2)}` : ''}
                </div>
              </div>
            </div>
          )}

          {insights.length === 0 && (
            <div className="insight win">
              <span className="dot" />
              <div>
                <div className="t">Nothing to flag</div>
                <div className="d">The circuit is structurally valid. Run it and check the distribution.</div>
              </div>
            </div>
          )}

          {insights.slice(0, 8).map((insight) => (
            <div className={`insight ${insight.level}`} key={insight.id}>
              <span className="dot" />
              <div className="grow">
                <div className="t">{insight.title}</div>
                <div className="d">{insight.detail}</div>
                {insight.fix && <div className="f">→ {insight.fix}</div>}
                <button
                  className="chip"
                  style={{ marginTop: 6, padding: '2px 8px', fontSize: 10 }}
                  onClick={() => onExplain(insight)}
                >
                  <Sparkles size={10} /> Ask Chinnu
                </button>
              </div>
              <span className={`pill ${LEVEL_TONE[insight.level]}`} style={{ alignSelf: 'flex-start' }}>
                {LEVEL_ICON[insight.level]}
              </span>
            </div>
          ))}

          {inventory.length > 0 && (
            <>
              <div className="hr-label" style={{ marginTop: 4 }}>Gate usage</div>
              <div className="row gap-6 wrap">
                {inventory.map((item) => (
                  <span className="pill mono" key={item.kind} title={item.name}>
                    {item.kind} ×{item.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </Panel>

      {circuit.gates.length === 0 && (
        <Panel tight>
          <Empty
            icon={<Info size={17} />}
            title="Tip"
            hint="Drag a gate from the palette, or tap one and then tap a wire to place it."
          />
        </Panel>
      )}
    </div>
  )
}
