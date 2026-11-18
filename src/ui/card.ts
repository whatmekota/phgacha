import type { Machine } from '../machine'
import type { ModifierId } from '../modifiers'
import type { Tier } from '../rarity'
import { modifierDef } from '../modifiers'
import { TIER_INFO } from '../rarity'
import { capsule, stars } from './art'
import { h, svg } from './dom'

/** What a result card shows: a pull just made, or the last one saved. */
export interface CardData {
  id: string
  title: string
  tier: Tier
  modifier: ModifierId | null
  guaranteed: boolean
  isNew: boolean
  /** Why it's that rare; only known for a pull made this session. */
  reasons?: string[]
  /** It has the day's banner tag; only known for a pull made this session. */
  banner?: boolean
}

/** Sets the tier colour variable (Object.assign on style can't set custom properties). */
export function setTier(el: HTMLElement, tier: Tier) {
  el.style.setProperty('--phg-tier', TIER_INFO[tier].colour)
  el.dataset.tier = tier
}

/**
 * A thumbnail box: a capsule placeholder, then the library's picture once
 * it's in. With `lazy`, it waits until the box scrolls into view.
 */
export function thumb(machine: Machine, id: string, tier: Tier, lazy?: IntersectionObserver): HTMLElement {
  const box = h('div', { class: 'phg-thumb' })
  const ph = h('div', { class: 'phg-thumb-ph' })
  ph.append(svg(capsule(TIER_INFO[tier].colour, 40)))
  const img = h('img', { alt: '', decoding: 'async', draggable: 'false' })
  img.addEventListener('load', () => {
    img.dataset.ok = ''
    ph.remove()
  })
  box.append(ph, img)
  const load = () => {
    void machine.thumbnail(id).then((src) => {
      if (src)
        img.src = src
    })
  }
  if (lazy) {
    (box as HTMLElement & { phgLoad?: () => void }).phgLoad = load
    lazy.observe(box)
  }
  else {
    load()
  }
  return box
}

/** An IntersectionObserver that loads thumbs (see thumb) as they come into view. */
export function lazyThumbs(root: Element | null): IntersectionObserver {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting)
        continue
      io.unobserve(e.target);
      (e.target as HTMLElement & { phgLoad?: () => void }).phgLoad?.()
    }
  }, { root, rootMargin: '200px' })
  return io
}

/** The modifier line: what it is and what it does, or "No modifier". */
export function modLine(id: ModifierId | null): HTMLElement {
  if (!id) {
    return h('div', { 'class': 'phg-mod', 'data-none': true }, h('div', { class: 'phg-mod-text' }, h('b', { text: 'No modifier' }), h('span', { text: 'Plays as it is.' })))
  }
  const m = modifierDef(id)
  return h('div', { class: 'phg-mod' }, h('div', { class: 'phg-mod-text' }, h('b', { text: m.name }), h('span', { text: `${m.hint}. Until the video ends.` })))
}

/** The big card for a pull. */
export function resultCard(machine: Machine, d: CardData, reveal: boolean): HTMLElement {
  const card = h('div', { class: `phg-card${reveal ? ' phg-reveal' : ''}` })
  setTier(card, d.tier)
  const t = thumb(machine, d.id, d.tier)
  const ribbon = h('div', { class: 'phg-ribbon' },
    d.isNew && h('span', { 'class': 'phg-chip', 'data-k': 'new', 'text': 'New' }),
    d.guaranteed && h('span', { 'class': 'phg-chip', 'data-k': 'pity', 'text': 'Pity' }),
    d.banner && h('span', { 'class': 'phg-chip', 'data-k': 'banner', 'text': 'Banner' }),
  )
  t.append(ribbon)
  const info = TIER_INFO[d.tier]
  card.append(t, h('div', { class: 'phg-card-body' },
    h('div', { class: 'phg-tier' }, h('span', { class: 'phg-stars', text: stars(d.tier) }), h('span', { text: info.name })),
    h('p', { class: 'phg-title', text: d.title }),
    d.reasons?.length ? h('p', { class: 'phg-why', text: d.reasons.join(' · ') }) : null,
    modLine(d.modifier),
  ))
  return card
}
