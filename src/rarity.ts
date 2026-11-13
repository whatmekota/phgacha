import type { LibraryVideo } from './types'

/**
 * How rare a video is, worked out from what playhound knows about it. Every
 * video gets a few points, and the points make the tier:
 *
 *   intensity     gentle 0, medium 1, intense 2 (0 until its script is analysed)
 *   left alone    never played 2; not played for 60 days, or played only
 *                 once or twice, 1; else 0
 *   unfinished    never marked "I came" on it: 1
 *   starred       1
 *
 * 0–1 points is Common, 2–3 Rare, 4 Epic, 5–6 Legendary. So a hard, starred
 * video you've never played is Legendary, the gentle one you watch every week
 * is Common, and most of a fresh library lands in Rare.
 */

export type Tier = 'common' | 'rare' | 'epic' | 'legendary'
export const TIERS: readonly Tier[] = ['common', 'rare', 'epic', 'legendary']

export interface TierInfo {
  name: string
  /** Stars on the card, 1–4. */
  stars: number
  /** Its colour on the card, the capsule and the glow. Fixed, not the theme's: rarity colours are a convention. */
  colour: string
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  common: { name: 'Common', stars: 1, colour: '#94a3b8' },
  rare: { name: 'Rare', stars: 2, colour: '#38bdf8' },
  epic: { name: 'Epic', stars: 3, colour: '#c084fc' },
  legendary: { name: 'Legendary', stars: 4, colour: '#fbbf24' },
}

export const rank = (t: Tier) => TIERS.indexOf(t)
export const atLeast = (t: Tier, min: Tier) => rank(t) >= rank(min)

const DAY_MS = 86_400_000
/** Not played for this long counts as left alone. */
export const STALE_DAYS = 60

export interface Score {
  intensity: number
  alone: number
  unfinished: number
  starred: number
  total: number
}

type Rated = Pick<LibraryVideo, 'intensity' | 'plays' | 'lastPlayedAt' | 'finishes' | 'starred'>

export function scoreOf(v: Rated, now: number): Score {
  const band = v.intensity?.band
  const intensity = band === 'intense' ? 2 : band === 'medium' ? 1 : 0
  let alone = 0
  if (v.plays === 0 || v.lastPlayedAt === null)
    alone = 2
  else if (v.plays <= 2 || now - v.lastPlayedAt > STALE_DAYS * DAY_MS)
    alone = 1
  const unfinished = v.finishes === 0 ? 1 : 0
  const starred = v.starred ? 1 : 0
  return { intensity, alone, unfinished, starred, total: intensity + alone + unfinished + starred }
}

export function tierOfScore(total: number): Tier {
  if (total >= 5)
    return 'legendary'
  if (total >= 4)
    return 'epic'
  if (total >= 2)
    return 'rare'
  return 'common'
}

export const tierOf = (v: Rated, now: number): Tier => tierOfScore(scoreOf(v, now).total)

/** Why it is that rare, in a few words for the card ("intense · never played · starred"). */
export function reasons(s: Score): string[] {
  const out: string[] = []
  if (s.intensity === 2)
    out.push('intense')
  else if (s.intensity === 1)
    out.push('medium')
  if (s.alone === 2)
    out.push('never played')
  else if (s.alone === 1)
    out.push('rarely played')
  if (s.unfinished)
    out.push('never finished')
  if (s.starred)
    out.push('starred')
  return out
}
