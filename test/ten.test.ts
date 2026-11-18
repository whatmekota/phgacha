import type { Tier } from '../src/rarity.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyState, record, recordTen } from '../src/collection.ts'
import { bestIndex, pickMany, pityAfter, revealOrder, TEN } from '../src/pick.ts'
import { video } from './fixtures.ts'

const NOW = Date.UTC(2026, 10, 13)
const intense = { band: 'intense' as const, meanSpm: 1, meanSpeed: 1, peakSpeed: 1 }
const medium = { band: 'medium' as const, meanSpm: 1, meanSpeed: 1, peakSpeed: 1 }
// Ten Commons, three Epics and a Legendary (see rarity.test.ts for the points).
const commons = Array.from({ length: 10 }, (_, i) => video({ id: `c${i}` }))
const epics = Array.from({ length: 3 }, (_, i) => video({ id: `e${i}`, plays: 0, lastPlayedAt: null, finishes: 0, intensity: medium }))
const legendary = video({ id: 'l', plays: 0, lastPlayedAt: null, finishes: 0, starred: true, intensity: intense })
const pool = [...commons, ...epics, legendary]

describe('×10', () => {
  it('counts the pity across the ten', () => {
    // Always the lowest roll: Common, unless the pity is due (then Epic).
    const picks = pickMany(pool, TEN, { rand: () => 0, now: NOW, pity: 8, pityAt: 10 })
    assert.equal(picks.length, TEN)
    assert.deepEqual(picks.map(p => p.guaranteed), [false, false, true, false, false, false, false, false, false, false])
    assert.equal(picks[2].tier, 'epic')
    assert.equal(picks.reduce((pity, p) => pityAfter(pity, p.tier), 8), 7)
  })

  it('takes each video once while the pool has others, and keeps away from what plays', () => {
    const picks = pickMany(pool, TEN, { rand: () => 0, now: NOW, pity: 0, pityAt: 10, avoid: 'c0' })
    const ids = picks.map(p => p.video.id)
    assert.equal(new Set(ids).size, TEN)
    assert.ok(!ids.includes('c0'))
    // A pool of two: they come round again.
    assert.equal(pickMany(commons.slice(0, 2), 4, { rand: () => 0, now: NOW, pity: 0, pityAt: 10 }).length, 4)
  })

  it('shows them rarest last, and the best is the last shown', () => {
    const tiers: Tier[] = ['legendary', 'common', 'epic', 'common', 'rare', 'epic']
    const xs = tiers.map((tier, i) => ({ tier, i }))
    assert.deepEqual(revealOrder(xs).map(x => x.i), [1, 3, 4, 2, 5, 0])
    assert.equal(bestIndex(xs), 0)
    assert.equal(bestIndex([{ tier: 'rare' }, { tier: 'epic' }, { tier: 'epic' }, { tier: 'common' }]), 2)
    assert.equal(bestIndex([]), -1)
  })

  it('records a lucky ten and a dull one', () => {
    const ten = (tiers: Tier[]) => {
      let s = emptyState()
      for (const [i, tier] of tiers.entries())
        s = record(s, { id: `v${i}`, title: 'v', tier, modifier: null, guaranteed: false, at: 1 }, pityAfter(s.pity, tier))
      return recordTen(s, tiers)
    }
    const lucky = ten(['common', 'epic', 'rare', 'legendary', 'common', 'common', 'common', 'rare', 'common', 'common'])
    assert.deepEqual([lucky.feats.tens, lucky.feats.luckyTen, lucky.feats.dullTen], [1, 1, 0])
    assert.equal(lucky.pulls, 10)
    assert.equal(lucky.pity, 6)
    const dull = ten(Array.from({ length: 10 }, () => 'common' as const))
    assert.deepEqual([dull.feats.luckyTen, dull.feats.dullTen], [0, 1])
  })
})
