import type { Tier } from './rarity'
import type { LibraryVideo } from './types'
import { bannerChance } from './banner'
import { atLeast, rank, tierOf, TIERS } from './rarity'

/** A random number in [0, 1); Math.random, or a fixed sequence in tests. */
export type Rand = () => number

/**
 * The machine's odds, in percent. A pull rolls the tier first and then a
 * video of that tier, like a real gacha: the odds stay the same whatever the
 * library looks like, so a Legendary feels like one even when the library
 * is full of them. Unless a tier has too few videos for its share: see
 * MAX_LIFT.
 */
export const ODDS: Record<Tier, number> = { common: 55, rare: 30, epic: 12, legendary: 3 }

/**
 * A video comes up at most this many times as often as it would in a plain
 * shuffle of the pool. Without it a thin tier takes its whole share anyway,
 * and its few videos come up again and again: in a library of 725 with 5
 * Commons, each of those 5 came up once every 9 pulls. What a tier can't take
 * goes to the nearest tier with room, as with an empty tier.
 */
export const MAX_LIFT = 2

export interface PoolFilter {
  scriptedOnly: boolean
  starredOnly: boolean
  /** Lower case; a video needs one of them (none: any video). */
  include: string[]
  /** Lower case; a video with any of them is left out. */
  exclude: string[]
}

/** "Solo, POV ,, pov" → ['solo', 'pov']. */
export function parseTags(text: unknown): string[] {
  if (typeof text !== 'string')
    return []
  return [...new Set(text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))]
}

export function inPool(v: LibraryVideo, f: PoolFilter): boolean {
  if (f.scriptedOnly && !v.hasScript)
    return false
  if (f.starredOnly && !v.starred)
    return false
  if (f.include.length && !f.include.some(t => v.tags.includes(t)))
    return false
  return !f.exclude.some(t => v.tags.includes(t))
}

/**
 * Each tier's chance for a pool with `counts` videos in each: the odds, but
 * no more for a tier than MAX_LIFT times its share of the pool, the rest
 * going to the nearest tier with room (down for a normal pull, up for a
 * guaranteed one). With `guaranteed` (pity) only Epic and Legendary are in
 * the draw, at their usual odds against each other; if the pool has neither,
 * it's a normal pull. All 0 for an empty pool.
 */
export function tierChances(counts: Record<Tier, number>, guaranteed: boolean): Record<Tier, number> {
  const draw = guaranteed ? TIERS.filter(t => atLeast(t, 'epic')) : TIERS
  const total = draw.reduce((s, t) => s + counts[t], 0)
  if (guaranteed && !total)
    return tierChances(counts, false)
  const out: Record<Tier, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  if (!total)
    return out
  const sum = draw.reduce((s, t) => s + ODDS[t], 0)
  const room = (t: Tier) => Math.max(0, MAX_LIFT * counts[t] / total - out[t])
  const over: [Tier, number][] = []
  for (const t of draw) {
    const want = ODDS[t] / sum
    out[t] = Math.min(want, room(t))
    if (want > out[t])
      over.push([t, want - out[t]])
  }
  for (const [t, excess] of over) {
    let left = excess
    for (const u of fallbackOrder(t, guaranteed)) {
      if (left <= 0)
        break
      if (!draw.includes(u))
        continue
      const take = Math.min(left, room(u))
      out[u] += take
      left -= take
    }
  }
  return out
}

/** The tier a pull rolls, by these chances. */
export function rollTier(rand: Rand, chances: Record<Tier, number>): Tier {
  const live = TIERS.filter(t => chances[t] > 0)
  const sum = live.reduce((s, t) => s + chances[t], 0)
  let r = rand() * sum
  for (const t of live) {
    r -= chances[t]
    if (r < 0)
      return t
  }
  return live[live.length - 1]
}

/** How many videos of each tier the pool has. */
export function tierCounts(pool: readonly LibraryVideo[], now: number): Record<Tier, number> {
  const out: Record<Tier, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (const v of pool)
    out[tierOf(v, now)]++
  return out
}

/**
 * Where a tier's chance goes when it has no videos, or too few: the nearest
 * tier with room. A tie goes down for a normal pull (no free upgrades) and up
 * for a guaranteed one (pity should pay out when it can).
 */
export function fallbackOrder(rolled: Tier, guaranteed: boolean): Tier[] {
  const r = rank(rolled)
  return [...TIERS].sort((a, b) => {
    const da = Math.abs(rank(a) - r)
    const db = Math.abs(rank(b) - r)
    if (da !== db)
      return da - db
    return guaranteed ? rank(b) - rank(a) : rank(a) - rank(b)
  })
}

export interface Pick {
  video: LibraryVideo
  tier: Tier
  /** This pull was the pity's. */
  guaranteed: boolean
  /** The video has the day's banner tag. */
  banner: boolean
}

export interface PickOptions {
  rand: Rand
  now: number
  pity: number
  pityAt: number
  /** What's playing now (and, for a ×10, what it already took): left out unless that's all there is. */
  avoid?: string | null | readonly string[]
  /** The day's banner tag: half the time, the tier's video is one with it. */
  banner?: string | null
}

/**
 * One pull from the pool: roll a tier (Epic or better if the pity is due) by
 * tierChances, then take one of its videos at random; with a banner tag, half the time one of those with the tag (when
 * the tier has one; less when it has only a few, see bannerChance). Videos in `avoid` are left out unless they're all
 * there is. Null for an empty pool.
 */
export function pick(pool: LibraryVideo[], opts: PickOptions): Pick | null {
  const skip = new Set(typeof opts.avoid === 'string' ? [opts.avoid] : opts.avoid ?? [])
  const left = skip.size ? pool.filter(v => !skip.has(v.id)) : pool
  const choices = left.length ? left : pool
  if (!choices.length)
    return null
  const byTier = new Map<Tier, LibraryVideo[]>(TIERS.map(t => [t, []]))
  for (const v of choices)
    byTier.get(tierOf(v, opts.now))!.push(v)
  const guaranteed = pityDue(opts.pity, opts.pityAt)
  const counts: Record<Tier, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
  for (const t of TIERS)
    counts[t] = byTier.get(t)!.length
  const tier = rollTier(opts.rand, tierChances(counts, guaranteed))
  let list = byTier.get(tier)!
  const tag = opts.banner
  if (tag) {
    const tagged = list.filter(v => v.tags.includes(tag))
    // The rest of the time it's the whole tier, the banner's videos included.
    if (tagged.length && opts.rand() < bannerChance(tagged.length, list.length))
      list = tagged
  }
  const video = list[Math.min(list.length - 1, Math.floor(opts.rand() * list.length))]
  return { video, tier, guaranteed, banner: !!tag && video.tags.includes(tag) }
}

/** How many a ×10 pulls. */
export const TEN = 10

/**
 * `n` pulls at once, as `n` pulls one after another would go: the pity
 * counts across them (a ninth pull without an Epic makes the tenth one
 * guaranteed), and none takes a video another already took, while the pool
 * has others.
 */
export function pickMany(pool: LibraryVideo[], n: number, opts: PickOptions): Pick[] {
  const out: Pick[] = []
  const avoid = typeof opts.avoid === 'string' ? [opts.avoid] : [...opts.avoid ?? []]
  let pity = opts.pity
  for (let i = 0; i < n; i++) {
    const p = pick(pool, { ...opts, pity, avoid })
    if (!p)
      break
    out.push(p)
    avoid.push(p.video.id)
    pity = pityAfter(pity, p.tier)
  }
  return out
}

/** The order a ×10 is shown and played in: rarest last, otherwise as pulled. */
export const revealOrder = <T extends { tier: Tier }>(xs: readonly T[]): T[] =>
  xs.map((x, i) => [x, i] as const).sort(([a, i], [b, j]) => rank(a.tier) - rank(b.tier) || i - j).map(([x]) => x)

/** The best of a ×10: the rarest, the last of them on a tie (the one shown last). -1 for none. */
export function bestIndex(xs: readonly { tier: Tier }[]): number {
  let best = -1
  for (const [i, x] of xs.entries()) {
    if (best < 0 || rank(x.tier) >= rank(xs[best].tier))
      best = i
  }
  return best
}

/** `pity` pulls in a row without an Epic or better: the next one is guaranteed once that reaches `pityAt`. */
export const pityDue = (pity: number, pityAt: number) => pity >= pityAt

/** The pity count after a pull of `tier`: back to 0 on Epic or better. */
export const pityAfter = (pity: number, tier: Tier) => (atLeast(tier, 'epic') ? 0 : pity + 1)
