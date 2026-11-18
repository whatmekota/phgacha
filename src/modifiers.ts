import type { Rand } from './pick'
import type { Tier } from './rarity'
import type { MotionFilter } from './types'

/**
 * Modifiers: a twist rolled with each pull. Three reshape the stroke on its
 * way to the device (motion.filter), three change the speed (player.setRate),
 * one jumps to the end, one takes short breaks, and five change the picture
 * (player.effects). They last until the video changes or ends, or panic.
 */

export type ModifierId
  = | 'invert' | 'half' | 'top' | 'slow' | 'fast' | 'turbo' | 'finale' | 'breaks'
    | 'mirror' | 'noir' | 'dreamy' | 'tilt' | 'pulse'

/** What a modifier changes: the stroke, the speed, where it plays, breaks, or the picture. */
export type ModifierKind = 'stroke' | 'speed' | 'finale' | 'breaks' | 'picture'
export const MODIFIER_KINDS: readonly ModifierKind[] = ['stroke', 'speed', 'finale', 'breaks', 'picture']

export interface ModifierDef {
  id: ModifierId
  /** On the card and the badge. */
  name: string
  /** One line saying what it does. */
  hint: string
  kind: ModifierKind
  /** What it needs to mean anything. */
  needs: 'device' | 'script' | 'length' | null
  /** It changes the picture: only with player.effects, and a picture to change. */
  picture?: boolean
  /** It moves the picture all the time: never rolled with reduced motion. */
  moves?: boolean
}

export const MODIFIERS: ModifierDef[] = [
  { id: 'invert', name: 'Upside down', hint: 'The strokes inverted: top is bottom', kind: 'stroke', needs: 'device' },
  { id: 'half', name: 'Half range', hint: 'Half-length strokes, around the middle', kind: 'stroke', needs: 'device' },
  { id: 'top', name: 'Top half only', hint: 'The strokes squeezed into the top half', kind: 'stroke', needs: 'device' },
  { id: 'slow', name: 'Slow motion ×0.75', hint: 'Plays at three quarters speed', kind: 'speed', needs: null },
  { id: 'fast', name: 'Fast ×1.25', hint: 'Plays a quarter faster', kind: 'speed', needs: null },
  { id: 'turbo', name: 'Turbo ×1.5', hint: 'Plays half again as fast', kind: 'speed', needs: null },
  { id: 'finale', name: 'Finale only', hint: 'Straight to the last stretch', kind: 'finale', needs: 'length' },
  { id: 'breaks', name: 'Breaks', hint: 'A short pause every few strokes', kind: 'breaks', needs: 'script' },
  { id: 'mirror', name: 'Mirror', hint: 'The picture flipped left to right', kind: 'picture', needs: null, picture: true },
  { id: 'noir', name: 'Noir', hint: 'Black and white, with more contrast', kind: 'picture', needs: null, picture: true },
  { id: 'dreamy', name: 'Dreamy', hint: 'A little blur and a soft glow', kind: 'picture', needs: null, picture: true },
  { id: 'tilt', name: 'Tilt', hint: 'The picture turned a few degrees, zoomed so no edge shows', kind: 'picture', needs: null, picture: true },
  { id: 'pulse', name: 'Pulse', hint: 'The picture zooms a little with each stroke', kind: 'picture', needs: 'script', picture: true, moves: true },
]

export const MODIFIER_IDS = MODIFIERS.map(m => m.id)
export const modifierDef = (id: ModifierId) => MODIFIERS.find(m => m.id === id)!

/** Speed modifiers: the factor on the user's own speed. */
export const RATES: Partial<Record<ModifierId, number>> = { slow: 0.75, fast: 1.25, turbo: 1.5 }

/**
 * How much likelier a modifier is the rarer the pull. The setting's chance
 * is for a Rare; a Common gets about half of it, a Legendary nearly double.
 * "No modifier" stays the usual outcome at the default 40%.
 */
export const TIER_FACTOR: Record<Tier, number> = { common: 0.55, rare: 1, epic: 1.4, legendary: 1.8 }
/** Never certain: even a Legendary sometimes comes plain. */
export const MAX_CHANCE = 0.9

export const modifierChance = (base: number, tier: Tier) => Math.min(MAX_CHANCE, Math.max(0, base * TIER_FACTOR[tier]))

/** What the pulled video and the setup offer. */
export interface Situation {
  /** A device is connected that takes the stroke. */
  device: boolean
  hasScript: boolean
  /** Seconds, when known. */
  durationS: number | null
  /** How long the finale is, seconds. */
  finaleS: number
  /** The picture can be changed: player.effects is there and the file isn't sound alone. */
  picture: boolean
  /** The system asks for reduced motion. */
  still: boolean
}

/** Sound alone, by its extension: no picture for a picture modifier to change. */
export const isAudio = (path: string) => /\.(?:mp3|m4a|aac|wav|flac|ogg|oga|opus|wma)$/i.test(path)

/**
 * Whether a modifier would do anything here: a filter needs a device and a
 * script, the finale a video well over twice its length, a picture modifier
 * a picture, and Pulse a script and no request for reduced motion.
 */
export function eligible(m: ModifierDef, s: Situation): boolean {
  if (m.picture && !s.picture)
    return false
  if (m.moves && s.still)
    return false
  if (m.needs === 'device')
    return s.device && s.hasScript
  if (m.needs === 'script')
    return s.hasScript
  if (m.needs === 'length')
    return s.durationS !== null && s.durationS >= s.finaleS * 2
  return true
}

/**
 * The modifier for a pull: first whether there is one (the chance for its
 * tier), then which, evenly among those allowed in the settings that would
 * do something here. Null for none.
 */
export function rollModifier(tier: Tier, opts: { rand: Rand, chance: number, allowed: ModifierId[], situation: Situation }): ModifierId | null {
  if (opts.rand() >= modifierChance(opts.chance, tier))
    return null
  const can = MODIFIERS.filter(m => opts.allowed.includes(m.id) && eligible(m, opts.situation))
  if (!can.length)
    return null
  return can[Math.min(can.length - 1, Math.floor(opts.rand() * can.length))].id
}

/** The stroke filter for a modifier, or null if it isn't one. Only the stroke axis (L0) is reshaped. */
export function filterFor(id: ModifierId): MotionFilter | null {
  switch (id) {
    case 'invert':
      return (pos, { axis }) => (axis === 'L0' ? 1 - pos : pos)
    case 'half':
      return (pos, { axis }) => (axis === 'L0' ? 0.25 + pos * 0.5 : pos)
    case 'top':
      return (pos, { axis }) => (axis === 'L0' ? 0.5 + pos * 0.5 : pos)
    default:
      return null
  }
}

/** Where the finale starts, seconds: `finaleS` before the end, never before the start. */
export const finaleStart = (durationS: number, finaleS: number) => Math.max(0, durationS - finaleS)
