import type { Plan } from './machine'
import type { Tier } from './rarity'
import type { PluginContext, PluginStatus } from './types'
import type { Sound } from './ui/sound'
import { createTrophies } from './achievements'
import { createMachine } from './machine'
import { modifierDef } from './modifiers'
import { revealOrder } from './pick'
import { TIER_INFO, TIERS } from './rarity'
import { FIELDS, readConfig } from './settings'
import { statusOf } from './status'
import { CSS } from './style'
import { stars } from './ui/art'
import { mountBadge } from './ui/badge'
import { mountPage } from './ui/page'
import { mountPanel } from './ui/panel'
import { createSound } from './ui/sound'

/**
 * Gacha: a gacha machine for the library. A pull picks the next video by
 * rarity (worked out from its intensity, how long it has been left alone,
 * whether it was ever finished, and stars), plays it, and may roll a
 * modifier on top: inverted or squeezed strokes, another speed, only the
 * finale, breaks every few strokes, or a changed picture. Modifiers end with
 * the video, or on panic, and leave nothing behind. A ×10 pulls ten at once
 * and plays them one after another. Every pull goes into a collection, and
 * the machine has achievements of its own.
 *
 * Written for plugin API 7 (playhound 2.2.8); it still runs, without the
 * status line or the achievements, where those aren't there.
 */

/** Pull's shortcut: the first of these that is free. */
const PULL_KEYS = ['Shift+P', 'Alt+P', 'Alt+Shift+P']
/** A capsule, in currentColor. */
const ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4"/><path d="M1.8 8a6.2 6.2 0 0 1 12.4 0" fill="currentColor" fill-opacity=".35"/></svg>'
const END_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>'
/** Capsules, stacked: the ×10. */
const TEN_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><circle cx="5.2" cy="10.4" r="3.6"/><circle cx="10.8" cy="10.4" r="3.6"/><circle cx="8" cy="5.2" r="3.6"/><path d="M4.4 5.2h7.2" opacity=".6"/></svg>'

/** The reveal's shared parts, for the page and the panel. */
export interface Fanfare {
  sound: Sound
  /**
   * A reveal starts: the achievements and the status line wait until the
   * returned function is called, since they would give the pull away.
   */
  hold: () => () => void
  /** A capsule's glow stepped up to `to`, seen: a sound, and a Legendary that lied low counts. */
  upgraded: (to: Tier) => void
  revealed: (p: Plan) => void
}

export default async function activate(ctx: PluginContext) {
  ctx.ui.style(CSS)
  let values = ctx.settings.all()
  const cfg = () => readConfig(values)
  ctx.settings.onChange((v) => {
    values = v
  })

  const machine = await createMachine(ctx, cfg)
  const sound = createSound(() => ({ on: cfg().sounds, volume: cfg().volume }))

  // ─── Achievements (API 7) and the status line (API 6), where playhound has them ───
  const trophies = createTrophies(ctx.achievements, (...args) => ctx.log(...args))
  const setStatus = (s: PluginStatus | null) => {
    if (typeof ctx.ui.status !== 'function')
      return
    try {
      ctx.ui.status(s)
    }
    catch (err) {
      ctx.log('setting the status failed', err)
    }
  }
  /** Reveals running: until they're over, a new achievement or the pity count would give them away. */
  let held = 0
  const update = () => {
    if (held)
      return
    trophies.sync(machine.state())
    setStatus(statusOf(machine.state(), machine.active(), cfg().pityAt, machine.queue().next.length))
  }
  machine.subscribe(update)
  ctx.settings.onChange(update)
  update()

  /** What every reveal shares: its sound, and the first Legendary ever told (its achievement, or a toast without them). */
  const fanfare: Fanfare = {
    sound,
    hold() {
      held++
      let over = false
      return () => {
        if (over)
          return
        over = true
        held--
        update()
      }
    },
    upgraded(to) {
      sound.upgrade()
      if (to === 'legendary')
        machine.liedLow()
    },
    revealed(p: Plan) {
      if (p.firstLegendary && !trophies.available)
        ctx.ui.toast('Your first Legendary!', { tone: 'success', detail: `${p.video.title}: it's in your collection, in gold.` })
    },
  }

  /** Pull and play at once: the command and the panel. The page animates first instead. */
  async function pullNow(): Promise<Plan | null> {
    const p = await machine.plan()
    if (!p)
      return null
    void machine.launch(p)
    return p
  }

  // register() takes the first free key of the list itself; this is which, for the page's hint.
  const pullKey = PULL_KEYS.find(k => ctx.commands.keyFree(k)) ?? null
  ctx.commands.register({
    id: 'pull',
    title: 'Pull from the gacha',
    hint: 'The next video by rarity, maybe with a modifier',
    icon: ICON,
    kbd: PULL_KEYS,
    async run() {
      const p = await pullNow()
      if (!p)
        return
      sound.stinger(p.tier)
      const m = p.modifier && modifierDef(p.modifier)
      ctx.ui.toast(`${stars(p.tier)} ${TIER_INFO[p.tier].name}${p.isNew ? ' · new' : ''}: ${p.video.title}`, {
        detail: m ? `${m.name}: ${m.hint.toLowerCase()}.` : 'No modifier.',
      })
      fanfare.revealed(p)
    },
  })
  ctx.commands.register({
    id: 'pull-ten',
    title: 'Pull ×10 from the gacha',
    hint: 'Ten pulls at once, played one after another, rarest last',
    icon: TEN_ICON,
    async run() {
      const plans = await machine.planTen()
      if (!plans)
        return
      machine.startQueue(plans)
      const order = revealOrder(plans)
      const best = order[order.length - 1]
      sound.stinger(best.tier)
      const n = Object.fromEntries(TIERS.map(t => [t, plans.filter(p => p.tier === t).length]))
      const counts = [...TIERS].reverse().filter(t => n[t]).map(t => `${n[t]} ${TIER_INFO[t].name}`).join(' · ')
      const m = best.modifier && modifierDef(best.modifier)
      ctx.ui.toast(`×10: ${counts}`, { detail: `Best: ${best.video.title}${m ? `, with ${m.name}` : ''}. They play one after another, rarest last.` })
      const first = plans.find(p => p.firstLegendary)
      if (first)
        fanfare.revealed(first)
    },
  })
  ctx.commands.register({
    id: 'end',
    title: 'End the gacha modifier',
    hint: 'Puts the stroke, the speed and the picture back as they were',
    icon: END_ICON,
    run() {
      if (!machine.active()) {
        ctx.ui.toast('No gacha modifier is on')
        return
      }
      machine.endModifier()
      ctx.ui.toast('Gacha modifier ended')
    },
  })
  ctx.commands.register({ id: 'open', title: 'Open the gacha machine', hint: 'The machine and your collection', icon: ICON, run: () => ctx.ui.openPage() })

  ctx.ui.settings(FIELDS)
  ctx.ui.page({ title: 'Gacha', icon: ICON, mount: mountPage(ctx, machine, cfg, fanfare, () => pullKey) })
  ctx.ui.panel({ title: 'Gacha', icon: ICON, mount: mountPanel(ctx, machine, cfg, fanfare, pullNow) })
  ctx.ui.overlay({ mount: mountBadge(machine, cfg) })

  return () => {
    machine.dispose()
    sound.dispose()
    setStatus(null)
  }
}
