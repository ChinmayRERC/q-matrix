/**
 * Virtual Lab lesson engine.
 *
 * Every topic in the curriculum becomes a lesson with the seven stages the spec
 * requires: Aim, Theory, Pretest, Procedure, Simulation, Posttest, References.
 * Pre/post scores feed the normalised learning gain displayed to learners and
 * exported to educators.
 */
import { TOPICS, TOPIC_BY_ID, type Level, type Topic } from '../content/topics.generated'
import { TEMPLATES } from './quantum/templates'

export type { Level }

/**
 * Recommended entry point for a brand-new learner. QI-02 is the first lesson
 * where a single circuit produces an observable quantum effect, so it gives a
 * useful win before the math-heavy foundations topics.
 */
export const START_HERE = 'QI-02'

export interface Question {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  difficulty: 1 | 2 | 3
  /** True for domain-level fallback items rather than topic-specific ones. */
  generic?: boolean
}

export interface LabRef {
  label: string
  url: string
  note: string
}

export interface LabLesson {
  topicId: string
  title: string
  domain: string
  domainName: string
  level: Level
  minutes: number
  aim: string
  theory: string[]
  keyIdea: string
  procedure: string[]
  simulation: {
    templateId: string
    instructions: string
    expected: string
    /** Extra gates the learner should add beyond the template, if any. */
    challenge?: string
  }
  pretest: Question[]
  posttest: Question[]
  references: LabRef[]
  xp: number
}

// ---------------------------------------------------------------------------
// Topic-specific question bank (curated for the core circuit topics)
// ---------------------------------------------------------------------------

const TOPIC_QUESTIONS: Record<string, Question[]> = {
  'QI-01': [
    {
      id: 'QI-01a',
      prompt: 'A qubit in state α|0⟩ + β|1⟩ must satisfy which constraint?',
      options: ['|α| + |β| = 1', '|α|² + |β|² = 1', 'α = β always', 'α and β are real numbers'],
      answer: 1,
      explanation: 'Probabilities are squared magnitudes and must sum to one, so |α|² + |β|² = 1.',
      difficulty: 1,
    },
    {
      id: 'QI-01b',
      prompt: 'Where does the state |0⟩ sit on the Bloch sphere?',
      options: ['North pole', 'South pole', 'Equator', 'Centre'],
      answer: 0,
      explanation: 'The convention is |0⟩ at the north pole and |1⟩ at the south pole.',
      difficulty: 1,
    },
    {
      id: 'QI-01c',
      prompt: 'What does a point on the equator of the Bloch sphere represent?',
      options: [
        'A classical bit',
        'An equal superposition of |0⟩ and |1⟩ with some relative phase',
        'A maximally mixed state',
        'Two entangled qubits',
      ],
      answer: 1,
      explanation: 'Equatorial states have |α| = |β|, so both outcomes are equally likely; the azimuth encodes the relative phase.',
      difficulty: 2,
    },
  ],
  'QI-02': [
    {
      id: 'QI-02a',
      prompt: 'What does H|0⟩ produce?',
      options: ['|0⟩', '|1⟩', '(|0⟩ + |1⟩)/√2', '(|0⟩ − |1⟩)/√2'],
      answer: 2,
      explanation: 'The Hadamard maps the north pole to the +x axis: an equal superposition with no relative phase.',
      difficulty: 1,
    },
    {
      id: 'QI-02b',
      prompt: 'You apply H twice in a row. What is the final state?',
      options: ['|0⟩', '|1⟩', '(|0⟩ + |1⟩)/√2', 'A maximally mixed state'],
      answer: 0,
      explanation: 'H is its own inverse, so HH = I and the qubit returns to |0⟩.',
      difficulty: 2,
    },
    {
      id: 'QI-02c',
      prompt: 'After H, what does a single measurement return?',
      options: [
        'Both 0 and 1 at once',
        '0 or 1, each with probability 1/2',
        'Always 0',
        'Always 1',
      ],
      answer: 1,
      explanation: 'Measurement samples one branch: each outcome has probability 1/2 and the superposition collapses.',
      difficulty: 2,
    },
  ],
  'QI-03': [
    {
      id: 'QI-03a',
      prompt: 'A Bell pair is produced by which two-gate sequence?',
      options: ['X then Z', 'H then CNOT', 'H then Z', 'CNOT then X'],
      answer: 1,
      explanation: 'H puts the control in superposition, then CNOT correlates the target with it.',
      difficulty: 1,
    },
    {
      id: 'QI-03b',
      prompt: 'For the state (|00⟩ + |11⟩)/√2, what do you learn by measuring only qubit 0?',
      options: [
        'Nothing at all',
        'The value of qubit 1 with certainty',
        'Only that qubit 0 is random',
        'The relative phase',
      ],
      answer: 1,
      explanation: 'The outcomes are perfectly correlated: measuring q0 = 0 guarantees q1 = 0, and likewise for 1.',
      difficulty: 2,
    },
    {
      id: 'QI-03c',
      prompt: 'Which statement about entanglement is correct?',
      options: [
        'It lets you send information faster than light',
        'Each qubit still has a well-defined individual state',
        'The joint state cannot be written as a product of individual states',
        'It disappears as soon as the qubits are separated',
      ],
      answer: 2,
      explanation: 'Entanglement means non-separability: no product state reproduces the correlations.',
      difficulty: 3,
    },
  ],
  'QI-04': [
    {
      id: 'QI-04a',
      prompt: 'How many Bell states are there (up to global phase)?',
      options: ['2', '3', '4', '8'],
      answer: 2,
      explanation: 'The four Bell states form an orthonormal basis for two qubits: Φ± and Ψ±.',
      difficulty: 1,
    },
    {
      id: 'QI-04b',
      prompt: 'What makes the Bell basis useful in protocols?',
      options: [
        'It is the computational basis',
        'A Bell-basis measurement reveals two classical bits about the correlations',
        'It removes all entanglement',
        'It only works with one qubit',
      ],
      answer: 1,
      explanation: 'Measuring in the Bell basis extracts two bits of correlation information — the heart of teleportation and superdense coding.',
      difficulty: 2,
    },
  ],
  'QI-05': [
    {
      id: 'QI-05a',
      prompt: 'The no-cloning theorem says you cannot…',
      options: [
        'copy an unknown quantum state exactly',
        'measure a qubit twice',
        'apply two gates to one qubit',
        'entangle three qubits',
      ],
      answer: 0,
      explanation: 'Linearity of quantum mechanics forbids a universal device that copies an arbitrary unknown state.',
      difficulty: 1,
    },
    {
      id: 'QI-05b',
      prompt: 'Why does teleportation not violate no-cloning?',
      options: [
        'It copies the state twice',
        'The original is destroyed by measurement before the state is reconstructed',
        'It only works for classical bits',
        'It uses entanglement to clone',
      ],
      answer: 1,
      explanation: 'Teleportation consumes the original: after the Bell measurement the source qubit holds no information about the state.',
      difficulty: 3,
    },
  ],
  'QI-06': [
    {
      id: 'QI-06a',
      prompt: 'In teleportation, how many classical bits must be sent?',
      options: ['0', '1', '2', '4'],
      answer: 2,
      explanation: 'The two Bell-measurement outcomes are sent as two classical bits that select the correction.',
      difficulty: 1,
    },
    {
      id: 'QI-06b',
      prompt: 'What happens if the receiver skips the classically controlled corrections?',
      options: [
        'Nothing changes',
        'The state arrives with an unknown Pauli error',
        'The qubits become disentangled',
        'The circuit refuses to run',
      ],
      answer: 1,
      explanation: 'Without X/Z corrections the destination holds one of four Pauli-rotated versions of the input.',
      difficulty: 3,
    },
    {
      id: 'QI-06c',
      prompt: 'Superdense coding uses one shared Bell pair to transmit…',
      options: ['one classical bit', 'two classical bits', 'one qubit', 'four classical bits'],
      answer: 1,
      explanation: 'By encoding on one half of a Bell pair and sending that qubit, you convey two classical bits.',
      difficulty: 2,
    },
  ],
  'QI-11': [
    {
      id: 'QI-11a',
      prompt: 'A concurrence of 1 means the two-qubit state is…',
      options: ['separable', 'maximally entangled', 'classical', 'mixed'],
      answer: 1,
      explanation: 'Concurrence runs from 0 (separable) to 1 (maximally entangled, e.g. a Bell state).',
      difficulty: 1,
    },
    {
      id: 'QI-11b',
      prompt: 'The SWAP test estimates…',
      options: [
        'the fidelity between two states',
        'the energy of a Hamiltonian',
        'the number of qubits',
        'the gate depth',
      ],
      answer: 0,
      explanation: 'P(ancilla = 0) = (1 + |⟨ψ|φ⟩|²)/2, so the ancilla statistics reveal the overlap.',
      difficulty: 2,
    },
  ],
  'G-04': [
    {
      id: 'G-04a',
      prompt: 'CNOT flips its target when the control is…',
      options: ['|0⟩', '|1⟩', 'in superposition', 'measured'],
      answer: 1,
      explanation: 'CNOT applies X to the target exactly on the control = 1 branch.',
      difficulty: 1,
    },
    {
      id: 'G-04b',
      prompt: 'Which gate is symmetric between its two qubits?',
      options: ['CNOT', 'CZ', 'CRY', 'Toffoli'],
      answer: 1,
      explanation: 'CZ is diagonal and treats both qubits identically; CNOT is directional.',
      difficulty: 2,
    },
    {
      id: 'G-04c',
      prompt: 'Why is CZ called a phase gate?',
      options: [
        'It changes the amplitude of |11⟩',
        'It multiplies the |11⟩ amplitude by −1',
        'It rotates the target qubit',
        'It measures the control',
      ],
      answer: 1,
      explanation: 'CZ leaves probabilities untouched and only flips the sign of the |11⟩ branch.',
      difficulty: 2,
    },
  ],
  'G-05': [
    {
      id: 'G-05a',
      prompt: 'The Toffoli gate flips its target only when…',
      options: ['one control is 1', 'both controls are 1', 'both controls are 0', 'the target is 0'],
      answer: 1,
      explanation: 'CCX is a reversible AND: the target flips only on the |11⟩ control branch.',
      difficulty: 1,
    },
    {
      id: 'G-05b',
      prompt: 'Why do we care about Toffoli for classical computation?',
      options: [
        'It is universal for reversible classical logic',
        'It creates entanglement on its own',
        'It is the fastest gate',
        'It replaces measurement',
      ],
      answer: 0,
      explanation: 'Toffoli is a universal reversible classical gate, so quantum circuits can embed classical logic.',
      difficulty: 2,
    },
  ],
  'A-01': [
    {
      id: 'A-01a',
      prompt: 'Deutsch–Jozsa decides whether a function is…',
      options: ['linear or quadratic', 'constant or balanced', 'reversible or not', 'unitary or not'],
      answer: 1,
      explanation: 'The promise is that f is either constant or balanced (equal zeros and ones).',
      difficulty: 1,
    },
    {
      id: 'A-01b',
      prompt: 'How many queries does the quantum algorithm need (worst case)?',
      options: ['1', '2', 'n', '2^(n−1) + 1'],
      answer: 0,
      explanation: 'One query suffices quantumly, versus 2^(n−1) + 1 classically in the worst case.',
      difficulty: 2,
    },
    {
      id: 'A-01c',
      prompt: 'What role does the ancilla qubit in |−⟩ play?',
      options: [
        'It stores the answer',
        'It turns bit flips into phase kickback',
        'It protects against noise',
        'It is optional decoration',
      ],
      answer: 1,
      explanation: 'X|−⟩ = −|−⟩, so a CNOT into |−⟩ writes the function value into the phase — that is phase kickback.',
      difficulty: 3,
    },
  ],
  'A-02': [
    {
      id: 'A-02a',
      prompt: 'Bernstein–Vazirani recovers…',
      options: ['a hidden bit string', 'an unknown phase', 'a Hamiltonian', 'a gate decomposition'],
      answer: 0,
      explanation: 'It finds the secret string s in f(x) = s·x mod 2 with a single query.',
      difficulty: 1,
    },
    {
      id: 'A-02b',
      prompt: 'After the final Hadamards, the input register holds…',
      options: ['|0…0⟩', 'the hidden string s', 'a uniform superposition', 'the ancilla state'],
      answer: 1,
      explanation: 'The interference pattern concentrates all amplitude on the basis state encoding s.',
      difficulty: 2,
    },
  ],
  'A-04': [
    {
      id: 'A-04a',
      prompt: 'The QFT maps a computational basis state to…',
      options: [
        'another basis state',
        'a superposition with linearly increasing phases',
        'a maximally mixed state',
        'the same state with a global phase',
      ],
      answer: 1,
      explanation: 'QFT|j⟩ = (1/√N) Σ_k ω^{jk}|k⟩, a uniform superposition of phases.',
      difficulty: 2,
    },
    {
      id: 'A-04b',
      prompt: 'Why does the QFT circuit end with SWAP gates?',
      options: [
        'To reset the qubits',
        'To reverse the bit order produced by the ladder of controlled phases',
        'To measure the register',
        'To create entanglement',
      ],
      answer: 1,
      explanation: 'The phase ladder writes the result with reversed significance; the SWAPs undo that bit reversal.',
      difficulty: 3,
    },
  ],
  'A-07': [
    {
      id: 'A-07a',
      prompt: 'Grover search finds a marked item in about how many iterations?',
      options: ['N', '√N', 'log N', 'N/2'],
      answer: 1,
      explanation: 'Amplitude amplification needs O(√N) iterations for N items — a quadratic speedup.',
      difficulty: 1,
    },
    {
      id: 'A-07b',
      prompt: 'What does the diffusion operator do?',
      options: [
        'Inverts amplitudes about their average',
        'Measures the marked item',
        'Creates the oracle',
        'Prepares |0…0⟩',
      ],
      answer: 0,
      explanation: 'Reflection about the mean amplitude boosts the marked state and shrinks the others.',
      difficulty: 2,
    },
    {
      id: 'A-07c',
      prompt: 'On two qubits with one marking, one Grover iteration gives success probability…',
      options: ['0.25', '0.5', '0.75', '1.0'],
      answer: 3,
      explanation: 'With N = 4 a single iteration is exactly optimal: the marked state reaches probability 1.',
      difficulty: 3,
    },
  ],
}

// ---------------------------------------------------------------------------
// Domain-level fallback bank (three concept questions per domain)
// ---------------------------------------------------------------------------

/** Cross-cutting items appended to every pool so a lab always has a posttest. */
const GENERAL_QUESTIONS: Question[] = [
  { id: 'X-1', prompt: 'A qubit is measured in the computational basis and the result is 1. Immediately measuring again gives…', options: ['0 with certainty', '1 with certainty', '1 with probability ½', 'A random bit'], answer: 1, explanation: 'After a projective measurement the state has collapsed, so a repeat measurement agrees.', difficulty: 1 },
  { id: 'X-2', prompt: 'Which statement about a global phase e^{iφ}|ψ⟩ is true?', options: ['It changes measurement statistics', 'It is physically unobservable', 'It doubles the amplitudes', 'It breaks normalisation'], answer: 1, explanation: 'Global phases cancel in every probability |amplitude|² and are unobservable.', difficulty: 2 },
  { id: 'X-3', prompt: 'A circuit with no two-qubit gates can produce…', options: ['Any entangled state', 'Only product states', 'Only |0⟩', 'Only maximally mixed states'], answer: 1, explanation: 'Entanglement requires an entangling (multi-qubit) interaction.', difficulty: 2 },
  { id: 'X-4', prompt: 'Doubling the number of shots typically reduces statistical error by…', options: ['Half', 'A factor of √2', 'A factor of 4', 'No change'], answer: 1, explanation: 'Shot noise scales as 1/√N, so doubling N divides the error by √2.', difficulty: 2 },
  { id: 'X-5', prompt: 'A gate is unitary because…', options: ['It must be reversible and preserve norm', 'It is always diagonal', 'It minimises energy', 'It removes noise'], answer: 0, explanation: 'Closed-system evolution is reversible and conserves total probability.', difficulty: 1 },
  { id: 'X-6', prompt: 'The Bloch sphere represents…', options: ['Any two-qubit state', 'Pure single-qubit states', 'Mixed two-qubit states', 'Only |0⟩ and |1⟩'], answer: 1, explanation: 'Every pure one-qubit state maps to a point on the sphere (mixed states live inside).', difficulty: 2 },
  { id: 'X-7', prompt: 'Decoherence primarily explains…', options: ['Why quantum computers are fast', 'Why superpositions leak into the environment', 'Why gates are unitary', 'Why measurement is repeatable'], answer: 1, explanation: 'Entanglement with the environment suppresses interference and turns pure states mixed.', difficulty: 2 },
  { id: 'X-8', prompt: 'A measurement result is classical information because…', options: ['It is always 0', 'It is a definite bit you can copy and record', 'It destroys the qubit', 'It is random'], answer: 1, explanation: 'Measurement outcomes are definite and copyable, unlike unknown quantum states.', difficulty: 2 },
]

const DOMAIN_QUESTIONS: Record<string, Question[]> = {
  'math-foundations': [
    { id: 'M-a', prompt: 'Multiplying by i = e^{iπ/2} corresponds to which operation on the unit circle?', options: ['No change', 'A 90° rotation', 'A reflection', 'Halving the magnitude'], answer: 1, explanation: 'Multiplying by e^{iθ} rotates by θ; i rotates by 90°.', difficulty: 1 },
    { id: 'M-b', prompt: 'A unitary matrix U must satisfy…', options: ['U = Uᵀ', 'U†U = I', 'det U = 0', 'U is real'], answer: 1, explanation: 'Unitaries preserve inner products, which is exactly U†U = I.', difficulty: 2 },
    { id: 'M-c', prompt: 'The tensor product of a 2×2 and a 2×2 matrix has dimensions…', options: ['2×2', '4×4', '8×8', '1×1'], answer: 1, explanation: 'Dimensions multiply under the tensor product: 2·2 = 4.', difficulty: 1 },
    { id: 'M-d', prompt: 'The conjugate transpose of a column vector |ψ⟩ is written…', options: ['|ψ⟩', '⟨ψ|', '|ψ⟩²', 'ψ*'], answer: 1, explanation: 'The bra ⟨ψ| is the conjugate transpose (dual) of the ket |ψ⟩.', difficulty: 1 },
    { id: 'M-e', prompt: 'A matrix is Hermitian when…', options: ['A = A†', 'A = −A', 'A² = I', 'det A = 1'], answer: 0, explanation: 'Hermitian matrices have real eigenvalues and represent observables.', difficulty: 2 },
    { id: 'M-f', prompt: 'The eigenvalues of a unitary matrix all have…', options: ['Magnitude 1', 'Magnitude 0', 'Real values only', 'Value exactly 1'], answer: 0, explanation: 'Unitary evolution preserves norm, so every eigenvalue is a phase e^{iθ}.', difficulty: 3 },
  ],
  'quantum-mechanics-essentials': [
    { id: 'QM-a', prompt: 'A measurement in an orthonormal basis returns…', options: ['Any value', 'An eigenvalue, with probability |amplitude|²', 'The average value always', 'Nothing'], answer: 1, explanation: 'The Born rule: probability of an outcome is the squared magnitude of its amplitude.', difficulty: 1 },
    { id: 'QM-b', prompt: 'Two operators commute if and only if…', options: ['They share a complete basis of eigenvectors', 'They are both Hermitian', 'They are both unitary', 'They are both real'], answer: 0, explanation: 'Commuting observables can be diagonalised simultaneously — they are compatible.', difficulty: 2 },
    { id: 'QM-c', prompt: 'The time-independent Schrödinger equation H|ψ⟩ = E|ψ⟩ defines…', options: ['A gate', 'An energy eigenstate', 'A measurement', 'A noise channel'], answer: 1, explanation: 'Solutions are eigenstates of the Hamiltonian with energy E.', difficulty: 2 },
    { id: 'QM-d', prompt: 'The no-signalling principle says entanglement cannot…', options: ['Be created', 'Transmit information faster than light', 'Be measured', 'Be destroyed'], answer: 1, explanation: 'Local measurements on one half give no information about the other half alone.', difficulty: 2 },
    { id: 'QM-e', prompt: 'A density matrix ρ must satisfy…', options: ['ρ† = ρ, ρ ≥ 0, Tr ρ = 1', 'ρ² = ρ always', 'Tr ρ = 0', 'ρ = ρᵀ'], answer: 0, explanation: 'These three conditions define a valid quantum state, pure or mixed.', difficulty: 3 },
    { id: 'QM-f', prompt: 'A pure state has Tr(ρ²) equal to…', options: ['0', '1', '0.5', 'd'], answer: 1, explanation: 'Purity Tr(ρ²) = 1 exactly for pure states and less than 1 for mixed states.', difficulty: 2 },
  ],
  'quantum-information-basics': [
    { id: 'QI-a', prompt: 'The von Neumann entropy of a pure state is…', options: ['1', '0', 'log₂d', 'Undefined'], answer: 1, explanation: 'A pure state has a single eigenvalue 1, so its entropy is zero.', difficulty: 2 },
    { id: 'QI-b', prompt: 'A maximally entangled two-qubit state has reduced single-qubit entropy…', options: ['0', '0.5 bits', '1 bit', '2 bits'], answer: 2, explanation: 'Tracing out one half leaves the maximally mixed qubit with entropy 1 bit.', difficulty: 2 },
    { id: 'QI-c', prompt: 'Quantum information cannot be copied because of…', options: ['The no-cloning theorem', 'The uncertainty principle alone', 'Decoherence', 'The speed of light'], answer: 0, explanation: 'No unitary can copy an arbitrary unknown state.', difficulty: 1 },
  ],
  'gates-circuits': [
    { id: 'G-a', prompt: 'Which set of gates is universal for quantum computation?', options: ['{H, S}', '{H, T, CNOT}', '{X, Z}', '{SWAP}'], answer: 1, explanation: 'Clifford + T = {H, S, CNOT, T} is universal; H, T and CNOT already generate it.', difficulty: 2 },
    { id: 'G-b', prompt: 'Circuit depth counts…', options: ['The number of gates', 'The number of moments (parallel layers)', 'The number of qubits', 'The number of measurements'], answer: 1, explanation: 'Depth is the number of sequential layers, which bounds runtime.', difficulty: 1 },
    { id: 'G-c', prompt: 'Any single-qubit gate can be written as a rotation…', options: ['About the z axis only', 'About an arbitrary axis on the Bloch sphere', 'Only as a Pauli', 'Only as a phase'], answer: 1, explanation: 'Every SU(2) element is a rotation about some axis by some angle.', difficulty: 2 },
  ],
  'quantum-algorithms': [
    { id: 'A-a', prompt: 'Quantum speedups usually come from…', options: ['Faster clocks', 'Interference that cancels wrong answers', 'Parallel classical threads', 'Caching'], answer: 1, explanation: 'Algorithms arrange amplitudes so incorrect branches interfere destructively.', difficulty: 1 },
    { id: 'A-b', prompt: 'Shor\'s algorithm factors integers using…', options: ['Grover search', 'Quantum phase estimation and the QFT', 'Amplitude damping', 'Teleportation alone'], answer: 1, explanation: 'Order finding reduces to phase estimation, which uses the QFT.', difficulty: 2 },
    { id: 'A-c', prompt: 'Amplitude amplification is the generalisation behind…', options: ['Shor', 'Grover', 'HHL', 'QAOA'], answer: 1, explanation: 'Grover search is amplitude amplification with a uniform prior.', difficulty: 2 },
  ],
  'variational-nisq': [
    { id: 'V-a', prompt: 'In VQE, the classical optimiser tunes…', options: ['The measurement basis', 'The gate parameters θ', 'The qubit count', 'The noise model'], answer: 1, explanation: 'A parameterised circuit is evaluated and the classical loop updates θ to lower the energy.', difficulty: 1 },
    { id: 'V-b', prompt: 'A "barren plateau" means…', options: ['The circuit is empty', 'Gradients vanish exponentially with system size', 'The qubits decohere', 'The ansatz is too short'], answer: 1, explanation: 'For certain ansätze the cost landscape becomes exponentially flat, stalling training.', difficulty: 3 },
    { id: 'V-c', prompt: 'QAOA alternates between…', options: ['Two classical channels', 'A cost Hamiltonian and a mixer Hamiltonian', 'Measurement and reset', 'Two QFTs'], answer: 1, explanation: 'QAOA applies e^{-iγH_C} and e^{-iβH_M} alternately to build the ansatz.', difficulty: 2 },
  ],
  'quantum-machine-learning': [
    { id: 'QML-a', prompt: 'A quantum kernel method estimates…', options: ['Gate counts', 'Inner products between data-encoded quantum states', 'Classical gradients', 'Noise spectra'], answer: 1, explanation: 'The kernel is |⟨φ(x)|φ(x′)⟩|², computed by interference circuits.', difficulty: 2 },
    { id: 'QML-b', prompt: 'Data encoding into amplitudes or angles is called…', options: ['Feature map', 'Decoherence', 'Tomography', 'Ansatz pruning'], answer: 0, explanation: 'A feature map embeds classical data into a quantum state.', difficulty: 1 },
    { id: 'QML-c', prompt: 'A major practical obstacle for QML today is…', options: ['Too few classical computers', 'Data-loading cost and trainability', 'Lack of Python', 'Slow hard drives'], answer: 1, explanation: 'Loading classical data can erase the advantage, and training landscapes can be flat.', difficulty: 2 },
  ],
  'noise-error-correction': [
    { id: 'N-a', prompt: 'Depolarising noise replaces a qubit state with…', options: ['|0⟩', 'A mixture of X, Y, Z errors', 'The identity', 'A pure phase'], answer: 1, explanation: 'With probability p the state is replaced by a uniformly random Pauli error.', difficulty: 1 },
    { id: 'N-b', prompt: 'The threshold theorem says…', options: ['Noise can always be removed', 'Below a threshold error rate, arbitrarily long computation is possible with enough overhead', 'Qubits cannot be entangled', 'Error correction needs no extra qubits'], answer: 1, explanation: 'If physical error rates are below threshold, fault-tolerant overhead scales polylogarithmically.', difficulty: 2 },
    { id: 'N-c', prompt: 'T1 describes…', options: ['Phase coherence time', 'Energy relaxation time', 'Gate fidelity', 'Readout error'], answer: 1, explanation: 'T1 is amplitude/energy damping; T2 is dephasing.', difficulty: 2 },
  ],
  'hardware-platforms': [
    { id: 'H-a', prompt: 'Superconducting qubits operate at approximately…', options: ['Room temperature', '77 K', '10–20 mK', '1 K'], answer: 2, explanation: 'Dilution refrigerators keep transmons near 10 mK so thermal noise is negligible.', difficulty: 1 },
    { id: 'H-b', prompt: 'Trapped-ion qubits are manipulated with…', options: ['Microwave pulses only', 'Laser beams', 'Magnetic tips', 'Electric sparks'], answer: 1, explanation: 'Laser-driven transitions implement gates on long-lived ionic qubits.', difficulty: 2 },
    { id: 'H-c', prompt: 'Photonic platforms are attractive because…', options: ['They need dilution fridges', 'They can operate at room temperature', 'They have the shortest coherence', 'They cannot entangle'], answer: 1, explanation: 'Photons barely interact with the environment, so room-temperature operation is feasible.', difficulty: 2 },
  ],
  'quantum-communication-cryptography': [
    { id: 'C-a', prompt: 'QKD security relies on…', options: ['Computational hardness', 'Physical laws such as no-cloning', 'Shared passwords', 'Firewalls'], answer: 1, explanation: 'Eavesdropping disturbs the quantum states and is detected by the protocol.', difficulty: 1 },
    { id: 'C-b', prompt: 'In BB84, the two bases are…', options: ['X and Y', 'Z and X', 'I and Z', 'Two random bases'], answer: 1, explanation: 'BB84 encodes in the computational (Z) and Hadamard (X) bases.', difficulty: 2 },
    { id: 'C-c', prompt: 'Entanglement swapping extends…', options: ['Gate times', 'Entanglement between distant nodes', 'Classical bandwidth', 'Coherence of one qubit'], answer: 1, explanation: 'Swapping creates entanglement between particles that never interacted.', difficulty: 2 },
  ],
  'quantum-sensing-metrology': [
    { id: 'S-a', prompt: 'The Heisenberg limit scales sensitivity as…', options: ['1/√N', '1/N', '1/N²', '1/N³'], answer: 1, explanation: 'Quantum-enhanced metrology reaches 1/N versus the classical 1/√N.', difficulty: 2 },
    { id: 'S-b', prompt: 'Ramsey interferometry measures…', options: ['Resistance', 'Phase accumulation between two states', 'Gate depth', 'Photon count only'], answer: 1, explanation: 'The accumulated phase shifts the interference fringe, revealing the field.', difficulty: 2 },
    { id: 'S-c', prompt: 'Squeezed states are useful because they…', options: ['Lower noise in one quadrature below the vacuum level', 'Increase decoherence', 'Clone unknown states', 'Remove entanglement'], answer: 0, explanation: 'Squeezing redistributes uncertainty to reduce noise in the measured quadrature.', difficulty: 2 },
  ],
  'quantum-chemistry-materials': [
    { id: 'Ch-a', prompt: 'The electronic structure problem is hard classically because the Hilbert space grows…', options: ['Linearly', 'Quadratically', 'Exponentially with the number of orbitals', 'Logarithmically'], answer: 2, explanation: 'Each orbital doubles the dimension, so exact diagonalisation is exponential.', difficulty: 1 },
    { id: 'Ch-b', prompt: 'VQE estimates molecular ground states by minimising…', options: ['Entropy', 'The expectation value of the Hamiltonian', 'Gate count', 'Temperature'], answer: 1, explanation: 'The parameterised state is optimised to minimise ⟨H⟩.', difficulty: 2 },
    { id: 'Ch-c', prompt: 'Trotterisation approximates…', options: ['Measurement', 'e^{-iHt} for a sum of non-commuting terms', 'State preparation', 'Readout'], answer: 1, explanation: 'Splitting the evolution into short commuting steps approximates the full propagator.', difficulty: 3 },
  ],
  'many-body-condensed-matter': [
    { id: 'MB-a', prompt: 'Topological order is characterised by…', options: ['Local order parameters', 'Global entanglement and anyonic excitations', 'Temperature only', 'Lattice size'], answer: 1, explanation: 'It has no local order parameter; signatures include degeneracy and anyons.', difficulty: 3 },
    { id: 'MB-b', prompt: 'Tensor networks represent…', options: ['Only product states', 'States with bounded entanglement', 'Only thermal states', 'Classical bits'], answer: 1, explanation: 'MPS/PEPS capture area-law entanglement efficiently.', difficulty: 2 },
    { id: 'MB-c', prompt: 'Quantum simulation of a lattice model typically maps…', options: ['Spins to qubits', 'Qubits to photons only', 'Gates to measurements', 'Energy to time'], answer: 0, explanation: 'Spin-½ degrees of freedom map naturally onto qubits.', difficulty: 2 },
  ],
  'quantum-optics': [
    { id: 'O-a', prompt: 'A beam splitter acts on photons like…', options: ['A measurement', 'A two-mode unitary mixing', 'An amplifier', 'A detector'], answer: 1, explanation: 'It mixes two optical modes unitarily, the photonic analogue of a two-qubit gate.', difficulty: 2 },
    { id: 'O-b', prompt: 'Hong–Ou–Mandel interference shows…', options: ['Photons bunch at a beam splitter', 'Photons repel', 'Photons are classical', 'Photons decay'], answer: 0, explanation: 'Indistinguishable photons exit the same port (bunching).', difficulty: 2 },
    { id: 'O-c', prompt: 'Squeezed light has reduced variance in…', options: ['All quadratures', 'One quadrature, at the cost of the other', 'Photon number only', 'Phase only'], answer: 1, explanation: 'The uncertainty principle forces the conjugate quadrature to grow.', difficulty: 2 },
  ],
  'quantum-thermodynamics': [
    { id: 'T-a', prompt: 'Landauer\'s principle says erasing one bit costs at least…', options: ['k_B T ln 2 of heat', 'Zero', 'One joule', 'k_B T²'], answer: 0, explanation: 'Irreversible erasure dissipates at least k_B T ln 2.', difficulty: 2 },
    { id: 'T-b', prompt: 'A Maxwell demon apparently violates the second law until you account for…', options: ['The cost of measurement and memory erasure', 'Relativity', 'Entanglement', 'Gravity'], answer: 0, explanation: 'The demon must store and eventually erase information, restoring the entropy balance.', difficulty: 2 },
  ],
  'foundations-interpretations': [
    { id: 'F-a', prompt: 'Bell\'s theorem rules out…', options: ['Quantum mechanics', 'Local hidden-variable theories', 'Superposition', 'Entanglement'], answer: 1, explanation: 'No local realistic model can reproduce all quantum correlations.', difficulty: 1 },
    { id: 'F-b', prompt: 'The measurement problem asks…', options: ['Why gates are unitary', 'Why a single outcome is observed', 'Why qubits are small', 'Why noise exists'], answer: 1, explanation: 'Unitary evolution gives many branches; observation gives one outcome.', difficulty: 2 },
    { id: 'F-c', prompt: 'Contextuality means measurement outcomes depend on…', options: ['The full measurement context', 'The temperature', 'The qubit count', 'The order of gates'], answer: 0, explanation: 'Values are not pre-existing; the context of compatible measurements matters.', difficulty: 3 },
  ],
  'computational-complexity': [
    { id: 'CC-a', prompt: 'BQP is the class of problems solvable…', options: ['In polynomial time on a quantum computer with bounded error', 'Only exponentially', 'Only classically', 'In constant time'], answer: 0, explanation: 'Bounded-error quantum polynomial time.', difficulty: 1 },
    { id: 'CC-b', prompt: 'Grover gives a speedup for…', options: ['Structured search', 'Unstructured search', 'Sorting', 'Matrix multiplication'], answer: 1, explanation: 'Unstructured search drops from O(N) to O(√N).', difficulty: 2 },
    { id: 'CC-c', prompt: 'It is unknown whether BQP contains…', options: ['P', 'NP-complete problems', 'Both P and NP-complete problems', 'Neither'], answer: 2, explanation: 'P ⊆ BQP; whether BQP contains NP-complete problems is open.', difficulty: 3 },
  ],
  'software-tooling': [
    { id: 'SW-a', prompt: 'OpenQASM is…', options: ['A quantum programming language for circuit descriptions', 'A hardware fridge', 'A noise model', 'A gate library only'], answer: 0, explanation: 'OpenQASM is the interchange format for quantum circuits, supported by Qiskit, Cirq and others.', difficulty: 1 },
    { id: 'SW-b', prompt: 'A transpiler…', options: ['Rewrites a circuit for a target device', 'Measures the circuit', 'Compiles Python', 'Runs the fridge'], answer: 0, explanation: 'Transpilation maps gates onto the device\'s native set and connectivity.', difficulty: 1 },
    { id: 'SW-c', prompt: 'Shot noise in results decreases as…', options: ['1/shots', '1/√shots', 'shots', 'shots²'], answer: 1, explanation: 'Statistical error scales as 1/√N for N shots.', difficulty: 2 },
  ],
  'applications-industry-society': [
    { id: 'AP-a', prompt: 'Which application is expected to benefit earliest from quantum computing?', options: ['Chemistry and materials simulation', 'Video streaming', 'Word processing', 'Web browsing'], answer: 0, explanation: 'Simulating quantum systems is the most natural fit and needs the fewest logical qubits.', difficulty: 1 },
    { id: 'AP-b', prompt: 'Post-quantum cryptography matters because…', options: ['Shor breaks RSA and ECC', 'It speeds up the internet', 'It removes encryption', 'It only affects phones'], answer: 0, explanation: 'Large-scale quantum computers would break widely deployed public-key schemes.', difficulty: 1 },
  ],
  'history-milestones-verify-recent-items': [
    { id: 'HI-a', prompt: 'Feynman\'s 1982 proposal argued that…', options: ['Quantum systems are best simulated with quantum systems', 'Classical computers are enough', 'Qubits cannot be built', 'Entanglement is a myth'], answer: 0, explanation: 'Feynman pointed out the exponential cost of simulating quantum physics classically.', difficulty: 1 },
    { id: 'HI-b', prompt: 'Bell test loopholes were closed in…', options: ['1964', '1982', '2015', '2024'], answer: 2, explanation: 'Loophole-free Bell tests were reported in 2015.', difficulty: 2 },
    { id: 'HI-c', prompt: 'Quantum supremacy/advantage demonstrations must…', options: ['Be reproducible classically cheaply', 'Show a task done faster than a practical classical method', 'Use zero qubits', 'Avoid entanglement'], answer: 1, explanation: 'The claim is a speedup on a specific task versus the best available classical approach.', difficulty: 2 },
  ],
}

// ---------------------------------------------------------------------------
// Simulation mapping
// ---------------------------------------------------------------------------

const TOPIC_TEMPLATE: Record<string, string> = {
  'M-01': 'phase',
  'QI-01': 'superposition',
  'QI-02': 'superposition',
  'QI-03': 'bell',
  'QI-04': 'bell',
  'QI-05': 'bell',
  'QI-06': 'teleportation',
  'QI-11': 'swap-test',
  'G-04': 'phase-kickback',
  'G-05': 'toffoli',
  'A-01': 'deutsch-jozsa',
  'A-02': 'bernstein-vazirani',
  'A-04': 'qft',
  'A-07': 'grover',
}

const DOMAIN_TEMPLATE: Record<string, string> = {
  'quantum-information-basics': 'bell',
  'gates-circuits': 'toffoli',
  'quantum-algorithms': 'grover',
  'quantum-machine-learning': 'swap-test',
  'noise-error-correction': 'bell',
  'quantum-communication-cryptography': 'teleportation',
}

const SIMULATION_NOTES: Record<string, { instructions: string; expected: string; challenge?: string }> = {
  superposition: {
    instructions: 'Load the template, run it, then scrub the timeline to watch the amplitude appear.',
    expected: 'One gate produces a 50/50 histogram with a single strong interference fringe.',
    challenge: 'Add a second H and confirm the qubit returns to |0⟩ with certainty.',
  },
  bell: {
    instructions: 'Run the Bell template, then open the inspector to read the concurrence.',
    expected: 'Only 00 and 11 appear, each ~50%, and concurrence reads 1.00.',
    challenge: 'Replace the CNOT control so the pair becomes |01⟩ + |10⟩ instead.',
  },
  ghz: {
    instructions: 'Run the GHZ template and compare its entropy with the Bell pair.',
    expected: 'Only 000 and 111 appear; the reduced state of one qubit is maximally mixed.',
  },
  teleportation: {
    instructions: 'Step through the circuit one gate at a time and watch the conditional corrections.',
    expected: 'The destination qubit ends with the same statistics as the prepared state.',
    challenge: 'Change the RY angle and confirm the destination distribution follows it.',
  },
  'deutsch-jozsa': {
    instructions: 'Run it and read the input register only.',
    expected: 'A balanced oracle concentrates all probability on 11 (non-zero).',
  },
  'bernstein-vazirani': {
    instructions: 'Run it and decode the hidden string from the input register.',
    expected: 'The hidden string appears with probability 1 in a single query.',
  },
  qft: {
    instructions: 'Run the QFT on |000⟩ and inspect the uniform superposition phases.',
    expected: 'All eight outcomes are equally likely — the Fourier transform of a basis state.',
  },
  grover: {
    instructions: 'Run the search and watch the marked state grow after the diffusion step.',
    expected: 'The marked state |11⟩ reaches probability 1 after one iteration.',
  },
  'swap-test': {
    instructions: 'Run the SWAP test and read the ancilla statistics.',
    expected: 'P(ancilla = 0) = (1 + |⟨ψ|φ⟩|²)/2 = 0.75 for |1⟩ versus |+⟩.',
  },
  toffoli: {
    instructions: 'Run the Toffoli template and toggle one control off.',
    expected: 'The target flips only when both controls are 1.',
  },
  'phase-kickback': {
    instructions: 'Run it and inspect the sign of the amplitudes.',
    expected: 'The |11⟩ amplitude is negative — the phase was kicked back onto the control.',
  },
}

// ---------------------------------------------------------------------------
// Lesson builder
// ---------------------------------------------------------------------------

const REFERENCES: LabRef[] = [
  { label: 'Nielsen & Chuang, Quantum Computation and Quantum Information', url: 'https://doi.org/10.1017/CBO9780511976667', note: 'The standard graduate reference for everything in this curriculum.' },
  { label: 'Qiskit Textbook', url: 'https://learning.quantum.ibm.com/', note: 'Interactive lessons with runnable code for every core concept.' },
  { label: 'PennyLane demos', url: 'https://pennylane.ai/qml/', note: 'Hands-on differentiable quantum programming and QML.' },
  { label: 'Quirk circuit simulator', url: 'https://algassert.com/quirk', note: 'Drag-and-drop circuit playground for building intuition.' },
]

function theoryFor(topic: Topic): string[] {
  const domainFrames: Record<string, string> = {
    'math-foundations': 'The mathematics here is the grammar of quantum mechanics — once it is fluent, the physics becomes notation.',
    'quantum-mechanics-essentials': 'This is a postulate-level idea: it constrains every circuit you will ever build.',
    'quantum-information-basics': 'Quantum information theory asks what can be done with states rather than what they "are".',
    'gates-circuits': 'Circuits are the assembly language of quantum computing: gates, wires, and measurement.',
    'quantum-algorithms': 'An algorithm is a pattern of interference that concentrates amplitude on the answer.',
    'variational-nisq': 'Near-term devices are small and noisy, so we hand part of the work to a classical optimiser.',
    'quantum-machine-learning': 'QML asks whether quantum state spaces give useful models for classical data.',
    'noise-error-correction': 'Real qubits decohere, so every serious architecture is built around error correction.',
    'hardware-platforms': 'Different physical qubits trade off coherence, connectivity, speed and temperature.',
    'quantum-communication-cryptography': 'Communication protocols exploit the impossibility of copying unknown quantum states.',
    'quantum-sensing-metrology': 'Sensing turns fragile quantum coherence into extreme measurement precision.',
    'quantum-chemistry-materials': 'Nature is quantum, so simulating it quantumly avoids an exponential classical cost.',
    'many-body-condensed-matter': 'Emergent order in matter is often encoded in entanglement structure.',
    'quantum-optics': 'Photons are the natural flying qubits for communication and interferometry.',
    'quantum-thermodynamics': 'Information is physical: erasing and measuring have unavoidable thermodynamic costs.',
    'foundations-interpretations': 'Interpretations ask what the formalism means, not what it predicts.',
    'computational-complexity': 'Complexity theory tells us which speedups are possible in principle.',
    'software-tooling': 'Tooling is how theory becomes an executable experiment.',
    'applications-industry-society': 'The value of quantum computing depends on which problems actually get easier.',
    'history-milestones-verify-recent-items': 'History shows how ideas that looked philosophical became engineering constraints.',
  }
  const frame = domainFrames[topic.domain] ?? 'This concept connects to the wider quantum computing stack.'
  return [
    `${topic.title} sits in the ${topic.domainName} domain. ${frame}`,
    topic.idea
      ? `The core mental model: ${topic.idea}. Hold onto that picture — every equation below is a precise version of it.`
      : 'Start with the definition, then ask what changes when you measure, and what stays invariant under a change of basis.',
    `At ${topic.levelName.toLowerCase()} level you are expected to predict the outcome of a small example by hand before trusting a simulator. That prediction step is where learning actually happens.`,
  ]
}

function procedureFor(topic: Topic, templateId: string): string[] {
  const template = TEMPLATES.find((t) => t.id === templateId)
  const steps = [
    `Read the aim and write down, in one sentence, what you expect to observe.`,
    `Open the simulator with the "${template?.name ?? 'starter'}" template loaded on ${template?.build().numQubits ?? 2} qubits.`,
    `Predict the measurement distribution before pressing Run. Commit to a guess.`,
    `Run the circuit and compare with your prediction. Scrub the timeline to see where the state changes.`,
  ]
  if (templateId === 'bell' || templateId === 'ghz') {
    steps.push('Read the concurrence and entanglement entropy in the inspector — that is the quantitative proof of entanglement.')
  }
  if (templateId === 'grover' || templateId === 'qft') {
    steps.push('Step through one gate at a time and describe how the amplitudes move at each stage.')
  }
  if (templateId === 'phase') {
    steps.push('Open the state inspector and compare the complex amplitudes before and after S — the histogram stays 50/50 while the relative phase rotates by 90°.')
  }
  if (templateId === 'teleportation') {
    steps.push('Watch which correction gates are skipped for the current outcome — that is classical feed-forward in action.')
  }
  steps.push(`Take the posttest, then try the challenge: ${SIMULATION_NOTES[templateId]?.challenge ?? 'modify one gate and predict the effect.'}`)
  return steps
}

const REF_EXTRA: Record<string, LabRef[]> = {
  'quantum-algorithms': [{ label: 'Quantum Algorithm Zoo', url: 'https://quantumalgorithmzoo.org/', note: 'A catalogue of known quantum speedups and their assumptions.' }],
  'noise-error-correction': [{ label: 'Surface code explainer (Google Quantum AI)', url: 'https://quantumai.google/education', note: 'Practical introduction to error-correcting surfaces.' }],
  'quantum-machine-learning': [{ label: 'Quantum Machine Learning (Schuld & Petruccione)', url: 'https://doi.org/10.1007/978-3-319-96424-9', note: 'Textbook treatment of QML models and kernels.' }],
  'hardware-platforms': [{ label: 'Quantum computing hardware review', url: 'https://arxiv.org/abs/1905.10135', note: 'Survey of qubit modalities and engineering trade-offs.' }],
}

export function lessonFor(topicId: string): LabLesson | null {
  const topic = TOPIC_BY_ID[topicId]
  if (!topic) return null

  const templateId = TOPIC_TEMPLATE[topic.id] ?? DOMAIN_TEMPLATE[topic.domain] ?? 'bell'
  const notes = SIMULATION_NOTES[templateId] ?? {
    instructions: 'Load the template, predict the outcome, then run it.',
    expected: 'Compare the histogram with your prediction.',
  }

  const specific = TOPIC_QUESTIONS[topic.id] ?? []
  const generic = DOMAIN_QUESTIONS[topic.domain] ?? DOMAIN_QUESTIONS['gates-circuits']
  // Deduplicate by id: a duplicate id would make the quiz's "answered" count
  // impossible to satisfy and strand the learner on a stage.
  const seen = new Set<string>()
  const pool = [...specific, ...generic, ...GENERAL_QUESTIONS].filter((q) => {
    if (seen.has(q.id)) return false
    seen.add(q.id)
    return true
  })

  // Split deterministically so the pretest and posttest are disjoint but balanced.
  const pretest = pool.slice(0, Math.min(3, pool.length))
  const pretestIds = new Set(pretest.map((q) => q.id))
  const remainder = pool.slice(pretest.length)
  const posttest = [
    ...remainder,
    ...generic.filter((q) => !pretestIds.has(q.id) && !remainder.some((r) => r.id === q.id)),
  ].slice(0, 4)

  return {
    topicId: topic.id,
    title: topic.title,
    domain: topic.domain,
    domainName: topic.domainName,
    level: topic.level,
    minutes: topic.estimatedMinutes,
    aim: topic.idea
      ? `Build a working mental model of ${topic.title.toLowerCase()} and demonstrate it: ${topic.idea}.`
      : `Explain ${topic.title.toLowerCase()} well enough to predict the outcome of a small experiment before running it.`,
    theory: theoryFor(topic),
    keyIdea: topic.idea || topic.title,
    procedure: procedureFor(topic, templateId),
    simulation: { templateId, ...notes },
    pretest,
    posttest,
    references: [...(REF_EXTRA[topic.domain] ?? []), ...REFERENCES],
    xp: Math.round(40 + topic.estimatedMinutes * 1.5 + (topic.level === 'A' ? 20 : topic.level === 'F' ? 40 : 0)),
  }
}

export const ALL_LESSONS = TOPICS.map((t) => t.id)

/** Hake normalised gain: (post − pre) / (1 − pre). */
export function learningGain(pre: number, post: number): number {
  if (pre >= 1) return post >= 1 ? 0 : -1
  return (post - pre) / (1 - pre)
}

export function gainLabel(gain: number): string {
  if (gain >= 0.7) return 'High gain'
  if (gain >= 0.3) return 'Medium gain'
  if (gain > 0) return 'Low gain'
  return 'No gain'
}
