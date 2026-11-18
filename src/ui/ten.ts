import type { Machine, Plan } from '../machine'
import type { Tier } from '../rarity'
import type { Sound } from './sound'
import { modifierDef } from '../modifiers'
import { revealOrder } from '../pick'
import { atLeast, TIER_INFO, TIERS } from '../rarity'
import { capsule, stars } from './art'
import { setTier, thumb } from './card'
import { h, svg } from './dom'
import { skippable } from './machineView'
import { TAG } from './timeline'

/** How long each capsule waits before it opens: Commons go quick, a Legendary takes its time (and glows meanwhile). */
const OPEN_MS: Record<Tier, number> = { common: 170, rare: 260, epic: 700, legendary: 1150 }
/** A capsule that hasn't opened yet: no colour, no tell. */
const CLOSED = '#cbd5e1'

const pulls = (n: number) => `${n} ${n === 1 ? 'video' : 'videos'}`

/**
 * A ×10 as a grid of ten capsules, rarest last. reveal() opens them one by
 * one, a Common quickly, an Epic or a Legendary only after it has glowed its
 * colour for a moment; a click opens the rest at once. showAll() opens them
 * all without a sound, for when there's no animation.
 */
export function tenGrid(machine: Machine, plans: Plan[], opts: { compact?: boolean } = {}) {
  const order = revealOrder(plans)
  const grid = h('div', { 'class': `phg-ten${opts.compact ? ' phg-ten-compact' : ''}`, 'role': 'list', 'aria-label': 'Your ×10, rarest last' })
  const cells = order.map((p) => {
    const mod = p.modifier ? modifierDef(p.modifier).name : null
    const cell = h('div', { 'class': 'phg-ten-cell', 'role': 'listitem', 'aria-label': `${p.video.title}, ${TIER_INFO[p.tier].name}${mod ? `, ${mod}` : ''}` })
    setTier(cell, p.tier)
    const t = thumb(machine, p.video.id, p.tier)
    if (p.modifier)
      t.append(h('span', { class: 'phg-tl-tag', text: TAG[p.modifier] }))
    if (p.isNew && !opts.compact)
      t.append(h('span', { 'class': 'phg-chip phg-ten-new', 'data-k': 'new', 'text': 'New' }))
    const card = h('div', { class: 'phg-ten-card', title: `${p.video.title}\n${TIER_INFO[p.tier].name}${mod ? ` · ${mod}` : ''}${p.banner ? ' · on the banner' : ''}` }, t)
    if (!opts.compact) {
      card.append(h('div', { class: 'phg-ten-body' },
        h('span', { class: 'phg-ten-stars', text: stars(p.tier) }),
        h('span', { class: 'phg-ten-title', text: p.video.title }),
      ))
    }
    cell.append(card, h('div', { class: 'phg-ten-cap' }, svg(capsule(CLOSED, opts.compact ? 28 : 44))))
    return cell
  })
  grid.append(...cells)
  let skipper: ReturnType<typeof skippable> | null = null
  grid.addEventListener('click', () => skipper?.skip())

  function showAll() {
    for (const c of cells) {
      delete c.dataset.charge
      c.dataset.open = ''
    }
    delete grid.dataset.live
  }

  return {
    el: grid,
    /** The ten as shown and played: rarest last. */
    order,
    showAll,
    /** Open them one by one, with a sound each; resolves when all are open (at once when skipped). */
    async reveal(sound: Sound) {
      skipper?.skip()
      const s = skipper = skippable()
      grid.dataset.live = ''
      let lastSounded = false
      for (const [i, p] of order.entries()) {
        const cell = cells[i]
        // An Epic or better shows its colour first, and shakes, before it opens.
        if (atLeast(p.tier, 'epic'))
          cell.dataset.charge = ''
        await s.sleep(OPEN_MS[p.tier])
        delete cell.dataset.charge
        cell.dataset.open = ''
        if (s.skipped())
          continue
        if (atLeast(p.tier, 'epic'))
          sound.stinger(p.tier)
        else if (p.tier === 'rare')
          sound.upgrade()
        else
          sound.stinger('common')
        lastSounded = i === order.length - 1
      }
      // Skipped: the best one's sound, once, for the lot.
      if (!lastSounded && order.length)
        sound.stinger(order[order.length - 1].tier)
      showAll()
      if (skipper === s)
        skipper = null
    },
    skip: () => skipper?.skip(),
  }
}

/** "1 Legendary · 2 Epic · 7 Rare": a ×10's tiers as chips, rarest first. */
export function tenTally(plans: Plan[]): HTMLElement {
  const n = { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<Tier, number>
  for (const p of plans)
    n[p.tier]++
  return h('div', { class: 'phg-tally phg-ten-tally' }, ...[...TIERS].reverse().filter(t => n[t]).map((t) => {
    const c = h('span', { text: `${n[t]} ${TIER_INFO[t].name}` })
    c.style.setProperty('--phg-tier', TIER_INFO[t].colour)
    return c
  }))
}

/**
 * "Up next from your ×10": the videos still to come, in order, edged in their
 * rarity's colour. A click plays that one now (the rest follow it); Clear
 * ends the ×10. Null when nothing is queued.
 */
export function upNext(machine: Machine, opts: { compact?: boolean } = {}): HTMLElement | null {
  const next = machine.queue().next
  if (!next.length)
    return null
  const strip = h('div', { class: 'phg-timeline', role: 'list' })
  for (const [i, p] of next.entries()) {
    const mod = p.modifier ? modifierDef(p.modifier).name : 'no modifier'
    const btn = h('button', {
      'type': 'button',
      'class': 'phg-tl-item',
      'role': 'listitem',
      'title': `${p.video.title}\n${TIER_INFO[p.tier].name} · ${mod}\nClick to play it now; the rest follow it`,
      'aria-label': `${p.video.title}, ${TIER_INFO[p.tier].name}, ${mod}. Play it now`,
      'onclick': () => machine.skipTo(i),
    })
    setTier(btn, p.tier)
    const t = thumb(machine, p.video.id, p.tier)
    if (p.modifier)
      t.append(h('span', { class: 'phg-tl-tag', text: TAG[p.modifier] }))
    btn.append(t)
    strip.append(btn)
  }
  const clear = h('button', { type: 'button', class: 'phg-link', onclick: () => machine.endQueue() }, 'Clear')
  const head = opts.compact
    ? h('div', { class: 'phg-sub phg-upnext-head' }, h('span', { text: `Up next from your ×10 · ${next.length}` }), clear)
    : h('div', { class: 'phg-coll-head' }, h('h2', { text: 'Up next from your ×10' }), h('span', { class: 'phg-muted', text: `${pulls(next.length)} to go, each when the one before ends. Click one to play it now.` }), h('div', { class: 'phg-upnext-clear' }, clear))
  return h('div', { class: 'phg-upnext' }, head, strip)
}
