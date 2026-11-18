import type { HistoryItem } from '../collection'
import type { Machine } from '../machine'
import type { ModifierId } from '../modifiers'
import { ago } from '../collection'
import { modifierDef } from '../modifiers'
import { TIER_INFO } from '../rarity'
import { setTier, thumb } from './card'
import { h } from './dom'

/** Short names for the tiny tag on a timeline item. */
export const TAG: Record<ModifierId, string> = {
  invert: 'Upside',
  half: 'Half',
  top: 'Top',
  slow: '×0.75',
  fast: '×1.25',
  turbo: '×1.5',
  finale: 'Finale',
  breaks: 'Breaks',
  mirror: 'Mirror',
  noir: 'Noir',
  dreamy: 'Dreamy',
  tilt: 'Tilt',
  pulse: 'Pulse',
}

/**
 * The last pulls as a strip, newest first: a thumbnail edged in the tier's
 * colour, the modifier as a tag, and when it was in the tooltip. A click
 * plays that video again, without a modifier.
 */
export function timeline(machine: Machine, items: HistoryItem[], play: (id: string) => void): HTMLElement {
  const now = Date.now()
  const strip = h('div', { class: 'phg-timeline', role: 'list' })
  for (const it of items) {
    const mod = it.modifier ? modifierDef(it.modifier).name : 'no modifier'
    const btn = h('button', {
      'type': 'button',
      'class': 'phg-tl-item',
      'role': 'listitem',
      'title': `${it.title}\n${TIER_INFO[it.tier].name} · ${mod} · ${ago(it.at, now)}\nClick to play it again, without a modifier`,
      'aria-label': `${it.title}, ${TIER_INFO[it.tier].name}, ${mod}, ${ago(it.at, now)}`,
      'onclick': () => play(it.id),
    })
    setTier(btn, it.tier)
    const t = thumb(machine, it.id, it.tier)
    if (it.modifier)
      t.append(h('span', { class: 'phg-tl-tag', text: TAG[it.modifier] ?? it.modifier }))
    btn.append(t)
    strip.append(btn)
  }
  return strip
}
