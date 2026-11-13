import type { Tier } from './rarity'
import type { LibraryVideo } from './types'
import { atLeast, rank, tierOf, TIERS } from './rarity'

/** A random number in [0, 1); Math.random, or a fixed sequence in tests. */
export type Rand = () => number

/**
 * The machine's odds, in percent. A pull rolls the tier first and then a
 * video of that tier, like a real gacha: the odds stay the same whatever the
 * library looks like, so a Legendary feels like one even when the library
 * is full of them.
 */
export const ODDS: Record<Tier, number> = { common: 55, rare: 30, epic: 12, legendary: 3 }

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
 * The tier this pull rolls. With `guaranteed` (pity) only Epic and Legendary
 * are in the draw, at their usual odds against each other.
 */
export function rollTier(rand: Rand, guaranteed: boolean): Tier {
  const tiers = guaranteed ? TIERS.filter(t => atLeast(t, 'epic')) : TIERS
  const sum = tiers.reduce((s, t) => s + ODDS[t], 0)
  let r = rand() * sum
  for (const t of tiers) {
    r -= ODDS[t]
    if (r < 0)
      return t
  }
  return tiers[tiers.length - 1]
}

/**
 * Which tier to take a video from when the rolled one has none: the nearest
 * tier that does. A tie goes down for a normal pull (no free upgrades) and up
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
}

/**
 * One pull from the pool: roll a tier (Epic or better if the pity is due),
 * fall back to the nearest tier with videos in it, then take one of them at
 * random. `avoid` (what's playing now) is left out unless it's all there is.
 * Null for an empty pool.
 */
export function pick(pool: LibraryVideo[], opts: { rand: Rand, now: number, pity: number, pityAt: number, avoid?: string | null }): Pick | null {
  const choices = pool.length > 1 && opts.avoid ? pool.filter(v => v.id !== opts.avoid) : pool
  if (!choices.length)
    return null
  const byTier = new Map<Tier, LibraryVideo[]>(TIERS.map(t => [t, []]))
  for (const v of choices)
    byTier.get(tierOf(v, opts.now))!.push(v)
  const guaranteed = pityDue(opts.pity, opts.pityAt)
  const rolled = rollTier(opts.rand, guaranteed)
  const tier = fallbackOrder(rolled, guaranteed).find(t => byTier.get(t)!.length)!
  const list = byTier.get(tier)!
  const video = list[Math.min(list.length - 1, Math.floor(opts.rand() * list.length))]
  return { video, tier, guaranteed }
}

/** `pity` pulls in a row without an Epic or better: the next one is guaranteed once that reaches `pityAt`. */
export const pityDue = (pity: number, pityAt: number) => pity >= pityAt

/** The pity count after a pull of `tier`: back to 0 on Epic or better. */
export const pityAfter = (pity: number, tier: Tier) => (atLeast(tier, 'epic') ? 0 : pity + 1)
