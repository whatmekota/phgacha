import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filterFor, finaleStart, MAX_CHANCE, MODIFIER_IDS, modifierChance, rollModifier } from '../src/modifiers.ts'
import { FIELDS, readConfig } from '../src/settings.ts'

const seq = (...xs: number[]) => () => xs.shift() ?? 0
const everywhere = { device: true, hasScript: true, durationS: 600, finaleS: 90 }

describe('modifiers', () => {
  it('scales the chance with rarity, never past 90%', () => {
    assert.ok(modifierChance(0.4, 'common') < modifierChance(0.4, 'rare'))
    assert.ok(modifierChance(0.4, 'legendary') > modifierChance(0.4, 'epic'))
    assert.equal(modifierChance(1, 'legendary'), MAX_CHANCE)
    assert.equal(modifierChance(0, 'legendary'), 0)
  })

  it('rolls none above the chance, else one of those allowed', () => {
    const opts = { chance: 0.4, allowed: MODIFIER_IDS, situation: everywhere }
    assert.equal(rollModifier('rare', { ...opts, rand: seq(0.4) }), null)
    assert.equal(rollModifier('rare', { ...opts, rand: seq(0.1, 0) }), 'invert')
    assert.equal(rollModifier('rare', { ...opts, allowed: ['turbo'], rand: seq(0.1, 0.99) }), 'turbo')
  })

  it('leaves out what would do nothing here', () => {
    const rolls = (situation: typeof everywhere) =>
      new Set(Array.from({ length: 8 }, (_, i) => rollModifier('rare', { chance: 1, allowed: MODIFIER_IDS, situation, rand: seq(0, i / 8) })))
    const noDevice = rolls({ ...everywhere, device: false })
    assert.ok(!noDevice.has('invert') && !noDevice.has('half') && !noDevice.has('top'))
    const short = rolls({ ...everywhere, durationS: 120 })
    assert.ok(!short.has('finale'))
    const unscripted = rolls({ ...everywhere, hasScript: false })
    assert.deepEqual([...unscripted].sort(), ['fast', 'finale', 'slow', 'turbo'])
    assert.equal(rollModifier('rare', { chance: 1, allowed: ['invert'], situation: { ...everywhere, device: false }, rand: seq(0, 0) }), null)
  })

  it('reshapes only the stroke axis', () => {
    const t = { axis: 'L0', t: 0 }
    assert.equal(filterFor('invert')!(0.2, t), 0.8)
    assert.equal(filterFor('half')!(0, t), 0.25)
    assert.equal(filterFor('half')!(1, t), 0.75)
    assert.equal(filterFor('top')!(0, t), 0.5)
    assert.equal(filterFor('invert')!(0.2, { axis: 'R0', t: 0 }), 0.2)
    assert.equal(filterFor('turbo'), null)
    assert.equal(finaleStart(600, 90), 510)
    assert.equal(finaleStart(60, 90), 0)
  })

  it('allows every modifier by default and reads switched-off ones', () => {
    const defaults = Object.fromEntries(FIELDS.filter(f => f.key).map(f => [f.key, (f as { default?: unknown }).default]))
    assert.deepEqual(readConfig(defaults).allowed, MODIFIER_IDS)
    assert.deepEqual(readConfig({ ...defaults, mod_turbo: false }).allowed.includes('turbo'), false)
    assert.equal(readConfig({ chance: 500 }).chance, 1)
  })
})
