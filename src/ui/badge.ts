import type { Machine } from '../machine'
import type { Config } from '../settings'
import { TIER_INFO } from '../rarity'
import { setTier } from './card'
import { h } from './dom'

/** How long the badge stays after a modifier starts. */
const SHOW_MS = 5000

/**
 * A small label at the top of the video: which modifier is on, for a few
 * seconds after it starts, and the countdown during a break. Click-through,
 * and out of the way of the player's bars.
 */
export function mountBadge(machine: Machine, cfg: () => Config) {
  return (el: HTMLElement) => {
    const badge = h('div', { class: 'phg phg-badge', role: 'status' })
    el.append(badge)
    let shownFor: number | null = null
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    function render() {
      const a = machine.active()
      if (!a || !cfg().badge) {
        badge.classList.remove('phg-on')
        return
      }
      setTier(badge, a.tier)
      const name = machine.modifierName(a.id)
      if (a.breakUntil !== null) {
        const left = Math.max(0, Math.ceil((a.breakUntil - Date.now()) / 1000))
        badge.replaceChildren(h('i'), h('span', { text: 'Break ' }), h('b', { text: `${left}` }))
        badge.classList.add('phg-on')
        return
      }
      badge.replaceChildren(h('i'), h('span', { text: `${TIER_INFO[a.tier].name} · ${name}` }))
      // Shown once per modifier, for a few seconds.
      const left = SHOW_MS - (Date.now() - a.startedAt)
      if (shownFor !== a.startedAt && left > 0) {
        shownFor = a.startedAt
        badge.classList.add('phg-on')
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
          if (machine.active()?.breakUntil == null)
            badge.classList.remove('phg-on')
        }, left)
      }
      else if (left <= 0) {
        badge.classList.remove('phg-on')
      }
    }

    const tick = setInterval(() => {
      if (machine.active()?.breakUntil != null)
        render()
    }, 250)
    const off = machine.subscribe(render)
    render()
    return () => {
      clearInterval(tick)
      clearTimeout(hideTimer)
      off()
      badge.remove()
    }
  }
}
