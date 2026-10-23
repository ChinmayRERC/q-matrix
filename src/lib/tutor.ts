/**
 * AI tutor client.
 *
 * Tries the FastAPI backend first (which proxies Claude with a server-side key),
 * then falls back to a deterministic Socratic engine so the product still works
 * offline and without an API key. The fallback is grounded in the same circuit
 * analysis the UI displays, so its answers never invent facts about the state.
 */
import type { Insight } from './insights'

export type TutorMode = 'explain' | 'hint' | 'debug' | 'next'

export interface TutorContext {
  question: string
  mode: TutorMode
  /** OpenQASM for the current circuit, if any. */
  qasm?: string
  /** One-line circuit description, e.g. "4 gates · depth 3". */
  circuitSummary?: string
  /** Factual insights already computed on the client. */
  insights?: Insight[]
  /** Human-readable state summary from the analysis module. */
  stateSummary?: string
  topic?: { id: string; title: string; domainName?: string; levelName?: string }
  /** 0..1 BKT mastery for the current topic. */
  mastery?: number
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface TutorCitation {
  label: string
  url: string
}

export type TutorSource = 'nvidia' | 'claude' | 'local'

export interface TutorReply {
  text: string
  source: TutorSource
  suggestions: string[]
  citations?: TutorCitation[]
  /** True when the backend answered with a degraded/fallback path. */
  degraded?: boolean
}

export interface PlanStep {
  id: string
  title: string
  why: string
  minutes: number
  action: 'lesson' | 'lab' | 'challenge' | 'review'
  topic_id: string | null
}

export interface StudyPlan {
  headline: string
  coach_note: string
  steps: PlanStep[]
  focus_topic: string | null
  source: TutorSource
}

import { API_BASE } from './api'

const TIMEOUT_MS = 20_000

function normaliseSource(source: string | undefined): TutorSource {
  return source === 'nvidia' || source === 'claude' ? source : 'local'
}

export async function askTutor(ctx: TutorContext, signal?: AbortSignal): Promise<TutorReply> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort)
  try {
    const res = await fetch(`${API_BASE}/ai/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: ctx.question,
        mode: ctx.mode,
        qasm: ctx.qasm ?? null,
        circuit_summary: ctx.circuitSummary ?? null,
        insights: (ctx.insights ?? []).map((i) => ({
          level: i.level,
          title: i.title,
          detail: i.detail,
          fix: i.fix ?? null,
        })),
        state_summary: ctx.stateSummary ?? null,
        topic: ctx.topic ?? null,
        mastery: ctx.mastery ?? null,
        history: (ctx.history ?? []).slice(-6),
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`tutor ${res.status}`)
    const data = (await res.json()) as {
      text?: string
      reply?: string
      suggestions?: string[]
      citations?: TutorCitation[]
      source?: string
    }
    const text = (data.text ?? data.reply ?? '').trim()
    if (!text) throw new Error('empty tutor reply')
    const source = normaliseSource(data.source)
    return {
      text,
      source,
      suggestions: data.suggestions ?? suggestQuestions(ctx),
      citations: data.citations,
      degraded: source === 'local',
    }
  } catch {
    return localTutor(ctx)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * Agentic study planner. The backend computes the plan from BKT mastery, so
 * this stays useful when the model is offline; it only enriches the note.
 */
export async function askPlanner(input: {
  name: string
  goal?: string
  minutes: number
  mode: 'guided' | 'explorer'
  lessonsCompleted: number
  challengesSolved: number
  mastered: number
  topics: Array<{ id: string; title: string; level?: string; domain?: string; mastery?: number; reason?: string }>
}): Promise<StudyPlan | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        goal: input.goal ?? null,
        minutes: input.minutes,
        mode: input.mode,
        lessons_completed: input.lessonsCompleted,
        challenges_solved: input.challengesSolved,
        mastered: input.mastered,
        topics: input.topics,
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<StudyPlan>
    if (!Array.isArray(data.steps) || data.steps.length === 0) return null
    return {
      headline: data.headline ?? 'Your next move',
      coach_note: data.coach_note ?? '',
      steps: data.steps,
      focus_topic: data.focus_topic ?? null,
      source: normaliseSource(data.source),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Local Socratic engine
// ---------------------------------------------------------------------------

interface Topic {
  keys: string[]
  title: string
  explain: string
  analogy: string
  probe: string
  link?: TutorCitation
}

const KNOWLEDGE: Topic[] = [
  {
    keys: ['superposition', 'hadamard', 'h gate', 'plus state', '|+'],
    title: 'Superposition',
    explain:
      'A superposition is a state with amplitude on more than one basis outcome at once, like (|0⟩ + |1⟩)/√2. The amplitudes are complex numbers; the probability of an outcome is the squared magnitude of its amplitude. Crucially, the qubit is not "secretly" 0 or 1 — interference between the branches is what makes quantum algorithms work.',
    analogy:
      'Think of a coin spinning in the air. While it spins it is neither heads nor tails, and its behaviour is described by the full motion, not by a hidden answer.',
    probe: 'If you apply a second H to (|0⟩ + |1⟩)/√2, what state do you get, and why?',
    link: { label: 'Qiskit: Superposition', url: 'https://learning.quantum.ibm.com/course/basics-of-quantum-information/superposition' },
  },
  {
    keys: ['entangle', 'bell', 'ghz', 'concurrence', 'non-local', 'nonlocal'],
    title: 'Entanglement',
    explain:
      'Entanglement means the joint state cannot be factored into independent qubit states. For a Bell pair, (|00⟩ + |11⟩)/√2, each qubit alone is maximally mixed, yet the pair is perfectly correlated. Concurrence measures this: it is 0 for product states and 1 for a Bell pair.',
    analogy:
      'Two pages of the same letter: reading one tells you what the other says, even though neither page contains the message by itself.',
    probe: 'For (|00⟩ + |11⟩)/√2, what is P(q1 = 0) given that you measured q0 = 0?',
    link: { label: 'Qiskit: Entanglement', url: 'https://learning.quantum.ibm.com/course/basics-of-quantum-information/entanglement-in-action' },
  },
  {
    keys: ['measure', 'measurement', 'collapse', 'born rule', 'observe'],
    title: 'Measurement',
    explain:
      'Measurement projects the state onto the measured basis: the probability of outcome b is |amplitude_b|² (the Born rule), and afterwards the state is the corresponding basis state. Repeated measurement without further gates therefore returns the same value.',
    analogy:
      'It is not like peeking at a coin already lying on the table; it is like the act of looking forces the spinning coin to land.',
    probe: 'After H on |0⟩, you measure 1. What happens if you measure again immediately?',
  },
  {
    keys: ['noise', 'decoher', 'purity', 'damping', 'depolar', 'error', 't1', 't2'],
    title: 'Noise and decoherence',
    explain:
      'Real qubits leak information into their environment. Depolarising noise applies a random Pauli with probability p; amplitude damping models energy relaxation (T1), and dephasing models loss of phase coherence (T2). In the simulator, noise switches from a statevector to a density matrix, so purity Tr(ρ²) drops below 1.',
    analogy:
      'A whispered message passed through a noisy room: the words smear, and you cannot recover them by listening harder.',
    probe: 'Why does the histogram become fuzzy rather than wrong when you add depolarising noise?',
    link: { label: 'Qiskit: Noise', url: 'https://learning.quantum.ibm.com/course/quantum-hardware-pulses' },
  },
  {
    keys: ['bloch', 'sphere', 'rotation', 'rx', 'ry', 'rz', 'theta', 'phi'],
    title: 'The Bloch sphere',
    explain:
      'Any pure single-qubit state maps to a point on the sphere: |0⟩ at the north pole, |1⟩ at the south, and equal superpositions on the equator. The azimuth is the relative phase. Rotations RX/RY/RZ rotate the vector about the corresponding axis.',
    analogy: 'A globe where latitude is the 0/1 balance and longitude is the phase.',
    probe: 'Where on the Bloch sphere does H|0⟩ land, and what does a Z gate do to that point?',
  },
  {
    keys: ['grover', 'search', 'amplitude amplification', 'oracle'],
    title: "Grover's search",
    explain:
      'Grover amplifies the amplitude of a marked item. Each iteration applies an oracle that flips the sign of the marked branch, then a diffusion operator that reflects all amplitudes about their mean. With N items and one marked, about √N iterations suffice; on two qubits one iteration is already exact.',
    analogy:
      'A room full of mics: instead of listening to each one, you turn up the gain on the one that hums the right note.',
    probe: 'Why does over-running Grover iterations eventually make the success probability go back down?',
    link: { label: "Qiskit: Grover's algorithm", url: 'https://learning.quantum.ibm.com/tutorial/grovers-algorithm' },
  },
  {
    keys: ['qft', 'fourier', 'phase estimation', 'shor'],
    title: 'Quantum Fourier Transform',
    explain:
      'The QFT maps computational basis states into superpositions with a linear phase ramp: QFT|j⟩ = (1/√N) Σ_k e^{2πijk/N}|k⟩. The circuit is a ladder of Hadamards and controlled phase rotations, ending with bit-reversal SWAPs. It is the engine behind phase estimation and Shor.',
    analogy: 'A prism that splits a signal into its frequency components — but for phase.',
    probe: 'What distribution do you get if you apply the QFT to |000⟩ and measure?',
  },
  {
    keys: ['teleport', 'teleportation', 'superdense'],
    title: 'Teleportation',
    explain:
      'Teleportation transfers a quantum state using one shared Bell pair and two classical bits. The sender performs a Bell-basis measurement, which destroys the original, and the two outcome bits tell the receiver which Pauli correction (X and/or Z) to apply. No-cloning is respected because the original is consumed.',
    analogy: 'Faxing a document by destroying the original and sending two bits that let the receiver rebuild it.',
    probe: 'What goes wrong at the destination if the receiver forgets the Z correction?',
  },
  {
    keys: ['toffoli', 'ccx', 'fredkin', 'controlled', 'cnot', 'cx', 'cz'],
    title: 'Controlled gates',
    explain:
      'A controlled gate acts on its target only when the control qubits are in |1⟩. CNOT flips a target, CZ multiplies the |11⟩ amplitude by −1, and Toffoli (CCX) needs both controls. Controlled gates create correlation, and controlled phase gates are the workhorse of the QFT.',
    analogy: 'A light switch wired in series: power flows only when every upstream switch is on.',
    probe: 'Why can CZ create entanglement even though it never changes a measurement probability on its own?',
  },
  {
    keys: ['phase', 'interference', 'kickback', 'relative phase'],
    title: 'Phase and interference',
    explain:
      'Global phase is unobservable, but relative phase between branches is everything: it decides whether amplitudes add or cancel. Phase kickback happens when a controlled gate acts on an eigenstate of the target — the eigenvalue appears as a phase on the control branch.',
    analogy: 'Two water waves meeting: in phase they amplify, out of phase they cancel.',
    probe: 'Which state must the target be in for CNOT to kick a phase back onto the control?',
  },
  {
    keys: ['mastery', 'progress', 'recommend', 'what next', 'study', 'path'],
    title: 'Your learning path',
    explain:
      'Your mastery is tracked with Bayesian Knowledge Tracing: each answer updates the probability you know a skill, then a small learning transition accounts for what you pick up along the way. The recommender ranks unlocked topics by the size of the knowledge gap and your readiness.',
    analogy: 'A GPS that reroutes based on where you have actually driven, not where you planned to go.',
    probe: 'Would you rather review a topic at 60% mastery or start a brand-new one? Why?',
  },
]

const MODE_LEAD: Record<TutorMode, string> = {
  explain: "Let's build the intuition first.",
  hint: "Here's a nudge — I'll hold back the answer.",
  debug: "Let's look at what the circuit is actually doing.",
  next: "Here's what I'd do next.",
}

function findTopic(question: string): Topic | undefined {
  const q = question.toLowerCase()
  let best: { topic: Topic; score: number } | undefined
  for (const topic of KNOWLEDGE) {
    const score = topic.keys.reduce((s, k) => (q.includes(k) ? s + k.length : s), 0)
    if (score > 0 && (!best || score > best.score)) best = { topic, score }
  }
  return best?.topic
}

function insightDigest(insights: Insight[] | undefined): string[] {
  return (insights ?? [])
    .filter((i) => i.level === 'error' || i.level === 'warning')
    .slice(0, 3)
    .map((i) => `${i.level === 'error' ? 'Problem' : 'Watch out'}: ${i.title}. ${i.fix ?? i.detail}`)
}

/** Deterministic reply grounded in the current circuit. */
export function localTutor(ctx: TutorContext): TutorReply {
  const question = ctx.question.trim()
  const topic = findTopic(question)
  const problems = insightDigest(ctx.insights)
  const errors = (ctx.insights ?? []).filter((i) => i.level === 'error')
  const wins = (ctx.insights ?? []).filter((i) => i.level === 'win')
  const lines: string[] = []

  if (ctx.mode === 'debug' || (errors.length && ctx.mode !== 'explain')) {
    lines.push(MODE_LEAD.debug)
    if (errors.length) {
      for (const err of errors.slice(0, 2)) {
        lines.push(`**${err.title}.** ${err.detail}${err.fix ? ` ${err.fix}` : ''}`)
      }
    } else if (ctx.stateSummary) {
      lines.push(`Nothing is broken structurally. The state right now: ${ctx.stateSummary}`)
    } else {
      lines.push('No structural errors showed up in the current circuit, so the surprise is probably in the state, not the wiring.')
    }
  } else if (ctx.mode === 'hint') {
    lines.push(MODE_LEAD.hint)
    if (problems.length) lines.push(problems[0])
    if (topic) {
      lines.push(topic.probe)
      lines.push(`If that feels too abstract, recall: ${topic.analogy}`)
    } else if (ctx.circuitSummary) {
      lines.push(`Look at your ${ctx.circuitSummary}. Which single gate would you remove first if you had to shorten it — and what would that change?`)
    } else {
      lines.push('Start with the smallest possible example: one qubit, one gate, predict the histogram before running it.')
    }
  } else if (ctx.mode === 'next') {
    lines.push(MODE_LEAD.next)
    if (wins.length) lines.push(`Nice — ${wins[0].title.toLowerCase()}. That is a real result, not just a pretty histogram.`)
    if (ctx.mastery !== undefined && ctx.mastery < 0.5) {
      lines.push('Your mastery here is still building, so I would replay the lesson simulation once with a prediction written down first.')
    } else if (ctx.mastery !== undefined && ctx.mastery < 0.85) {
      lines.push('You are close to mastery — one challenge on this topic should be enough to lock it in.')
    } else {
      lines.push('Try the next topic in the path, or take a challenge that forces you to rebuild this circuit from scratch.')
    }
    if (ctx.topic) lines.push(`We are currently in **${ctx.topic.title}**. The posttest is the fastest way to confirm the gain.`)
  } else {
    // explain
    lines.push(MODE_LEAD.explain)
    if (topic) {
      lines.push(topic.explain)
      lines.push(`\n**Picture it this way:** ${topic.analogy}`)
      lines.push(`\n**Your turn:** ${topic.probe}`)
    } else if (question) {
      lines.push(
        `Good question. I can ground this in the circuit you have open. ${
          ctx.circuitSummary ? `It currently has ${ctx.circuitSummary}.` : 'There is no circuit loaded yet.'
        }`,
      )
      if (ctx.stateSummary) lines.push(`\nRight now: ${ctx.stateSummary}`)
      lines.push('\nTell me which part feels least clear — the gate, the state, or the measurement — and I will zoom in there.')
    } else {
      lines.push('Ask me about a gate, a state, or a histogram and I will make it concrete.')
    }
  }

  if (ctx.stateSummary && ctx.mode !== 'debug') {
    lines.push(`\n**Live state:** ${ctx.stateSummary}`)
  }

  const text = lines.filter(Boolean).join('\n')
  return {
    text,
    source: 'local',
    suggestions: suggestQuestions(ctx),
    citations: topic?.link ? [topic.link] : undefined,
  }
}

/** Contextual follow-up chips for the tutor panel. */
export function suggestQuestions(ctx: TutorContext): string[] {
  const out: string[] = []
  const modeHints: Record<TutorMode, string[]> = {
    explain: ['Why does this gate create superposition?', 'Show me the state as amplitudes', 'What would happen on real hardware?'],
    hint: ['Give me a smaller hint', 'What should I predict before running?', 'Which gate am I missing?'],
    debug: ['Why is that an error?', 'How do I fix it?', 'Does it still happen without noise?'],
    next: ['What should I study next?', 'Is my mastery good enough for the next level?', 'Give me a harder challenge'],
  }
  out.push(...modeHints[ctx.mode])
  const errors = (ctx.insights ?? []).filter((i) => i.level === 'error')
  if (errors.length) out.unshift('Explain the error in my circuit')
  if (ctx.insights?.some((i) => i.level === 'win')) out.unshift('Why is this state special?')
  return [...new Set(out)].slice(0, 4)
}
