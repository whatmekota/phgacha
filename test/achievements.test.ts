import type { Tier } from '../src/rarity.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ACHIEVEMENTS, createTrophies, standing } from '../src/achievements.ts'
import { bump, emptyState, endure, readState, record } from '../src/collection.ts'
import { pityAfter } from '../src/pick.ts'

const pull = (s: ReturnType<typeof emptyState>, id: string, tier: Tier, opts: { guaranteed?: boolean, banner?: boolean } = {}) =>
  record(s, { id, title: id, tier, modifier: null, guaranteed: !!opts.guaranteed, at: 1 }, pityAfter(s.pity, tier), { banner: opts.banner })

describe('achievements', () => {
  it('are well formed', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.length >= 15 && ids.length <= 20)
    for (const a of ACHIEVEMENTS) {
      assert.match(a.id, /^[a-z0-9-]+$/)
      assert.ok(a.icon && a.title && !a.description.endsWith('.'), a.id)
    }
    // standing() counts exactly the counted ones, and with everything done, earns exactly the rest.
    const counted = ACHIEVEMENTS.filter(a => a.target).map(a => a.id).sort()
    assert.deepEqual(Object.keys(standing(emptyState()).progress).sort(), counted)
    const all = readState({ pulls: 1, legendaries: 1, tiers: { common: 1, rare: 1, epic: 1, legendary: 1 }, endured: ['turbo'], feats: { pityLegendary: 1, liedLow: 1, banner: 1, tens: 1, luckyTen: 1, dullTen: 1, backToBack: 1 } })
    assert.deepEqual(standing(all).earned.sort(), ids.filter(id => !counted.includes(id)).sort())
  })

  it('count a history saved before 0.4.0', () => {
    // 0.3.0's state: no tiers, feats or endured. 30 videos, two of them gold; the last pull the pity's Legendary.
    const collection: Record<string, unknown> = {}
    for (let i = 0; i < 30; i++)
      collection[`v${i}`] = { title: `v${i}`, best: i < 2 ? 'legendary' : i < 5 ? 'epic' : 'rare', count: 4, first: 1, last: 2 }
    const old = { pulls: 120, pity: 0, last: { id: 'v0', title: 'v0', tier: 'legendary', modifier: null, guaranteed: true, isNew: false, at: 2 }, collection, history: [], legendaries: 6, sinceLegendary: 0 }
    const { progress, earned } = standing(readState(old))
    assert.deepEqual(progress, {
      'pulls-10': 10,
      'pulls-100': 100,
      'pulls-500': 120,
      'legendary-5': 5,
      'legendary-25': 6,
      'collect-25': 25,
      'collect-100': 30,
      'collect-250': 30,
      'every-twist': 0,
    })
    assert.deepEqual(earned.sort(), ['first-epic', 'first-legendary', 'first-pull', 'first-rare', 'pity-gold'])
  })

  it('earn the rarer ones from what happened', () => {
    let s = pull(emptyState(), 'a', 'common', { banner: true })
    assert.ok(standing(s).earned.includes('banner-pull'))
    assert.ok(!standing(s).earned.includes('first-rare'))
    s = pull(s, 'b', 'legendary')
    s = pull(s, 'c', 'legendary')
    assert.equal(s.feats.backToBack, 1)
    s = endure(endure(endure(s, 'turbo'), 'mirror'), 'noir')
    s = bump(s, 'liedLow')
    const { progress, earned } = standing(s)
    assert.equal(progress['every-twist'], 2)
    for (const id of ['back-to-back', 'turbo-survivor', 'lied-low', 'first-legendary'])
      assert.ok(earned.includes(id), id)
    assert.ok(!earned.includes('pity-gold'))
  })

  it('hand over only what changed, and do nothing without the API', () => {
    const calls: string[] = []
    const api = {
      define: (list: unknown[]) => void calls.push(`define ${list.length}`),
      unlock: (id: string) => (calls.push(`unlock ${id}`), true),
      progress: (id: string, n: number) => void calls.push(`progress ${id} ${n}`),
      unlocked: () => ({}),
    }
    const t = createTrophies(api)
    assert.equal(calls[0], `define ${ACHIEVEMENTS.length}`)
    const s = pull(emptyState(), 'a', 'rare')
    t.sync(s)
    assert.ok(calls.includes('unlock first-pull') && calls.includes('unlock first-rare') && calls.includes('progress pulls-10 1'))
    const n = calls.length
    t.sync(s)
    assert.equal(calls.length, n)
    t.sync(pull(s, 'b', 'common'))
    assert.deepEqual(calls.slice(n).filter(c => c.startsWith('progress pulls')), ['progress pulls-10 2', 'progress pulls-100 2', 'progress pulls-500 2'])
    assert.ok(!calls.slice(n).some(c => c.startsWith('unlock')))
    const none = createTrophies(undefined)
    assert.equal(none.available, false)
    none.sync(s)
    assert.equal(createTrophies({}).available, false)
  })
})
