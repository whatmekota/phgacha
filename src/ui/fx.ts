import type { Tier } from '../rarity'
import { TIER_INFO } from '../rarity'
import { stars } from './art'
import { h } from './dom'

/** Confetti colours: golds for a Legendary, violets for an Epic. */
const COLOURS: Partial<Record<Tier, string[]>> = {
  legendary: ['#fbbf24', '#fde68a', '#f59e0b', '#fff7d6', '#facc15'],
  epic: ['#c084fc', '#e9d5ff', '#a855f7', '#f0abfc'],
}

/** How much confetti: [page, panel]. */
const PIECES: Partial<Record<Tier, [number, number]>> = { legendary: [80, 28], epic: [26, 10] }

/**
 * The moment after an Epic or a Legendary opens: the page (or the drawer,
 * `compact`) dims, light bursts out in the tier's colour, confetti falls,
 * and the tier's name holds for `holdMs`; a Legendary also shakes `shake`.
 * A click skips it. With `motion` off (reduced motion) only the dim and the
 * title come, without movement. Common and Rare get none of it.
 *
 * `done` resolves as it starts to fade, so the card can reveal under it.
 */
export function celebrate(host: HTMLElement, shake: HTMLElement, tier: Tier, opts: { compact: boolean, motion: boolean, holdMs: number }) {
  const colours = COLOURS[tier]
  if (!colours || opts.holdMs <= 0)
    return { done: Promise.resolve(), skip: () => {} }

  const fx = h('div', { 'class': 'phg-fx', 'data-tier': tier, 'aria-live': 'polite' })
  fx.style.setProperty('--phg-tier', TIER_INFO[tier].colour)
  fx.toggleAttribute('data-compact', opts.compact)
  fx.toggleAttribute('data-still', !opts.motion)
  fx.append(h('div', { class: 'phg-fx-dim' }), h('div', { class: 'phg-fx-rays' }), h('div', { class: 'phg-fx-flash' }))
  if (opts.motion) {
    const confetti = h('div', { class: 'phg-fx-confetti' })
    const n = PIECES[tier]![opts.compact ? 1 : 0]
    for (let i = 0; i < n; i++) {
      const p = h('span')
      const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
      p.style.cssText = `--x:${r(0, 100)}%;--dx:${r(-70, 70)}px;--r:${r(360, 1080) * (Math.random() < 0.5 ? -1 : 1)}deg;--d:${r(0, 0.7)}s;--t:${r(1.6, 3)}s;--s:${r(opts.compact ? 3 : 5, opts.compact ? 6 : 11)}px;background:${colours[i % colours.length]}`
      if (i % 3 === 0)
        p.dataset.round = ''
      confetti.append(p)
    }
    fx.append(confetti)
  }
  fx.append(h('div', { class: 'phg-fx-title' },
    h('div', { class: 'phg-fx-stars', text: stars(tier) }),
    h('div', { class: 'phg-fx-name', text: TIER_INFO[tier].name }),
    h('div', { class: 'phg-fx-hint', text: 'Click to skip' }),
  ))
  host.append(fx)

  if (opts.motion && tier === 'legendary') {
    shake.classList.remove('phg-shake')
    void shake.offsetWidth
    shake.classList.add('phg-shake')
    setTimeout(() => shake.classList.remove('phg-shake'), 600)
  }

  let finish = () => {}
  const done = new Promise<void>((resolve) => {
    let over = false
    const timer = setTimeout(() => finish(), opts.holdMs)
    finish = () => {
      if (over)
        return
      over = true
      clearTimeout(timer)
      fx.classList.add('phg-fx-out')
      setTimeout(() => fx.remove(), 450)
      resolve()
    }
  })
  fx.addEventListener('click', () => finish())
  return { done, skip: () => finish() }
}
