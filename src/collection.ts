import type { ModifierId } from './modifiers'
import type { Tier } from './rarity'
import { MODIFIER_IDS } from './modifiers'
import { rank, TIERS } from './rarity'

/** One video in the collection. */
export interface Entry {
  /** Its title when last pulled, for when it has left the library since. */
  title: string
  /** The rarest it has been pulled at (a video's tier changes as it's played). */
  best: Tier
  count: number
  first: number
  last: number
}

export interface LastPull {
  id: string
  title: string
  tier: Tier
  modifier: ModifierId | null
  guaranteed: boolean
  /** The first time this video was pulled. */
  isNew: boolean
  at: number
}

/** One pull in the timeline. */
export interface HistoryItem {
  id: string
  title: string
  tier: Tier
  modifier: ModifierId | null
  at: number
}

/** Everything the machine keeps, in ctx.storage under one key. */
export interface MachineState {
  pulls: number
  /** Pulls in a row without an Epic or better. */
  pity: number
  last: LastPull | null
  collection: Record<string, Entry>
  /** The last pulls, newest first, at most HISTORY_MAX. */
  history: HistoryItem[]
  /** Legendary pulls so far. */
  legendaries: number
  /** Pulls since the last Legendary (all of them if there was none). */
  sinceLegendary: number
}

export const STORAGE_KEY = 'machine'
/** How many pulls the timeline keeps. */
export const HISTORY_MAX = 10

export const emptyState = (): MachineState => ({ pulls: 0, pity: 0, last: null, collection: {}, history: [], legendaries: 0, sinceLegendary: 0 })

/** The timeline after a pull: it goes in front, the oldest falls off the end. */
export const pushHistory = (h: HistoryItem[], item: HistoryItem, max = HISTORY_MAX): HistoryItem[] => [item, ...h].slice(0, max)

const isTier = (v: unknown): v is Tier => TIERS.includes(v as Tier)
const isModifier = (v: unknown): v is ModifierId => MODIFIER_IDS.includes(v as ModifierId)
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

/** What was stored, checked: anything that doesn't fit is dropped rather than trusted. */
export function readState(raw: unknown): MachineState {
  const s = emptyState()
  if (!raw || typeof raw !== 'object')
    return s
  const r = raw as Record<string, unknown>
  s.pulls = count(r.pulls)
  s.pity = count(r.pity)
  const last = r.last as Record<string, unknown> | null
  if (last && typeof last.id === 'string' && isTier(last.tier)) {
    s.last = {
      id: last.id,
      title: typeof last.title === 'string' ? last.title : last.id,
      tier: last.tier,
      modifier: isModifier(last.modifier) ? last.modifier : null,
      guaranteed: last.guaranteed === true,
      isNew: last.isNew === true,
      at: count(last.at),
    }
  }
  if (r.collection && typeof r.collection === 'object') {
    for (const [id, e] of Object.entries(r.collection as Record<string, Record<string, unknown>>)) {
      if (!e || !isTier(e.best))
        continue
      s.collection[id] = { title: typeof e.title === 'string' ? e.title : id, best: e.best, count: Math.max(1, count(e.count)), first: count(e.first), last: count(e.last) }
    }
  }
  // Saved before the timeline existed (0.1.0): it starts empty.
  if (Array.isArray(r.history)) {
    for (const it of r.history as Record<string, unknown>[]) {
      if (it && typeof it.id === 'string' && isTier(it.tier) && s.history.length < HISTORY_MAX)
        s.history.push({ id: it.id, title: typeof it.title === 'string' ? it.title : it.id, tier: it.tier, modifier: isModifier(it.modifier) ? it.modifier : null, at: count(it.at) })
    }
  }
  // Saved before 0.3.0 counted them: what the collection and the timeline say.
  const seen = Object.values(s.collection).filter(e => e.best === 'legendary').length
  s.legendaries = typeof r.legendaries === 'number' ? count(r.legendaries) : seen
  const inHistory = s.history.findIndex(it => it.tier === 'legendary')
  s.sinceLegendary = typeof r.sinceLegendary === 'number'
    ? count(r.sinceLegendary)
    : inHistory >= 0 ? inHistory : seen ? s.history.length : s.pulls
  return s
}

/** The state after a pull (a new object; the old one is left as it was). */
export function record(s: MachineState, pull: Omit<LastPull, 'isNew'>, pityAfter: number): MachineState {
  const had = s.collection[pull.id]
  const entry: Entry = had
    ? { title: pull.title, best: rank(pull.tier) > rank(had.best) ? pull.tier : had.best, count: had.count + 1, first: had.first, last: pull.at }
    : { title: pull.title, best: pull.tier, count: 1, first: pull.at, last: pull.at }
  return {
    pulls: s.pulls + 1,
    pity: pityAfter,
    last: { ...pull, isNew: !had },
    collection: { ...s.collection, [pull.id]: entry },
    history: pushHistory(s.history, { id: pull.id, title: pull.title, tier: pull.tier, modifier: pull.modifier, at: pull.at }),
    legendaries: s.legendaries + (pull.tier === 'legendary' ? 1 : 0),
    sinceLegendary: pull.tier === 'legendary' ? 0 : s.sinceLegendary + 1,
  }
}

/** The collection for the grid: rarest first, then the most recently pulled. */
export function sorted(c: Record<string, Entry>): [string, Entry][] {
  return Object.entries(c).sort(([, a], [, b]) => rank(b.best) - rank(a.best) || b.last - a.last)
}

/** How many of each tier the collection holds, by best tier. */
export function tally(c: Record<string, Entry>): Record<Tier, number> {
  const out = { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<Tier, number>
  for (const e of Object.values(c))
    out[e.best]++
  return out
}

/** "just now", "2 min ago", "3 h ago", "yesterday", "5 days ago": for the timeline's tooltips. */
export function ago(at: number, now: number): string {
  const s = Math.max(0, (now - at) / 1000)
  if (s < 45)
    return 'just now'
  const min = Math.round(s / 60)
  if (min < 60)
    return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24)
    return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
