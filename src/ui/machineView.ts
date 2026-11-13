import type { MachineState } from '../collection'
import type { Tier } from '../rarity'
import type { Config } from '../settings'
import { pityDue } from '../pick'
import { TIER_INFO } from '../rarity'
import { capsule, machine as machineArt } from './art'
import { h, reducedMotion, svg } from './dom'

/** Sleeps that a click can cut short: skipping the animation runs the rest at once. */
function skippable() {
  let skipped = false
  const waiting = new Set<() => void>()
  return {
    sleep(ms: number): Promise<void> {
      if (skipped)
        return Promise.resolve()
      return new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer)
          waiting.delete(done)
          resolve()
        }
        const timer = setTimeout(done, ms)
        waiting.add(done)
      })
    },
    skip() {
      skipped = true
      for (const done of [...waiting])
        done()
    },
  }
}

/**
 * The gacha machine with its pull animation, for the page and (compact) the
 * panel: the crank turns, a capsule in the tier's colour drops, wobbles
 * longer the rarer it is, and bursts open. A click on it skips to the end.
 */
export function machineView(opts: { compact?: boolean } = {}) {
  const stage = h('div', { class: `phg-stage${opts.compact ? ' phg-compact' : ''}` })
  stage.append(svg(machineArt()))
  const drop = h('div', { class: 'phg-drop' })
  const burst = h('div', { class: 'phg-burst' })
  stage.append(burst, drop, h('div', { class: 'phg-skip', text: 'Click to skip' }))
  let skipper: ReturnType<typeof skippable> | null = null
  stage.addEventListener('click', () => skipper?.skip())

  return {
    el: stage,
    /** Whether a pull should animate: the setting, and the system's reduced motion. */
    wanted: (cfg: Config) => cfg.animation && !reducedMotion(),
    /** Run the pull animation for a capsule of `tier`; resolves at the reveal (at once when skipped). */
    async animate(tier: Tier) {
      skipper?.skip()
      stage.style.setProperty('--phg-tier', TIER_INFO[tier].colour)
      stage.dataset.tier = tier
      drop.replaceChildren(svg(capsule(TIER_INFO[tier].colour, 56)))
      const s = skipper = skippable()
      stage.dataset.phase = 'crank'
      await s.sleep(650)
      stage.dataset.phase = 'drop'
      await s.sleep(520)
      stage.dataset.phase = 'wobble'
      // The rarer, the longer the suspense.
      await s.sleep(tier === 'legendary' ? 1100 : tier === 'epic' ? 750 : 450)
      stage.dataset.phase = 'open'
      await s.sleep(320)
      stage.dataset.phase = 'done'
      if (skipper === s)
        skipper = null
    },
    skip: () => skipper?.skip(),
  }
}

/** The pity meter: "Epic or better in N pulls", and a bar filling up to it. */
export function pityMeter() {
  const line = h('div', { class: 'phg-pity-line' })
  const fill = h('span')
  const el = h('div', { class: 'phg-pity' }, line, h('div', { class: 'phg-pity-bar' }, fill))
  return {
    el,
    /** Shows the count; returns whether the pity is due (the next pull guaranteed). */
    render(s: MachineState, cfg: Config): boolean {
      const due = pityDue(s.pity, cfg.pityAt)
      const left = cfg.pityAt - s.pity
      el.toggleAttribute('data-due', due)
      line.replaceChildren(
        h('span', { text: due ? 'Next pull' : 'Epic or better in' }),
        h('b', { text: due ? 'Epic or better, guaranteed' : `${left} ${left === 1 ? 'pull' : 'pulls'}` }),
      )
      fill.style.width = `${Math.min(100, (s.pity / cfg.pityAt) * 100)}%`
      return due
    },
  }
}
