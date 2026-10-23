# Submission deck

**File:** [`VTU-QFF-HC-0024.pptx`](./VTU-QFF-HC-0024.pptx)  
**Template:** organisers' 10-slide `VTU-QFF-HC-XXXX.pptx`  
**Team code:** `VTU-QFF-HC-0024`  
**Project:** Q-matrix · Quantum Space

The deck fills every field in the supplied template and uses the live repository, demo and API links on the closing slide.

## Contents

1. Title / participant details
2. Problem statement
3. Objectives & novelty
4. Solution & quantum advantage
5. Algorithm & circuit design
6. Implementation & tech stack
7. Results & analysis
8. Impact & real-world applications
9. Challenges & future scope
10. Thank you / links

## Rebuild

The reproducible builder uses `python-pptx`:

```bash
python3 submission/build_deck.py
```

It reads [`template.pptx`](./template.pptx) and the two Qiskit-generated figures in [`assets/`](./assets/), then writes `VTU-QFF-HC-0024.pptx`.

The figures are generated from real Qiskit/Aer runs:

- `assets/ghz_circuit.png` — 3-qubit GHZ circuit drawn with Qiskit 2.5.2.
- `assets/results.png` — ideal vs noisy Bell counts (8,192 shots) plus the repository's 147 automated checks.

## Live links

- Demo: <https://chinmayrerc.github.io/q-matrix/>
- Demo video (24 s): <https://github.com/ChinmayRERC/q-matrix/blob/main/docs/q-matrix-demo.mp4>
- Poster frame: <https://github.com/ChinmayRERC/q-matrix/blob/main/docs/q-matrix-demo-poster.jpg>
- Repository: <https://github.com/vtu-qiskit-fall-fest-2026/vtu-hc-q-matrix>
- API health: <https://q-matrix.onrender.com/api/health>

## Demo video

The 24-second video is rendered with Hyperframes from the live deployment — every frame is the real
product, captured headlessly with Playwright (2× DPR), and scored against the bundled
`happy-beats-business-moves-vol-12` bed.

- Source: [`brag-output-2026-10-23-125055/`](../brag-output-2026-10-23-125055) — plan, brief, composition
- Frames: `docs/q-matrix-demo.mp4`, poster `docs/q-matrix-demo-poster.jpg` (baked as frame 0)

## Data notes

- Bell ideal counts: `4095` (`00`) and `4097` (`11`) in 8,192 shots.
- Noisy model: depolarising + readout error; `7.7%` leakage into `01`/`10`.
- Verification: 120 Vitest + 12 API + 15 Qiskit = **147** checks, plus 28/28 NumPy oracle checks.
- Web QFT vs `QFTGate`: max error `1.2e-12`.
