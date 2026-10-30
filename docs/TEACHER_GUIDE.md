# Teacher guide

A 45-minute lab for a first-year undergraduate class, using the deployed site
(`https://q-matrix.onrender.com`). No install, no accounts, no email.

## Before the lab (5 minutes)

1. Open the site once yourself. The API sleeps on the free tier; the landing
   page pings it so it is warm by the time students arrive.
2. Create a class: **Progress → Educator → Create a class**. Write down the
   6-character code and the PIN. Both are needed to see the roster.
3. Give students the URL and the code. They join from **Progress → Educator →
   Join a class** with the code and their name.

Students can work without joining. Joining only uploads a snapshot of mastery,
completed lessons, challenges, XP and badges for your roster — not circuit
contents, not free-text answers.

## Run sheet

| Time | Activity | Where |
|------|----------|-------|
| 0–5 | Predict: what does H do to \|0⟩? Vote, then run it | Workbench |
| 5–12 | Build Bell pair: H, then CNOT. Why are only 00 and 11 seen? | Workbench |
| 12–20 | One path topic each, reading and pretest | Paths |
| 20–30 | Comparison: same circuit ideal vs heavy noise | Workbench → Backend |
| 30–38 | Challenge set, auto-graded | Challenges |
| 38–43 | Qubit Lab levels 1–3 for anyone stuck on the basics | Qubit Lab |
| 43–45 | Exit ticket: one sentence on superposition, one on entanglement | — |

Between 30 and 38, open **Progress → Educator** on the projector and refresh.
The roster shows mean mastery, lessons completed, mean normalised gain and
learner count per topic, which is enough to decide what to reteach next week.

## What each path commonly gets wrong

**Quantum Beginner (B)**
- Reads a superposition as "both at once, so it is 50/50 in every basis".
  Fix: measure in a rotated basis and show the odds change.
- Expects measurement to reveal a pre-existing value. Fix: run the same
  circuit twice and compare counts, then explain collapse.

**Quantum Programmer (I)**
- Writes CNOT as `CX(q1, q0)` and is surprised by the histogram. Fix: the first
  qubit is the control; swap the order and re-run.
- Thinks noise is a bug in the simulator. Fix: turn the noise slider to zero and
  watch the counts tighten.
- Reads `0.5` amplitudes as `50%` probabilities. Fix: square the amplitude; use
  the state panel to show both numbers side by side.

**Algorithms (A)**
- Believes Grover always needs many iterations. Fix: on two qubits one iteration
  is exact; add iterations and watch the success probability fall.
- Confuses the QFT with a classical FFT. Fix: point at the phase ramp in the
  statevector, not at a speed-up claim.

**Frontier (F)**
- Assumes a real device will return the same histogram as the simulator. Use the
  **Target hardware** panel (routing, SWAP overhead, readout) to show why not.
- If the deployment has IBM credentials, **Real hardware** appears under the
  inspector. Queue time is minutes, so submit early and let it run while the
  class continues.

## Assessing without accounts

Export **Progress → Educator → CSV** after the session. One row per topic per
learner, with pretest, posttest, normalised gain and completion time. Import it
into a spreadsheet or an LMS; no student login is required for the export.

`normalised_gain` is `(posttest − pretest) / (100 − pretest)`, so a learner who
starts at 40% and finishes at 70% scores 0.5, not 0.3.

## Troubleshooting

- **The tutor answers instantly but plainly.** The AI key is missing or the
  budget is exhausted; the offline tutor is deterministic and grounded, so the
  lesson still works. Answers carry `grounded: true` from the offline engine.
- **The roster is empty.** Snapshots upload when a learner presses *Sync now* or
  joins; ask the class to sync once at the end.
- **The class code stops working after a deploy.** On the free tier the database
  lives on ephemeral storage unless `QMATRIX_DB` points at a mounted disk.
  Create the class again; progress in each browser is untouched.
- **Counts look wrong on real hardware.** Readout error flips bits and routing
  adds gates. Compare against the noisy simulator, not the ideal one.
