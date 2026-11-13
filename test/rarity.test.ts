import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reasons, scoreOf, tierOf, tierOfScore } from '../src/rarity.ts'
import { video } from './fixtures.ts'

const NOW = Date.UTC(2026, 10, 13)
const DAY = 86_400_000
const band = (b: 'gentle' | 'medium' | 'intense') => ({ band: b, meanSpm: 60, meanSpeed: 100, peakSpeed: 300 })

describe('rarity', () => {
  it('cuts the points into tiers', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(tierOfScore), ['common', 'common', 'rare', 'rare', 'epic', 'legendary', 'legendary'])
  })

  it('makes a gentle favourite Common and a hard, starred, never-played one Legendary', () => {
    assert.equal(tierOf(video({ intensity: band('gentle') }), NOW), 'common')
    const s = scoreOf(video({ intensity: band('intense'), plays: 0, lastPlayedAt: null, finishes: 0, starred: true }), NOW)
    assert.equal(s.total, 6)
    assert.equal(tierOfScore(s.total), 'legendary')
    assert.deepEqual(reasons(s), ['intense', 'never played', 'never finished', 'starred'])
  })

  it('counts a video left alone for 60 days, or played once or twice, as rarely played', () => {
    assert.equal(scoreOf(video({ lastPlayedAt: NOW - 61 * DAY }), NOW).alone, 1)
    assert.equal(scoreOf(video({ plays: 2 }), NOW).alone, 1)
    assert.equal(scoreOf(video({ lastPlayedAt: NOW - 59 * DAY }), NOW).alone, 0)
  })

  it('puts an unanalysed, never-played video in Rare', () => {
    assert.equal(tierOf(video({ plays: 0, lastPlayedAt: null, finishes: 0 }), NOW), 'rare')
  })
})
