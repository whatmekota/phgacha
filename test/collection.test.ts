import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ago, emptyState, HISTORY_MAX, pushHistory, readState, record, sorted, tally } from '../src/collection.ts'

const pull = (id: string, tier: 'common' | 'rare' | 'epic' | 'legendary', at: number) =>
  ({ id, title: id, tier, modifier: null, guaranteed: false, at })

describe('collection', () => {
  it('keeps each video once, with its best tier and a count', () => {
    let s = record(emptyState(), pull('a', 'rare', 1), 1)
    assert.equal(s.last!.isNew, true)
    s = record(s, pull('a', 'epic', 2), 0)
    s = record(s, pull('a', 'common', 3), 1)
    assert.equal(s.last!.isNew, false)
    assert.deepEqual(s.collection.a, { title: 'a', best: 'epic', count: 3, first: 1, last: 3 })
    assert.equal(s.pulls, 3)
    assert.equal(s.pity, 1)
  })

  it('lists the rarest first, then the latest', () => {
    let s = record(emptyState(), pull('old-rare', 'rare', 1), 0)
    s = record(s, pull('legend', 'legendary', 2), 0)
    s = record(s, pull('new-rare', 'rare', 3), 0)
    assert.deepEqual(sorted(s.collection).map(([id]) => id), ['legend', 'new-rare', 'old-rare'])
    assert.deepEqual(tally(s.collection), { common: 0, rare: 2, epic: 0, legendary: 1 })
  })

  it('reads back what it saved, and drops what it can\'t trust', () => {
    const s = record(emptyState(), pull('a', 'epic', 5), 0)
    assert.deepEqual(readState(JSON.parse(JSON.stringify(s))), s)
    const junk = readState({ pulls: -3, pity: 'x', last: { id: 'a', tier: 'mythic' }, collection: { b: { best: 'nope' }, c: { best: 'rare', count: 0 } } })
    assert.equal(junk.pulls, 0)
    assert.equal(junk.last, null)
    assert.deepEqual(Object.keys(junk.collection), ['c'])
    assert.equal(junk.collection.c.count, 1)
    assert.deepEqual(readState(undefined), emptyState())
  })

  it('keeps the last 10 pulls, newest first', () => {
    let s = emptyState()
    for (let i = 1; i <= 12; i++)
      s = record(s, pull(`v${i}`, 'rare', i), 0)
    assert.equal(s.history.length, HISTORY_MAX)
    assert.deepEqual(s.history.map(x => x.id).slice(0, 3), ['v12', 'v11', 'v10'])
    assert.equal(s.history.at(-1)!.id, 'v3')
    assert.deepEqual(pushHistory([], s.history[0], 1), [s.history[0]])
    // Saved by 0.1.0, before the timeline: it starts empty.
    assert.deepEqual(readState({ pulls: 2, collection: {} }).history, [])
    assert.equal(readState(JSON.parse(JSON.stringify(s))).history.length, HISTORY_MAX)
  })

  it('says how long ago', () => {
    const now = 10_000_000_000
    assert.equal(ago(now - 10_000, now), 'just now')
    assert.equal(ago(now - 120_000, now), '2 min ago')
    assert.equal(ago(now - 3 * 3_600_000, now), '3 h ago')
    assert.equal(ago(now - 26 * 3_600_000, now), 'yesterday')
    assert.equal(ago(now - 5 * 86_400_000, now), '5 days ago')
  })
})
