import type { Plan } from './machine'
import type { PluginContext } from './types'
import type { Sound } from './ui/sound'
import { createMachine } from './machine'
import { modifierDef } from './modifiers'
import { TIER_INFO } from './rarity'
import { FIELDS, readConfig } from './settings'
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
 * finale, or breaks every few strokes. Modifiers end with the video, or on
 * panic, and leave nothing behind. Every pull goes into a collection.
 *
 * Written for plugin API 3 (playhound 2.2).
 */

/** Pull's shortcut: the first of these that is free. */
const PULL_KEYS = ['Shift+P', 'Alt+P', 'Alt+Shift+P']
/** A capsule, in currentColor. */
const ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4"/><path d="M1.8 8a6.2 6.2 0 0 1 12.4 0" fill="currentColor" fill-opacity=".35"/></svg>'
const END_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>'

/** The reveal's shared parts, for the page and the panel. */
export interface Fanfare {
  sound: Sound
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
  /** What every reveal shares: its sound, and a toast for the first Legendary ever. */
  const fanfare: Fanfare = {
    sound,
    revealed(p: Plan) {
      if (p.firstLegendary)
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
    id: 'end',
    title: 'End the gacha modifier',
    hint: 'Puts the stroke and the speed back as they were',
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
  }
}
