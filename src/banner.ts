import type { LibraryVideo } from './types'

/**
 * The daily banner: one tag from the library featured for the day. Within
 * the tier a pull rolls, a video with that tag comes up half the time (when
 * the tier has one), or less when only a few of the tier's videos have it.
 * The tag is picked by the date, so it holds all day.
 */

/** A tag needs this many videos in the pool to be on the banner. */
export const BANNER_MIN = 3
/** How often a pull takes a banner video from its tier, when the tier has one. */
export const BANNER_CHANCE = 0.5
/**
 * But no more often than this many times the tagged videos' share of the
 * tier: with 3 of 650 tagged, half the tier's pulls would go to those 3, and
 * they'd come up every few pulls. So a banner video comes up at most about
 * four times as often as one without the tag.
 */
export const BANNER_BOOST = 3

/** How often a pull takes a banner video from a tier of `n` videos, `k` of them with the tag. */
export const bannerChance = (k: number, n: number) => (n ? Math.min(BANNER_CHANCE, BANNER_BOOST * k / n) : 0)

/** The local date, "2026-11-17": the banner changes at midnight. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** A 32-bit hash of a string (FNV-1a, then mixed so that near names spread apart). */
export function hash(s: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85EBCA6B)
  h ^= h >>> 13
  h = Math.imul(h, 0xC2B2AE35)
  h ^= h >>> 16
  return h >>> 0
}

/** Tags with at least BANNER_MIN videos in the pool, with how many. */
export function bannerCandidates(pool: Pick<LibraryVideo, 'tags'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of pool) {
    for (const t of new Set(v.tags))
      counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  for (const [t, n] of counts) {
    if (n < BANNER_MIN)
      counts.delete(t)
  }
  return counts
}

/**
 * The day's banner tag, or null when no tag has BANNER_MIN videos. Each
 * candidate gets a score from the day and its name, and the highest wins:
 * the same all day, and a tag coming or going changes the pick only when it
 * is the winner (or beats it).
 */
export function bannerTag(pool: Pick<LibraryVideo, 'tags'>[], day: string): string | null {
  let best: string | null = null
  let top = -1
  for (const t of bannerCandidates(pool).keys()) {
    const s = hash(`${day}|${t}`)
    if (s > top || (s === top && best !== null && t < best)) {
      top = s
      best = t
    }
  }
  return best
}
