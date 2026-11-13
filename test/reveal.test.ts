import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TIERS } from '../src/rarity.ts'
import { revealPlan, revealSteps } from '../src/reveal.ts'

const total = (p: ReturnType<typeof revealPlan>) => p.crankMs + p.dropMs + p.wobbleMs.reduce((a, b) => a + b, 0) + p.holdMs

describe('reveal', () => {
  it('ends on the real tier and never glows above it', () => {
    for (const tier of TIERS) {
      for (let r = 0; r < 1; r += 0.05) {
        const steps = revealSteps(tier, () => r)
        assert.equal(steps.at(-1), tier)
        assert.ok(steps.every(s => TIERS.indexOf(s) <= TIERS.indexOf(tier)))
      }
    }
  })

  it('fakes out sometimes: a Legendary can come out blue', () => {
    assert.deepEqual(revealSteps('legendary', () => 0.1), ['rare', 'legendary'])
    assert.deepEqual(revealSteps('legendary', () => 0.9), ['legendary'])
    assert.deepEqual(revealSteps('common', () => 0), ['common'])
  })

  it('takes longer the rarer it is, and the panel is quicker', () => {
    const r = () => 0.99
    const times = TIERS.map(t => total(revealPlan(t, r)))
    assert.deepEqual([...times].sort((a, b) => a - b), times)
    assert.ok(total(revealPlan('legendary', r, { compact: true })) < times[3])
    assert.equal(revealPlan('rare', r).holdMs, 0)
  })
})
