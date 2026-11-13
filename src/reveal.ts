import type { Rand } from './pick'
import type { Tier } from './rarity'
import { rank } from './rarity'

/**
 * How a pull is revealed: the colours the capsule glows on its way out, and
 * how long each beat takes. The rarer the pull, the longer the crank, the
 * drop and the wobble, so an Epic or a Legendary is felt before it's seen.
 *
 * The capsule hints its tier by its glow, and sometimes lies low: an Epic
 * may come out blue and turn purple, a Legendary blue or purple and turn
 * gold. It never shows more than it is (no fake gold on an Epic), so a gold
 * glow always means Legendary.
 */
export interface RevealPlan {
  /** The glow in order; the last is the real tier. */
  steps: Tier[]
  crankMs: number
  dropMs: number
  /** Wobble time on each step; it builds, quicker and harder, step by step. */
  wobbleMs: number[]
  /** How long the title card holds after it opens (Epic and Legendary). */
  holdMs: number
}

const CRANK: Record<Tier, number> = { common: 550, rare: 620, epic: 900, legendary: 1150 }
const DROP: Record<Tier, number> = { common: 480, rare: 520, epic: 600, legendary: 680 }
const WOBBLE: Record<Tier, number> = { common: 330, rare: 450, epic: 650, legendary: 750 }
const HOLD: Record<Tier, number> = { common: 0, rare: 0, epic: 1300, legendary: 2600 }

/** The glow steps: the real tier, or a lower start that upgrades to it. */
export function revealSteps(tier: Tier, rand: Rand): Tier[] {
  const r = rand()
  switch (tier) {
    case 'rare':
      return r < 0.15 ? ['common', 'rare'] : ['rare']
    case 'epic':
      return r < 0.35 ? ['rare', 'epic'] : ['epic']
    case 'legendary':
      if (r < 0.3)
        return ['rare', 'legendary']
      if (r < 0.55)
        return ['epic', 'legendary']
      if (r < 0.75)
        return ['rare', 'epic', 'legendary']
      return ['legendary']
    default:
      return ['common']
  }
}

export function revealPlan(tier: Tier, rand: Rand, opts: { compact?: boolean } = {}): RevealPlan {
  const steps = revealSteps(tier, rand)
  // Each step wobbles a little shorter than the last, as it builds; the final one waits longest at Legendary.
  const wobbleMs = steps.map((_, i) => Math.round(WOBBLE[tier] * (i === steps.length - 1 ? 1 : 0.8)))
  // The panel's version is the same story, a little quicker.
  const k = opts.compact ? 0.75 : 1
  return {
    steps,
    crankMs: Math.round(CRANK[tier] * k),
    dropMs: Math.round(DROP[tier] * k),
    wobbleMs: wobbleMs.map(ms => Math.round(ms * k)),
    holdMs: holdFor(tier, opts.compact),
  }
}

/** How long the title card holds for `tier`: 0 for Common and Rare. */
export const holdFor = (tier: Tier, compact = false) => Math.round(HOLD[tier] * (compact ? 0.6 : 1))

/** Whether a step up is a real upgrade (for the flash and the sound). */
export const isUpgrade = (from: Tier, to: Tier) => rank(to) > rank(from)
