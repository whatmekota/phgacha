import type { ModifierId } from './modifiers'
import type { PoolFilter } from './pick'
import type { SettingField } from './types'
import { MODIFIERS } from './modifiers'
import { parseTags } from './pick'

export interface Config {
  pool: PoolFilter
  /** 0–1: the chance of a modifier on a Rare pull (see modifierChance). */
  chance: number
  allowed: ModifierId[]
  finaleS: number
  breakEvery: number
  breakS: number
  /** Pulls without an Epic or better before one is guaranteed. */
  pityAt: number
  animation: boolean
  /** After a pull on the machine's page, go to the player. */
  toPlayer: boolean
  /** The small label over the video while a modifier is on. */
  badge: boolean
  sounds: boolean
  /** 0–1. */
  volume: number
}

const modKey = (id: ModifierId) => `mod_${id}`

export const FIELDS: SettingField[] = [
  { type: 'heading', label: 'Pool', hint: 'Which videos the machine pulls from.' },
  { key: 'scriptedOnly', type: 'switch', label: 'Only videos with a script', default: true },
  { key: 'starredOnly', type: 'switch', label: 'Only starred videos', default: false },
  { key: 'tagsInclude', type: 'text', label: 'With one of these tags', hint: 'Comma-separated. Empty: any video.', placeholder: 'pov, hmv', default: '' },
  { key: 'tagsExclude', type: 'text', label: 'Without any of these tags', hint: 'Comma-separated.', placeholder: 'vr', default: '' },

  { type: 'heading', label: 'Modifiers', hint: 'A twist rolled with each pull; it ends with the video, or on panic.' },
  { key: 'chance', type: 'slider', label: 'Modifier chance', hint: 'For a Rare pull. A Common gets about half of it, an Epic or Legendary more (never above 90%).', min: 0, max: 100, step: 5, unit: '%', default: 40 },
  ...MODIFIERS.map((m): SettingField => ({ key: modKey(m.id), type: 'switch', label: m.name, hint: m.hint + (m.needs === 'device' ? '. Only with a device connected.' : '.'), default: true })),
  { key: 'finaleS', type: 'slider', label: 'Finale length', hint: 'Finale only starts this long before the end.', min: 30, max: 300, step: 15, unit: ' s', default: 90, when: v => v.mod_finale !== false },
  { key: 'breakEvery', type: 'slider', label: 'A break every', min: 10, max: 60, step: 5, unit: ' strokes', default: 20, when: v => v.mod_breaks !== false },
  { key: 'breakS', type: 'slider', label: 'Break length', min: 2, max: 15, step: 1, unit: ' s', default: 4, when: v => v.mod_breaks !== false },

  { type: 'heading', label: 'Machine' },
  { key: 'pityAt', type: 'slider', label: 'Pity', hint: 'After this many pulls in a row without an Epic or better, the next one is guaranteed to be.', min: 3, max: 30, step: 1, unit: ' pulls', default: 10 },
  { key: 'animation', type: 'switch', label: 'Pull animation', hint: 'The crank, the capsule and the reveal, grander the rarer the pull. Off, the card shows at once. With reduced motion, an Epic or Legendary still gets its title card, without the movement.', default: true },
  { key: 'sounds', type: 'switch', label: 'Sounds', hint: 'A short sound on each reveal, grander the rarer: a blip, a chime, an arpeggio, a fanfare.', default: true },
  { key: 'volume', type: 'slider', label: 'Volume', min: 5, max: 100, step: 5, unit: '%', default: 40, when: v => v.sounds !== false },
  { key: 'toPlayer', type: 'switch', label: 'Go to the player after a pull', hint: 'From the machine\'s page, a moment after the reveal.', default: true },
  { key: 'badge', type: 'switch', label: 'Show the modifier over the video', hint: 'A small label at the top for a few seconds, and the countdown during a break.', default: true },
]

const num = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

/** The settings as the plugin uses them, whatever was stored. */
export function readConfig(v: Record<string, unknown>): Config {
  return {
    pool: {
      scriptedOnly: v.scriptedOnly !== false,
      starredOnly: v.starredOnly === true,
      include: parseTags(v.tagsInclude),
      exclude: parseTags(v.tagsExclude),
    },
    chance: num(v.chance, 40, 0, 100) / 100,
    allowed: MODIFIERS.filter(m => v[modKey(m.id)] !== false).map(m => m.id),
    finaleS: num(v.finaleS, 90, 30, 300),
    breakEvery: Math.round(num(v.breakEvery, 20, 10, 60)),
    breakS: num(v.breakS, 4, 2, 15),
    pityAt: Math.round(num(v.pityAt, 10, 3, 30)),
    animation: v.animation !== false,
    toPlayer: v.toPlayer !== false,
    badge: v.badge !== false,
    sounds: v.sounds !== false,
    volume: num(v.volume, 40, 0, 100) / 100,
  }
}
