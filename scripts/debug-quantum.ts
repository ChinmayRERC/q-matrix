import { addGate, emptyCircuit } from '../src/lib/quantum/circuit'
import { simulate } from '../src/lib/quantum/simulator'
import { concurrence, entanglementEntropy, partialTrace, summarizeState } from '../src/lib/quantum/analysis'
import { TEMPLATES } from '../src/lib/quantum/templates'

const bell = (() => {
  let c = emptyCircuit(2, 'bell')
  c = addGate(c, 'H', [0], 0)
  c = addGate(c, 'CNOT', [0, 1], 1)
  return c
})()

const r = simulate(bell)
console.log('bell probs', r.probabilities)
console.log('bell state', r.state)
const rho = partialTrace(r.state, 2, [0])
console.log('partialTrace rho (flat):', rho)
console.log('entanglementEntropy([0]) =', entanglementEntropy(r.state, 2, [0]))
console.log('concurrence =', concurrence(r.state))
console.log('summary', summarizeState(r.state, 2))

console.log('\n--- templates ---')
for (const t of TEMPLATES) {
  const c = t.build()
  const res = simulate(c)
  const live = res.probabilities.map((p, i) => [i, p]).filter(([, p]) => p > 1e-6)
  console.log(t.id.padEnd(16), JSON.stringify(live.map(([i, p]) => `${i}:${p.toFixed(4)}`)))
}
