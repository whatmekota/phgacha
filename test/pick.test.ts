import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fallbackOrder, inPool, MAX_LIFT, parseTags, pick, pityAfter, pityDue, rollTier, tierChances } from '../src/pick.ts'
import { video } from './fixtures.ts'

const NOW = Date.UTC(2026, 10, 13)
/** A rand that hands out these numbers in turn. */
const seq = (...xs: number[]) => () => xs.shift() ?? 0

// One video per tier (see rarity.test.ts for the points).
const common = video({ id: 'common.mp4' })
const rare = video({ id: 'rare.mp4', plays: 0, lastPlayedAt: null, finishes: 0 })
const epic = video({ id: 'epic.mp4', plays: 0, lastPlayedAt: null, finishes: 0, intensity: { band: 'medium', meanSpm: 1, meanSpeed: 1, peakSpeed: 1 } })
const legendary = video({ id: 'legendary.mp4', plays: 0, lastPlayedAt: null, finishes: 0, starred: true, intensity: { band: 'intense', meanSpm: 1, meanSpeed: 1, peakSpeed: 1 } })

describe('pick', () => {
  const close = (got: Record<string, number>, want: Record<string, number>) => {
    for (const k of Object.keys(want))
      assert.ok(Math.abs(got[k] - want[k]) < 1e-9, `${k}: ${got[k]} vs ${want[k]}`)
  }

  it('rolls tiers by the odds, 55 / 30 / 12 / 3, when every tier has enough videos', () => {
    const chances = tierChances({ common: 400, rare: 200, epic: 100, legendary: 25 }, false)
    close(chances, { common: 0.55, rare: 0.3, epic: 0.12, legendary: 0.03 })
    assert.equal(rollTier(seq(0.549), chances), 'common')
    assert.equal(rollTier(seq(0.55), chances), 'rare')
    assert.equal(rollTier(seq(0.86), chances), 'epic')
    assert.equal(rollTier(seq(0.975), chances), 'legendary')
  })

  it('keeps a thin tier from taking its whole share, so its few videos do not repeat', () => {
    // 5 Commons in 725: they took 55% of the pulls, each one every 9 pulls.
    const counts = { common: 5, rare: 650, epic: 50, legendary: 20 }
    const chances = tierChances(counts, false)
    close(chances, { common: MAX_LIFT * 5 / 725, rare: 0.3 + 0.55 - MAX_LIFT * 5 / 725, epic: 0.12, legendary: 0.03 })
    for (const [t, n] of Object.entries(counts))
      assert.ok(chances[t as keyof typeof counts] / n <= MAX_LIFT / 725 + 1e-12, t)
  })

  it('rolls only Epic or Legendary when the pity is due, and a normal pull without them', () => {
    const chances = tierChances({ common: 10, rare: 10, epic: 10, legendary: 10 }, true)
    close(chances, { common: 0, rare: 0, epic: 0.8, legendary: 0.2 })
    assert.equal(rollTier(seq(0), chances), 'epic')
    assert.equal(rollTier(seq(0.99), chances), 'legendary')
    close(tierChances({ common: 0, rare: 3, epic: 0, legendary: 0 }, true), { rare: 1 })
  })

  it('falls back to the nearest tier, down for a normal pull and up for pity', () => {
    assert.deepEqual(fallbackOrder('rare', false), ['rare', 'common', 'epic', 'legendary'])
    assert.deepEqual(fallbackOrder('epic', true), ['epic', 'legendary', 'rare', 'common'])
  })

  it('picks from the rolled tier and keeps away from what is playing', () => {
    const pool = [common, rare, epic, legendary]
    assert.equal(pick(pool, { rand: seq(0.9, 0), now: NOW, pity: 0, pityAt: 10 })!.video.id, 'epic.mp4')
    const p = pick([common, rare], { rand: seq(0, 0), now: NOW, pity: 0, pityAt: 10, avoid: 'common.mp4' })!
    assert.equal(p.video.id, 'rare.mp4')
    assert.equal(p.tier, 'rare')
    assert.equal(pick([], { rand: Math.random, now: NOW, pity: 0, pityAt: 10 }), null)
  })

  it('pays out the pity, and counts it up and back down', () => {
    const p = pick([common, rare, legendary], { rand: seq(0, 0), now: NOW, pity: 10, pityAt: 10 })!
    assert.equal(p.guaranteed, true)
    assert.equal(p.tier, 'legendary')
    assert.equal(pityDue(9, 10), false)
    assert.equal(pityAfter(4, 'rare'), 5)
    assert.equal(pityAfter(9, 'epic'), 0)
  })

  it('filters the pool by script, stars and tags', () => {
    const f = { scriptedOnly: true, starredOnly: false, include: parseTags(' POV, hmv ,,'), exclude: ['vr'] }
    assert.deepEqual(f.include, ['pov', 'hmv'])
    assert.equal(inPool(video({ tags: ['pov'] }), f), true)
    assert.equal(inPool(video({ tags: ['pov', 'vr'] }), f), false)
    assert.equal(inPool(video({ tags: ['solo'] }), f), false)
    assert.equal(inPool(video({ tags: ['pov'], hasScript: false }), f), false)
  })
})
