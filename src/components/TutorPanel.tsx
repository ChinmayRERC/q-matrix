/**
 * Chinnu — the AI tutor panel.
 *
 * The client never holds an API key. It posts the circuit context to /api/ai/tutor,
 * which proxies NVIDIA BUILD (preferred) or Claude server-side. If the backend is
 * down or unconfigured, the request falls back to a deterministic Socratic engine
 * in lib/tutor.ts, so the panel always answers with something grounded on screen.
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { CornerDownLeft, RefreshCw, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { analyzeCircuit } from '../lib/insights'
import { toQasm } from '../lib/quantum/qasm'
import { summarizeState } from '../lib/quantum/analysis'
import type { Circuit } from '../lib/quantum/circuit'
import type { SimResult } from '../lib/quantum/simulator'
import { askTutor, suggestQuestions, type TutorMode, type TutorSource } from '../lib/tutor'
import { useAppStore } from '../store/useAppStore'
import { Panel, Tabs, Pill } from './ui'

function renderRich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
}

const MODES: Array<{ id: TutorMode; label: string }> = [
  { id: 'explain', label: 'Explain' },
  { id: 'hint', label: 'Hint' },
  { id: 'debug', label: 'Debug' },
  { id: 'next', label: 'Next' },
]

export function TutorPanel({
  circuit,
  sim,
  topic,
  mastery,
  askRef,
  height,
}: {
  circuit: Circuit
  sim: SimResult | null
  topic?: { id: string; title: string; domainName?: string; levelName?: string } | null
  mastery?: number
  askRef?: MutableRefObject<((q: string) => void) | null>
  height?: number
}) {
  const chat = useAppStore((s) => s.chat)
  const pushChat = useAppStore((s) => s.pushChat)
  const recordQuestion = useAppStore((s) => s.recordTutorQuestion)
  const tutorEnabled = useAppStore((s) => s.settings.tutorEnabled)

  const [mode, setMode] = useState<TutorMode>('explain')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSource, setLastSource] = useState<TutorSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const controller = useRef<AbortController | null>(null)

  const insights = analyzeCircuit(circuit, sim ?? undefined)
  const summary = sim ? summarizeState(sim.state, sim.numQubits) : null

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat.length, busy])

  useEffect(() => {
    return () => controller.current?.abort()
  }, [])

  const send = async (question: string) => {
    const text = question.trim()
    if (!text || busy) return
    if (!tutorEnabled) {
      setError('The tutor is switched off in settings.')
      return
    }
    setError(null)
    setInput('')
    pushChat({ role: 'user', content: text })
    setBusy(true)
    controller.current?.abort()
    const ac = new AbortController()
    controller.current = ac
    try {
      const reply = await askTutor(
        {
          question: text,
          mode,
          qasm: circuit.gates.length ? toQasm(circuit) : undefined,
          circuitSummary: `${circuit.gates.length} gates on ${circuit.numQubits} qubits`,
          insights,
          stateSummary: summary ? `${summary.description} Dominant: ${summary.dominant
            .slice(0, 3)
            .map((d) => `|${d.label}⟩ ${(d.probability * 100).toFixed(1)}%`)
            .join(', ')}.` : undefined,
          topic: topic ?? undefined,
          mastery,
          history: chat
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        },
        ac.signal,
      )
      setLastSource(reply.source)
      pushChat({ role: 'assistant', content: reply.text, source: reply.source })
    } catch {
      setError('Chinnu could not reach the tutor service. Try again in a moment.')
    } finally {
      if (controller.current === ac) setBusy(false)
    }
  }

  useEffect(() => {
    if (!askRef) return
    askRef.current = (q: string) => {
      void send(q)
    }
    return () => {
      askRef.current = null
    }
  })

  const suggestions = suggestQuestions({
    question: '',
    mode,
    insights,
    circuitSummary: `${circuit.gates.length} gates`,
    topic: topic ?? undefined,
  })

  return (
    <Panel
      title={
        <span className="row gap-8">
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(140deg,#9b7cff,#6b47ff)',
              color: '#fff',
            }}
          >
            <Sparkles size={12} />
          </span>
          Chinnu
        </span>
      }
      sub="Socratic tutor · grounded in this circuit"
      tight
      actions={
        <span className="row gap-6">
          {lastSource && (
            <Pill
              tone={lastSource === 'local' ? 'amber' : 'violet'}
              title={lastSource === 'local' ? 'Answered by the offline engine' : `Answered by ${lastSource === 'nvidia' ? 'NVIDIA Nemotron' : 'Claude'}`}
            >
              {lastSource === 'local' ? <WifiOff size={9} /> : <Wifi size={9} />}
              {lastSource === 'nvidia' ? 'NVIDIA' : lastSource === 'claude' ? 'Claude' : 'Offline'}
            </Pill>
          )}
          <button className="icon-btn" title="Clear conversation" onClick={() => useAppStore.setState({ chat: [] })}>
            <RefreshCw size={13} />
          </button>
        </span>
      }
    >
      <div className="tutor-panel" style={height ? { maxHeight: height, minHeight: Math.min(height, 320) } : undefined}>
        <div className="row gap-8 wrap" style={{ marginBottom: 10 }}>
          <Tabs tabs={MODES} value={mode} onChange={setMode} />
        </div>

        <div className="chat scroll-thin" ref={chatRef}>
          {chat.length === 0 && (
            <div className="msg">
              <div className="avatar">N</div>
              <div>
                <div className="bubble">
                  Hi — I'm Chinnu. I can see the circuit you're building, so ask me why a gate behaves the way it does, or
                  let me hunt for the bug. {topic ? `We're in **${topic.title}**.` : 'Pick a topic and we can go deeper.'}
                </div>
                <div className="meta">Try one of the prompts below ↓</div>
              </div>
            </div>
          )}
          {chat.map((m) => (
            <div className={`msg ${m.role}`} key={m.id}>
              <div className="avatar">{m.role === 'user' ? 'Y' : 'N'}</div>
              <div className="grow">
                <div className="bubble">{renderRich(m.content)}</div>
                {m.role === 'assistant' && (
                  <div className="meta">
                    {m.source === 'nvidia' ? 'NVIDIA Nemotron · server-side' : m.source === 'claude' ? 'Claude · server-side' : 'Offline tutor'}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg">
              <div className="avatar">N</div>
              <div className="bubble">
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}
        </div>

        {error && <div className="insight error" style={{ marginTop: 8 }}><span className="dot" /><div className="d">{error}</div></div>}

        <div className="row gap-6 wrap" style={{ margin: '8px 0 0' }}>
          {suggestions.map((s) => (
            <button key={s} className="chip" style={{ fontSize: 11, padding: '4px 9px' }} onClick={() => void send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>

        <div className="chat-compose">
          <textarea
            className="chat-input"
            aria-label="Ask Chinnu a question"
            placeholder={`Ask Chinnu in ${mode} mode…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={1}
          />
          <button className="btn primary icon" onClick={() => void send(input)} disabled={busy || !input.trim()} title="Send (Enter)">
            <CornerDownLeft size={14} />
          </button>
        </div>
      </div>
    </Panel>
  )
}
