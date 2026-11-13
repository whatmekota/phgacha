import type { Machine, Plan } from '../machine'
import type { Config } from '../settings'
import type { PluginContext } from '../types'
import { sameVideo } from '../machine'
import { TIER_INFO } from '../rarity'
import { stars } from './art'
import { setTier, thumb } from './card'
import { h } from './dom'
import { machineView, pityMeter } from './machineView'
import { timeline } from './timeline'

/** The panel's timeline is shorter than the page's. */
const PANEL_HISTORY = 5

/**
 * The panel: a small machine with the Pull button and the pity meter, the
 * last pull, the modifier that is on, and the last few pulls. A pull here
 * plays at once and stays where you are; the machine animates meanwhile.
 */
export function mountPanel(ctx: PluginContext, machine: Machine, cfg: () => Config, pullNow: () => Promise<Plan | null>) {
  return (el: HTMLElement) => {
    const root = h('div', { class: 'phg phg-panel' })
    el.append(root)
    let alive = true
    let busy = false
    let reveal = false

    const view = machineView({ compact: true })
    const pity = pityMeter()
    const pullBtn = h('button', {
      type: 'button',
      class: 'phg-pull',
      onclick: async () => {
        if (busy)
          return
        busy = true
        pullBtn.disabled = true
        try {
          // The video starts now; the capsule opens while it loads.
          const p = await pullNow()
          if (p && view.wanted(cfg()))
            await view.animate(p.tier)
          reveal = !!p
        }
        finally {
          busy = false
          pullBtn.disabled = false
          if (alive)
            render()
        }
      },
    }, 'Pull')
    root.append(h('div', { class: 'phg-panel-top' }, view.el, h('div', { class: 'phg-panel-side' }, pullBtn, pity.el)))
    const body = h('div', { class: 'phg-panel-body' })
    root.append(body)

    function render() {
      const s = machine.state()
      pullBtn.toggleAttribute('data-due', pity.render(s, cfg()))
      const kids: HTMLElement[] = []
      const last = s.last
      if (last) {
        const mini = h('div', { class: `phg-mini${reveal ? ' phg-reveal' : ''}` })
        setTier(mini, last.tier)
        mini.append(thumb(machine, last.id, last.tier), h('div', { class: 'phg-mini-text' },
          h('span', { class: 'phg-tier' }, `${stars(last.tier)} ${TIER_INFO[last.tier].name}${last.isNew ? ' · new' : ''}`),
          h('span', { class: 'phg-mini-title', title: last.title, text: last.title }),
          h('span', { class: 'phg-mini-mod', text: last.modifier ? machine.modifierName(last.modifier) : 'No modifier' }),
        ))
        kids.push(mini)
      }
      reveal = false
      const a = machine.active()
      if (a && last && sameVideo(last.id, a.video)) {
        const live = h('div', { class: 'phg-live' })
        setTier(live, a.tier)
        const left = a.breakUntil !== null ? Math.max(0, Math.ceil((a.breakUntil - Date.now()) / 1000)) : null
        live.append(
          h('span', { class: 'phg-live-dot' }),
          h('span', { style: { flex: '1' }, text: left !== null ? `Break: ${left} s` : `${machine.modifierName(a.id)} is on` }),
          h('button', { type: 'button', class: 'phg-btn', onclick: () => machine.endModifier() }, 'End it'),
        )
        kids.push(live)
      }
      // The last pull is the card above; the strip shows the ones before it too.
      const recent = s.history.slice(0, PANEL_HISTORY)
      if (recent.length > 1) {
        kids.push(h('div', { class: 'phg-sub', text: 'Last pulls' }))
        kids.push(timeline(machine, recent, id => void machine.replay(id)))
      }
      kids.push(h('button', { type: 'button', class: 'phg-link', style: { alignSelf: 'flex-start' }, onclick: () => ctx.ui.openPage() }, 'Open the machine and the collection'))
      body.replaceChildren(...kids)
    }

    const countdown = setInterval(() => {
      if (!busy && machine.active()?.breakUntil != null)
        render()
    }, 500)
    // While the panel's own capsule is opening, its reveal renders the result.
    const off = machine.subscribe(() => {
      if (!busy)
        render()
    })
    const offSettings = ctx.settings.onChange(() => {
      if (!busy)
        render()
    })
    render()

    return () => {
      alive = false
      view.skip()
      clearInterval(countdown)
      off()
      offSettings()
      root.remove()
    }
  }
}
