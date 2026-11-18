import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bannerCandidates, bannerChance, bannerTag, dayKey } from '../src/banner.ts'
import { pick } from '../src/pick.ts'
import { video } from './fixtures.ts'

const NOW = Date.UTC(2026, 10, 13)
const seq = (...xs: number[]) => () => xs.shift() ?? 0
const tagged = (id: string, ...tags: string[]) => video({ id, tags })

describe('banner', () => {
  // pov on 3 videos, solo on 4, hmv on 2 (too few).
  const pool = [
    tagged('a', 'pov', 'solo'),
    tagged('b', 'pov', 'hmv'),
    tagged('c', 'pov', 'solo'),
    tagged('d', 'solo', 'hmv'),
    tagged('e', 'solo'),
  ]

  it('features a tag with at least 3 videos, the same all day', () => {
    assert.deepEqual([...bannerCandidates(pool).keys()].sort(), ['pov', 'solo'])
    const day = dayKey(new Date(2026, 10, 17, 9, 30))
    assert.equal(day, '2026-11-17')
    assert.equal(dayKey(new Date(2026, 10, 17, 23, 59)), day)
    const tag = bannerTag(pool, day)
    assert.ok(tag === 'pov' || tag === 'solo')
    assert.equal(bannerTag([...pool].reverse(), day), tag)
    assert.equal(bannerTag(pool.slice(3), day), null)
  })

  it('changes with the day, and keeps its pick when another tag comes along', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap(t => [1, 2, 3].map(i => tagged(`${t}${i}`, t)))
    const days = Array.from({ length: 30 }, (_, i) => bannerTag(many, dayKey(new Date(2026, 10, 1 + i))))
    assert.ok(new Set(days).size > 3)
    // A tag that loses to the day's pick can come or go without changing it.
    const day = '2026-11-17'
    const tag = bannerTag(many, day)!
    const loser = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].find(t => t !== tag)!
    assert.equal(bannerTag(many.filter(v => !v.tags.includes(loser)), day), tag)
  })

  it('takes a banner video from the rolled tier half the time, when the tier has one', () => {
    const plain = [video({ id: 'x' }), video({ id: 'y' }), video({ id: 'z' })]
    const withTag = [...plain, tagged('pov.mp4', 'pov')]
    const opts = { now: NOW, pity: 0, pityAt: 10, banner: 'pov' }
    // Common rolled (0), banner roll won (0.2): the tagged one.
    const won = pick(withTag, { ...opts, rand: seq(0, 0.2, 0) })!
    assert.equal(won.video.id, 'pov.mp4')
    assert.equal(won.banner, true)
    // Banner roll lost (0.7): the whole tier, the tagged one still in it.
    assert.equal(pick(withTag, { ...opts, rand: seq(0, 0.7, 0) })!.video.id, 'x')
    assert.equal(pick(withTag, { ...opts, rand: seq(0, 0.7, 0.99) })!.video.id, 'pov.mp4')
    // No banner video in the tier: no banner roll, the usual pick.
    const p = pick(plain, { ...opts, rand: seq(0, 0.99) })!
    assert.equal(p.video.id, 'z')
    assert.equal(p.banner, false)
    // A few tagged in a big tier: about four times as likely as the rest, not half the pulls.
    assert.equal(bannerChance(3, 650), 9 / 650)
    assert.equal(bannerChance(1, 4), 0.5)
  })
})
