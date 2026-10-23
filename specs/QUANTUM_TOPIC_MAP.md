# Quantum Topic Map (Whole Quantum Science, Beginner to Undergrad-Advanced)

Purpose: the master curriculum graph for the platform. Every topic is a node in the **Quantum Galaxy** (3D knowledge map). Domains are clusters, prerequisites are edges, mastery lights nodes up.

Levels: **B** = beginner, **I** = intermediate, **A** = advanced (undergrad). **F** = frontier (beyond undergrad; shown as a dim outer ring, short overview lessons only).
Format: `ID Topic [level] <- prerequisites | interactive idea`

Note on completeness: this covers the established undergrad-level body of quantum science and flags frontier areas. No list can be literally complete because the field keeps growing. Frontier (F) entries and recent milestones must be reviewed by a subject expert and refreshed regularly through the content pipeline.

## Node schema (for content/ YAML)
```yaml
id: QI-03
title: Entanglement
domain: quantum-information
level: I
prerequisites: [QI-01, QI-02]
estimated_minutes: 25
widgets: [bloch-2q, bell-state-explorer]
exercises: [build-bell-circuit, chsh-game]
quiz: pretest + posttest ids
course_alignment: [BTech CSE Quantum Computing, MSc Physics QM-II]
tags: [entanglement, bell]
```

## D0. Math Foundations
- M-01 Complex numbers and phases [B] | unit circle phase wheel
- M-02 Vectors, vector spaces, bases [B] <- M-01 | 2D/3D vector playground
- M-03 Matrices, unitary and Hermitian operators [B] <- M-02 | matrix action on Bloch sphere
- M-04 Dirac (bra-ket) notation [B] <- M-02 | notation translator
- M-05 Eigenvalues and eigenvectors [I] <- M-03 | eigen-axis visualizer
- M-06 Tensor products [I] <- M-03 | two-qubit state builder
- M-07 Probability and statistics for measurement [B] | shot-noise histogram
- M-08 Calculus and differential equations refresher [I] | wavefunction evolution
- M-09 Fourier analysis [I] <- M-01 | Fourier/QFT bridge
- M-10 Group theory and Lie algebra basics (SU(2)) [A] <- M-03 | rotation group in 3D

## D1. Quantum Mechanics Essentials
- QM-01 Why quantum: blackbody, photoelectric effect, double slit [B] | interactive double slit
- QM-02 Wave-particle duality, de Broglie [B] <- QM-01
- QM-03 Postulates of quantum mechanics [I] <- M-04
- QM-04 Schrodinger equation (time dependent/independent) [I] <- M-08
- QM-05 Particle in a box, potential wells, tunneling [I] <- QM-04 | 3D wavefunction
- QM-06 Quantum harmonic oscillator [I] <- QM-04
- QM-07 Uncertainty principle, commutators [I] <- M-03
- QM-08 Angular momentum and spin [I] <- M-10 | Stern-Gerlach simulator
- QM-09 Hydrogen atom and orbitals [A] <- QM-08 | 3D orbital viewer
- QM-10 Perturbation theory and variational method [A] <- QM-04 (bridge to VQE)
- QM-11 Identical particles, bosons and fermions [A] <- QM-08
- QM-12 Time evolution, Heisenberg and interaction pictures [A] <- QM-04
- QM-13 Open systems, master equation (Lindblad) [A] <- QI-07

## D2. Quantum Information Basics
- QI-01 Qubit and the Bloch sphere [B] <- M-04 | 3D Bloch sphere
- QI-02 Superposition and measurement [B] <- QI-01 | repeated-shot sampler
- QI-03 Multi-qubit systems and entanglement [I] <- M-06
- QI-04 Bell states and Bell basis [I] <- QI-03
- QI-05 No-cloning theorem [I] <- QI-02
- QI-06 Teleportation and superdense coding [I] <- QI-04 | step-through circuit
- QI-07 Density matrices, pure vs mixed states [I] <- QI-03
- QI-08 Partial trace and reduced states [A] <- QI-07
- QI-09 Schmidt decomposition [A] <- QI-08
- QI-10 Entropy: von Neumann, entanglement entropy [A] <- QI-08
- QI-11 Entanglement measures and witnesses [A] <- QI-10
- QI-12 Quantum channels, Kraus operators, POVMs [A] <- QI-07
- QI-13 Quantum state tomography [A] <- QI-12

## D3. Gates and Circuits
- G-01 Pauli gates X, Y, Z [B] <- QI-01
- G-02 Hadamard, S, T, phase gates [B] <- G-01
- G-03 Rotation gates RX, RY, RZ [B] <- G-02 | rotation on Bloch sphere
- G-04 CNOT, CZ, SWAP, controlled gates [I] <- QI-03
- G-05 Toffoli, Fredkin, multi-controlled gates [I] <- G-04
- G-06 Universal gate sets, Solovay-Kitaev [A] <- G-05
- G-07 Circuit identities and gate synthesis [A] <- G-06
- G-08 Clifford group and Gottesman-Knill [A] <- G-06
- G-09 Reversible and classical-to-quantum oracles [I] <- G-05

## D4. Quantum Algorithms
- A-01 Deutsch and Deutsch-Jozsa [I] <- G-09
- A-02 Bernstein-Vazirani [I] <- A-01
- A-03 Simon's algorithm [I] <- A-01
- A-04 Quantum Fourier Transform [I] <- M-09, G-04
- A-05 Quantum phase estimation [A] <- A-04
- A-06 Shor's factoring algorithm [A] <- A-05 | period-finding visualizer
- A-07 Grover search [I] <- G-09 | amplitude amplification on Q-sphere
- A-08 Amplitude amplification and estimation [A] <- A-07
- A-09 Quantum counting [A] <- A-08
- A-10 Quantum walks [A] <- QI-03
- A-11 Hamiltonian simulation (Trotter, qubitization) [A] <- A-05
- A-12 HHL and quantum linear systems [A] <- A-05
- A-13 Quantum singular value transformation [F]
- A-14 Quantum optimization overview (annealing, QAOA link) [I]

## D5. Variational and NISQ
- V-01 NISQ era and its limits [B]
- V-02 Parameterized circuits and ansatz design [I] <- G-03
- V-03 VQE [I] <- V-02, QM-10 | energy landscape in 3D
- V-04 QAOA [I] <- V-02
- V-05 Gradients: parameter-shift rule [A] <- V-02
- V-06 Barren plateaus and trainability [A] <- V-05
- V-07 Error mitigation (ZNE, readout, PEC) [A] <- N-01
- V-08 Quantum annealing and adiabatic computing [I]

## D6. Quantum Machine Learning
- ML-01 Classical ML refresher for QML [B]
- ML-02 Data encoding (basis, amplitude, angle) [I] <- G-03
- ML-03 Quantum kernels and kernel alignment [A] <- ML-02
- ML-04 QSVM [A] <- ML-03
- ML-05 Variational quantum classifiers / QNNs [A] <- V-02
- ML-06 Quantum GANs, Boltzmann machines [F]
- ML-07 Dequantization and honest QML advantage [A]
- ML-08 Quantum reinforcement learning overview [F]

## D7. Noise and Error Correction
- N-01 Noise and decoherence (T1, T2) [I] <- QI-07 | noisy Bloch sphere shrinking
- N-02 Noise channels (bit flip, depolarizing, amplitude damping) [I] <- QI-12
- N-03 Repetition code and 3-qubit codes [I] <- N-02
- N-04 Shor 9-qubit code [A] <- N-03
- N-05 Stabilizer formalism [A] <- G-08
- N-06 CSS and Steane code [A] <- N-05
- N-07 Surface code [A] <- N-05 | 2D lattice with live syndromes
- N-08 Fault tolerance and threshold theorem [A] <- N-06
- N-09 Magic state distillation, logical gates [A] <- N-08
- N-10 Decoders (MWPM, ML decoders) [A] <- N-07
- N-11 LDPC codes, bosonic and cat codes [F]
- N-12 Dynamical decoupling [A] <- N-01

## D8. Hardware Platforms
- H-01 DiVincenzo criteria [B]
- H-02 Superconducting qubits (transmon) [I] | circuit-QED diagram
- H-03 Trapped ions [I]
- H-04 Neutral atoms / Rydberg arrays [I]
- H-05 Photonic quantum computing [I]
- H-06 Spin qubits in silicon and quantum dots [I]
- H-07 NV centers and defect qubits [I]
- H-08 Topological qubits and Majorana modes [F]
- H-09 Control, pulses, calibration [A] <- H-02
- H-10 Benchmarking: randomized benchmarking, quantum volume [A]
- H-11 Cryogenics and control electronics [I]
- H-12 Scaling and modular architectures [F]

## D9. Quantum Communication and Cryptography
- C-01 Classical cryptography refresher, RSA threat [B]
- C-02 BB84 QKD [I] <- QI-02 | eavesdropper simulator
- C-03 E91 and entanglement-based QKD [A] <- QI-04
- C-04 Quantum random number generation [B]
- C-05 Quantum networks and repeaters [A] <- QI-06
- C-06 Post-quantum cryptography [I] <- C-01
- C-07 Device-independent protocols [F]
- C-08 Blind and delegated quantum computing [F]
- C-09 Quantum money, secret sharing [A]

## D10. Quantum Sensing and Metrology
- S-01 Why quantum sensing beats classical limits [B]
- S-02 Atomic clocks and Ramsey interferometry [I] | Ramsey fringes
- S-03 NV-center magnetometry [I] <- H-07
- S-04 Squeezed light and gravitational-wave detection [A]
- S-05 Heisenberg vs standard quantum limit [A]
- S-06 Quantum imaging, gravimetry, navigation [I]
- S-07 Quantum Fisher information [A] <- QI-12

## D11. Quantum Chemistry and Materials
- QC-01 Molecular Hamiltonians, Born-Oppenheimer [I] <- QM-10
- QC-02 Hartree-Fock and electronic structure basics [A] <- QC-01
- QC-03 Second quantization [A] <- QM-11
- QC-04 Fermion-to-qubit mappings (Jordan-Wigner, Bravyi-Kitaev) [A] <- QC-03
- QC-05 VQE for molecules (H2, LiH) [A] <- V-03, QC-04 | molecule 3D viewer + energy curve
- QC-06 Active spaces and chemistry resource estimates [F]
- QC-07 Materials simulation, DFT overview [A]
- QC-08 Quantum simulation of lattice models [A] <- A-11

## D12. Many-Body and Condensed Matter
- MB-01 Spin systems: Ising, Heisenberg [I] | spin lattice
- MB-02 Hubbard model [A]
- MB-03 Entanglement in many-body systems, area law [A] <- QI-10
- MB-04 Tensor networks: MPS, DMRG [A] <- MB-03
- MB-05 Quantum phase transitions [A]
- MB-06 Topological phases [F]
- MB-07 Thermalization and many-body localization [F]
- MB-08 Quantum Monte Carlo and sign problem [A]
- MB-09 Quantum spin liquids [F]

## D13. Quantum Optics
- O-01 Photons, quantization of the EM field [I]
- O-02 Coherent and squeezed states, Wigner function [A] | Wigner function in 3D
- O-03 Beam splitters, Mach-Zehnder, Hong-Ou-Mandel [I] | interferometer sandbox
- O-04 Cavity QED, Jaynes-Cummings model [A]
- O-05 Boson sampling [A]
- O-06 Continuous-variable quantum computing [F]

## D14. Quantum Thermodynamics
- T-01 Quantum vs classical thermodynamics [I]
- T-02 Quantum heat engines [A]
- T-03 Landauer principle, information and energy [A]
- T-04 Resource theories [F]

## D15. Foundations and Interpretations
- F-01 EPR paradox and hidden variables [I]
- F-02 Bell inequalities and CHSH [I] <- QI-04 | CHSH game
- F-03 Kochen-Specker, contextuality [A]
- F-04 Measurement problem [I]
- F-05 Interpretations: Copenhagen, many-worlds, pilot wave, QBism [I]
- F-06 Decoherence and the quantum-to-classical transition [A] <- N-01
- F-07 Quantum Zeno, delayed-choice, quantum eraser [I]
- F-08 Quantum gravity and holography links [F]

## D16. Computational Complexity
- X-01 Classical complexity refresher (P, NP) [B]
- X-02 BQP and relations to P, NP [A]
- X-03 Query complexity and oracle separations [A]
- X-04 Quantum advantage / supremacy experiments [I]
- X-05 Classical simulation limits [A]
- X-06 QMA, QMA-complete problems [F]

## D17. Software and Tooling
- SW-01 OpenQASM [B]
- SW-02 Qiskit [B]
- SW-03 Cirq [B]
- SW-04 PennyLane [B]
- SW-05 Transpilation and compilation [I]
- SW-06 Pulse-level programming [A]
- SW-07 Resource estimation [A]
- SW-08 Hybrid quantum-classical workflows [I]
- SW-09 Quantum cloud services and real hardware access [B]

## D18. Applications, Industry and Society
- AP-01 Use cases: chemistry, finance, optimization, logistics, ML [B]
- AP-02 Where advantage is credible vs hype [I]
- AP-03 Quantum industry map and careers [B]
- AP-04 Ethics, security, and policy [B]
- AP-05 National quantum missions and roadmaps (verify current status) [B]

## D19. History and Milestones (verify recent items)
- HI-01 Planck to Heisenberg to Schrodinger [B]
- HI-02 Bell 1964, Aspect experiments [I]
- HI-03 Feynman 1981, Deutsch 1985 [I]
- HI-04 Shor 1994, Grover 1996 [I]
- HI-05 First qubits and NISQ-era demonstrations [I]
- HI-06 Recent milestones (error-corrected qubits, advantage claims) [I] -- requires periodic expert refresh

## Learning paths (curated routes through the galaxy)
1. **Quantum Beginner**: M-01..M-07, QM-01..QM-03, QI-01..QI-06, G-01..G-04, A-01, A-07
2. **Quantum Programmer**: SW-01..SW-04, G-*, A-*, V-01..V-04, SW-05, SW-08
3. **Quantum Physicist**: QM-*, QI-07..QI-13, MB-*, O-*, F-*
4. **Quantum ML**: ML-*, V-*, QC-none required
5. **Quantum Chemist**: QM-09..QM-10, QC-*, V-03
6. **Quantum Hardware and Error Correction**: H-*, N-*
7. **Quantum Security**: C-*, A-06, A-07
8. **Sensing and Metrology**: S-*, O-*, QM-08

## 3D Galaxy UI behaviour
- Each domain is a colored cluster; nodes are stars sized by importance; prerequisite edges are glowing lines
- Level rings: B inner, I middle, A outer, F faint outermost ring
- Mastery lights nodes up; locked nodes dim; AI recommends the next best node with a pulsing marker
- Click a node -> glass panel slides forward with lesson, widget, quiz, "ask AI"
- 2D fallback: searchable tree/graph list, filter by domain, level, path
- Prerequisite graph is validated in CI (no cycles, no missing ids)
