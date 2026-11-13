import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fallbackOrder, inPool, parseTags, pick, pityAfter, pityDue, rollTier } from '../src/pick.ts'
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
  it('rolls tiers by the odds: 55 / 30 / 12 / 3', () => {
    assert.equal(rollTier(seq(0), false), 'common')
    assert.equal(rollTier(seq(0.549), false), 'common')
    assert.equal(rollTier(seq(0.55), false), 'rare')
    assert.equal(rollTier(seq(0.86), false), 'epic')
    assert.equal(rollTier(seq(0.975), false), 'legendary')
  })

  it('rolls only Epic or Legendary when the pity is due', () => {
    assert.equal(rollTier(seq(0), true), 'epic')
    assert.equal(rollTier(seq(0.99), true), 'legendary')
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
