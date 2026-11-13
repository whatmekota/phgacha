import type { MachineState } from '../collection'
import type { Tier } from '../rarity'
import type { Config } from '../settings'
import { pityDue } from '../pick'
import { atLeast, TIER_INFO } from '../rarity'
import { isUpgrade, revealPlan } from '../reveal'
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
    skipped: () => skipped,
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
    /**
     * Run the pull animation for a capsule of `tier` (see revealPlan): the
     * glow hints the tier, may step up on the way, and the wobble builds.
     * Resolves once it's open (at once when skipped). `onUpgrade` and
     * `onOpen` are for the sounds.
     */
    async animate(tier: Tier, hooks: { onUpgrade?: () => void, onOpen?: () => void } = {}) {
      skipper?.skip()
      const plan = revealPlan(tier, Math.random, { compact: opts.compact })
      const s = skipper = skippable()
      const glow = (t: Tier) => {
        stage.style.setProperty('--phg-tier', TIER_INFO[t].colour)
        stage.dataset.tier = t
        drop.replaceChildren(svg(capsule(TIER_INFO[t].colour, 56)))
      }
      glow(plan.steps[0])
      delete stage.dataset.step
      stage.dataset.phase = 'crank'
      stage.style.setProperty('--phg-crank', `${plan.crankMs}ms`)
      await s.sleep(plan.crankMs)
      stage.dataset.phase = 'drop'
      stage.style.setProperty('--phg-drop', `${plan.dropMs}ms`)
      await s.sleep(plan.dropMs)
      stage.dataset.phase = 'wobble'
      for (const [i, t] of plan.steps.entries()) {
        if (i > 0 && isUpgrade(plan.steps[i - 1], t)) {
          glow(t)
          // Restart the flash: it plays once per step up.
          drop.classList.remove('phg-up')
          void drop.offsetWidth
          drop.classList.add('phg-up')
          if (!s.skipped())
            hooks.onUpgrade?.()
        }
        // The wobble builds: harder with each step, and from the start for an Epic or better.
        stage.dataset.step = String(Math.min(2, i + (atLeast(tier, 'epic') ? 1 : 0)))
        await s.sleep(plan.wobbleMs[i])
      }
      glow(tier)
      drop.classList.remove('phg-up')
      stage.dataset.phase = 'open'
      hooks.onOpen?.()
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
