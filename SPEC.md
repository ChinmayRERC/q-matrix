# QuantumSpace: AI-Powered Interactive Quantum Learning Platform
Build spec for Codex. Save as `AGENTS.md` / `SPEC.md` in the repo root.

## 0. Goal
Web platform where students, researchers and professionals **learn, design, simulate and visualize quantum algorithms**, with AI guidance and a **spatial (depth-based, glass, floating-panel) UI** using both 2D and 3D views.

Reference pattern: CyLab Academy (learn.cylabacademy.org) is a CMU cybersecurity CTF platform, so we borrow its *learning-platform patterns* only (see section 1), not its domain.

## 1. Patterns borrowed from reference platforms
| Pattern | Source | Our version |
|---|---|---|
| Learning Paths = curated sequences of challenges/readings | CyLab Academy | Quantum Paths (Fundamentals -> Gates -> Entanglement -> Algorithms -> QML) |
| Challenge Library, always-on practice | CyLab / picoGym | Circuit Challenges (build state X, make Grover find Y) |
| Classrooms, assignments with due dates, CSV gradebook export | CyLab Academy | Educator mode: classes, assignments, progress, CSV export |
| Teams / groups | CyLab Academy | Shared circuit workspaces |
| Challenge packaging as code, deployed by tooling | picoCTF (shell-manager, Ansible) | Lessons and challenges as versioned YAML/MD content repo, auto-ingested |
| Guided modules + "codercises" | PennyLane Codebook | Lesson = theory + live widget + code exercise |
| Interactive visual + animated learning | Q-CTRL Black Opal | Animated Bloch sphere, step-through circuits |
| Multi-simulator / multi-SDK cloud lab | qBraid | Simulator adapter layer |
| LLM analogy engine + quizzes with instant feedback | QuantAid paper | AI tutor with personalized analogies |

## 2. Feature list (MVP -> v2)
### Learning
- Paths and modules: qubits, superposition, measurement, single-qubit gates, multi-qubit gates, entanglement, teleportation, Deutsch-Jozsa, Bernstein-Vazirani, Grover, QFT, Shor (concept), VQE/QAOA, noise and error correction
- Each lesson: text + interactive widget + quiz + coding exercise + "Explain differently" button
- Progress tracking, XP, streaks, badges, mastery per concept (knowledge graph)
- Placement quiz -> personalized path
### Circuit design
- Drag-and-drop 2D composer: gate palette (H, X, Y, Z, S, T, RX/RY/RZ, CNOT, CZ, SWAP, Toffoli, measure, barrier), parameter sliders, multi-qubit wires, undo/redo, snap grid
- Code editor (Monaco) with two-way sync to the visual circuit
- Import/export: OpenQASM 2/3, Qiskit, Cirq, PennyLane snippets, JSON, PNG/SVG
- Templates library (Bell, GHZ, QFT, Grover, teleportation)
### Simulation
- Statevector, density-matrix (noise), shot-based sampler, stabilizer (many qubits)
- Noise models: depolarizing, amplitude damping, readout error
- Step-through execution (scrub the circuit gate by gate)
- Backend adapter interface: `run(circuit, backend, shots, noise) -> result`; adapters for Qiskit Aer, Cirq, PennyLane `default.qubit`; optional real hardware (IBM Quantum, via user API token) in v2
### Visualization (2D + 3D)
- 2D: circuit diagram, probability histogram, amplitude bars, phase wheel, density matrix heatmap, entanglement matrix, Q-sphere
- 3D: Bloch sphere per qubit (animated gate rotations), 3D Q-sphere, amplitude "city" bars, entanglement graph in space, circuit as layered 3D scene (depth = time)
- Toggle 2D / 3D / split view; reduced-motion and accessibility fallback
### AI assistance (Claude API)
- Real-time explanation of selected gate/circuit/result
- Error detection: invalid wiring, unmeasured qubits, wrong qubit count, non-unitary misuse, barren plateau hints
- Optimization suggestions: gate cancellation, depth reduction, transpile hints
- Socratic tutor chat grounded in lesson content (RAG over lessons)
- Personalized learning path from quiz and mistake history
- Guardrails: tutor never just dumps answers on graded exercises (hint ladder)
### Collaboration
- Shared workspaces with live cursors (CRDT), comments, share links, fork a circuit
- Classes/assignments/gradebook export (CSV)
- Community gallery of circuits
### Admin / content
- Content in git (MD + YAML), CI validates, loader publishes; admin dashboard for analytics

## 3. Spatial UI / UX spec
- Visual language: visionOS-style. Frosted glass panels, soft shadows, rounded 24px corners, specular edge highlights, dark space gradient background with subtle starfield; light mode optional
- Layout: a 3D "workbench". Floating panels at different z-depths (CSS 3D transforms): Lesson panel (left, tilted slightly), Circuit composer (center), Visualization stage (right/above), AI tutor orb (bottom corner)
- Depth cues: parallax on pointer move, panels lift on hover, focused panel scales forward, others blur and dim
- Ornament bar (bottom, visionOS style) for primary actions: Run, Step, Reset, 2D/3D, Share
- The 3D stage (react-three-fiber): Bloch spheres, Q-sphere, entanglement graph; orbit/zoom, gate-application animations
- Gestures: drag gates, pinch/scroll to zoom, double-click to focus a panel. Optional WebXR "immersive mode" (v2)
- Motion: spring physics (Framer Motion), respects `prefers-reduced-motion`
- Accessibility: keyboard-complete circuit editing, ARIA labels, color-blind-safe phase colors, 2D fallback for every 3D view
- Responsive: desktop = full spatial; tablet = stacked glass cards; mobile = single panel with tab bar and 2D-only visuals

## 4. User flow
1. Land -> sign up (email / Google) -> goal + experience quiz
2. Dashboard: recommended path, continue lesson, daily challenge, streak, classes
3. Open lesson -> read -> play with widget -> build circuit -> Run -> see 2D/3D results -> AI explains -> quiz
4. Sandbox: free circuit design, choose simulator/SDK, export
5. Challenges: submit circuit -> auto-grade by comparing output distributions/state fidelity -> hints
6. Teacher: create class -> assign paths/challenges -> view progress -> export CSV

## 5. System design
```
Browser (Next.js, React Three Fiber, Monaco)
   | HTTPS / WebSocket
API Gateway (FastAPI)  ---- Auth (JWT/OIDC)
   |-- Learning service (paths, progress, quizzes)
   |-- Circuit service (CRUD, versions, share)
   |-- Simulation service -> job queue (Redis/RQ or Celery) -> Workers (Qiskit Aer, Cirq, PennyLane)
   |-- AI service (Claude API, RAG over lessons, rate limits, caching)
   |-- Collab service (WebSocket + Yjs CRDT)
   |-- Class/assignment service
Postgres (users, progress, circuits, classes) | Redis (queue, cache, presence) | Object storage (exports, images) | pgvector (lesson embeddings)
```
- Light circuits (<= ~12 qubits): run **in the browser** (TypeScript/WASM statevector, or Pyodide) for instant feedback and zero server cost
- Heavy/noisy/multi-SDK runs: server workers, sandboxed (resource limits, timeouts, no network, container isolation) because users run arbitrary Python
- Limits: max qubits, max shots, per-user rate limits
- Observability: structured logs, Sentry, basic metrics

## 6. Tech stack
- Frontend: Next.js (App Router) + TypeScript, Tailwind, Framer Motion, react-three-fiber + drei, Zustand, Monaco, dnd-kit, Yjs
- Backend: Python FastAPI, SQLAlchemy + Alembic, Pydantic, Celery/RQ, Redis
- Quantum: qiskit + qiskit-aer, cirq, pennylane, OpenQASM parsers
- DB: PostgreSQL + pgvector
- AI: Anthropic Claude API (use a current Claude model via env var `ANTHROPIC_MODEL`)
- Tests: Vitest/Playwright (frontend), pytest (backend, include known-state checks: Bell, GHZ, Grover)
- Repo: monorepo `apps/web`, `apps/api`, `packages/quantum-core`, `content/` (lessons), `infra/`

## 7. Data model (core tables)
users, profiles, classes, class_members, assignments, paths, modules, lessons, quizzes, quiz_attempts, progress, concept_mastery, circuits, circuit_versions, runs (backend, shots, noise, result JSON), challenges, submissions, comments, ai_conversations, badges

## 8. API sketch
- `POST /auth/*`, `GET /me`
- `GET /paths`, `GET /lessons/{id}`, `POST /progress`
- `POST /circuits`, `GET/PUT /circuits/{id}`, `POST /circuits/{id}/fork`
- `POST /simulate` -> `{job_id}`; `GET /jobs/{id}`; WS `/jobs/{id}/stream`
- `POST /convert` (QASM <-> Qiskit/Cirq/PennyLane)
- `POST /ai/explain`, `/ai/debug`, `/ai/optimize`, `/ai/chat`, `GET /ai/path`
- `POST /classes`, `/assignments`, `GET /classes/{id}/export.csv`

## 9. Build order for Codex
1. Scaffold monorepo, CI, lint, Docker compose (web, api, postgres, redis)
2. Spatial design system: glass panels, depth layout, ornament bar, theme tokens
3. Client-side circuit model + statevector simulator + unit tests
4. 2D circuit composer (drag-and-drop) + histogram + amplitude views
5. 3D Bloch sphere + Q-sphere + animated step-through
6. Monaco code editor with two-way sync + QASM import/export
7. FastAPI simulate service with Qiskit/Cirq/PennyLane adapters + sandboxed workers
8. Auth, progress, lessons engine, quizzes, first 6 lessons, 5 challenges
9. AI tutor (explain, debug, optimize, hint ladder, RAG)
10. Personalized path, mastery tracking
11. Collaboration (Yjs), classes, CSV export
12. Polish: accessibility, mobile fallback, performance, e2e tests, seed content

## 10. Acceptance criteria
- Build a Bell circuit by drag-and-drop, run it, see ~50/50 `00`/`11` histogram, 3D view shows entangled state
- Same circuit editable as code and round-trips through OpenQASM
- Results match across at least two simulators (within statistical tolerance)
- AI flags a deliberate mistake (e.g., missing measurement) and explains it
- First-load under 3 s on broadband; 3D degrades gracefully on low-end devices
- No arbitrary code can escape the sandbox or reach the network

## 11. Deployment
- Frontend: **Vercel**
- API + workers: **Fly.io** (Docker; Mumbai region is closest for India) or **Render**
- DB: **Neon** or **Supabase** (Postgres + pgvector); Redis: **Upstash**
- Secrets via env vars; never expose the Claude API key to the client
- Fallback single-host option for demos: one VPS with docker compose + Caddy
