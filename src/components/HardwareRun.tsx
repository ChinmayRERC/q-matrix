/**
 * Real-hardware run panel.
 *
 * Renders nothing unless the deployment has IBM credentials, so the teaching
 * app looks the same without them. Submission is asynchronous: the job id is
 * polled on demand rather than with a timer, because a queued job can take
 * minutes and an abandoned tab should not keep a poller alive.
 */
import { useEffect, useState } from 'react'
import { Play, RefreshCw } from 'lucide-react'
import { API_BASE } from '../lib/api'
import type { Circuit } from '../lib/quantum/circuit'
import { Btn, Panel, Pill } from './ui'

interface Status {
  available: boolean
  backend: string | null
  reason: string | null
}

interface Job {
  jobId: string
  backend: string
  shots: number
  state?: string
  counts?: Record<string, number>
}

export function HardwareRun({ circuit, shots }: { circuit: Circuit; shots: number }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/hardware/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ available: false, backend: null, reason: 'API offline' }))
  }, [])

  if (!status?.available) return null

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/hardware/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuit: {
            numQubits: circuit.numQubits,
            gates: circuit.gates.map((g) => ({
              kind: g.kind,
              qubits: g.qubits,
              params: g.params,
              column: g.column,
            })),
          },
          shots,
        }),
      })
      const body = (await response.json()) as Job & { detail?: string }
      if (!response.ok) throw new Error(body.detail || `Submission failed (${response.status})`)
      setJob(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!job) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/hardware/jobs/${job.jobId}`)
      const body = (await response.json()) as Job & { detail?: string }
      if (!response.ok) throw new Error(body.detail || `Poll failed (${response.status})`)
      setJob(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const counts = job?.counts ? Object.entries(job.counts).sort((a, b) => b[1] - a[1]).slice(0, 8) : null

  return (
    <Panel
      title="Real hardware"
      sub={`IBM Quantum${status.backend ? ` · ${status.backend}` : ' · least busy backend'}`}
      tight
      actions={<Pill tone="cyan">live device</Pill>}
    >
      <div className="stack gap-10">
        <p className="tiny muted" style={{ lineHeight: 1.55 }}>
          Submit this exact circuit to IBM and compare the counts with the noisy simulator. Queue time is usually
          minutes; the job id below survives this page but not a server restart.
        </p>
        <div className="row gap-8 wrap">
          <Btn variant="cyan" icon={<Play size={13} />} onClick={submit} disabled={busy || circuit.gates.length === 0}>
            {busy ? 'Working…' : job ? 'Submit again' : `Run ${shots.toLocaleString()} shots`}
          </Btn>
          {job && !job.counts && (
            <Btn icon={<RefreshCw size={13} />} onClick={refresh} disabled={busy}>
              Check job
            </Btn>
          )}
        </div>
        {job && (
          <div className="stack gap-6">
            <div className="row gap-8">
              <span className="tiny dim mono">{job.jobId}</span>
              {job.state && <Pill tone={job.counts ? 'green' : 'amber'}>{job.state.toLowerCase()}</Pill>}
            </div>
            {counts && (
              <div className="stack gap-4">
                {counts.map(([bits, n]) => (
                  <div key={bits} className="row gap-8">
                    <span className="tiny mono">{bits.split('').reverse().join('')}</span>
                    <span className="tiny dim grow">{((n / job.shots) * 100).toFixed(1)}%</span>
                    <span className="tiny mono">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p className="tiny" style={{ color: 'var(--red)' }}>{error}</p>}
      </div>
    </Panel>
  )
}
