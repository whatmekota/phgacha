import type { Machine, Plan } from '../machine'
import type { Config } from '../settings'
import type { Fanfare } from '../index'
import type { PluginContext } from '../types'
import { sameVideo } from '../machine'
import { atLeast, TIER_INFO } from '../rarity'
import { holdFor } from '../reveal'
import { stars } from './art'
import { setTier, thumb } from './card'
import { h, reducedMotion } from './dom'
import { celebrate } from './fx'
import { machineView, pityMeter } from './machineView'
import { tenGrid, upNext } from './ten'
import { timeline } from './timeline'

/** The panel's timeline is shorter than the page's. */
const PANEL_HISTORY = 5

/**
 * The panel: a small machine with the Pull and ×10 buttons and the pity
 * meter, the last pull (or a ×10's grid), the modifier that is on, what's up
 * next from a ×10, and the last few pulls. A pull here plays at once and
 * stays where you are; the machine animates meanwhile.
 */
export function mountPanel(ctx: PluginContext, machine: Machine, cfg: () => Config, fanfare: Fanfare, pullNow: () => Promise<Plan | null>) {
  return (el: HTMLElement) => {
    const root = h('div', { class: 'phg phg-panel' })
    // The drawer's own, smaller moment for an Epic or a Legendary goes over this.
    const host = h('div', { class: 'phg phg-host phg-panel-host' }, root)
    el.append(host)
    let fx: ReturnType<typeof celebrate> | null = null
    let alive = true
    let busy = false
    let reveal = false
    /** A ×10's grid while it opens. */
    let opening: ReturnType<typeof tenGrid> | null = null

    const view = machineView({ compact: true })
    const pity = pityMeter()

    function setBusy(on: boolean) {
      busy = on
      pullBtn.disabled = on
      tenBtn.disabled = on
    }

    /** An Epic's or a Legendary's moment over the drawer (with the animation on). */
    async function moment(p: Pick<Plan, 'tier'>) {
      if (!cfg().animation || !alive || !atLeast(p.tier, 'epic'))
        return
      fx = celebrate(host, root, p.tier, { compact: true, motion: !reducedMotion(), holdMs: holdFor(p.tier, true) })
      await fx.done
      fx = null
    }

    async function pull() {
      if (busy)
        return
      setBusy(true)
      const release = fanfare.hold()
      try {
        // The video starts now; the capsule opens while it loads.
        const p = await pullNow()
        if (p) {
          const c = cfg()
          if (view.wanted(c))
            await view.animate(p.tier, { onUpgrade: to => fanfare.upgraded(to), onOpen: () => fanfare.sound.stinger(p.tier) })
          else
            fanfare.sound.stinger(p.tier)
          await moment(p)
          fanfare.revealed(p)
        }
        reveal = !!p
      }
      finally {
        setBusy(false)
        release()
        if (alive)
          render()
      }
    }

    async function pullTen() {
      if (busy)
        return
      setBusy(true)
      const release = fanfare.hold()
      try {
        const plans = await machine.planTen()
        if (!plans)
          return
        // The first starts now, as a pull here does; the grid opens meanwhile.
        machine.startQueue(plans)
        const c = cfg()
        const g = opening = tenGrid(machine, plans, { compact: true })
        const best = g.order[g.order.length - 1]
        body.replaceChildren(g.el)
        if (view.wanted(c)) {
          await view.crank(800)
          await g.reveal(fanfare.sound)
        }
        else {
          g.showAll()
          fanfare.sound.stinger(best.tier)
        }
        opening = null
        await moment(best)
        const first = plans.find(p => p.firstLegendary)
        if (first)
          fanfare.revealed(first)
      }
      finally {
        opening = null
        setBusy(false)
        release()
        if (alive)
          render()
      }
    }

    const pullBtn = h('button', { type: 'button', class: 'phg-pull', onclick: () => void pull() }, 'Pull')
    const tenBtn = h('button', { type: 'button', class: 'phg-pull phg-pull-ten', title: 'Ten pulls at once, played one after another', onclick: () => void pullTen() }, '×10')
    const streak = h('p', { class: 'phg-streak', style: { textAlign: 'left' } })
    root.append(h('div', { class: 'phg-panel-top' }, view.el, h('div', { class: 'phg-panel-side' }, h('div', { class: 'phg-pulls' }, pullBtn, tenBtn), pity.el, streak)))
    const body = h('div', { class: 'phg-panel-body' })
    root.append(body)

    function render() {
      const s = machine.state()
      pullBtn.toggleAttribute('data-due', pity.render(s, cfg()))
      streak.textContent = s.legendaries ? (s.sinceLegendary ? `Last Legendary ${s.sinceLegendary} ${s.sinceLegendary === 1 ? 'pull' : 'pulls'} ago` : 'Legendary on the last pull!') : ''
      const kids: HTMLElement[] = []
      const last = s.last
      const ten = machine.ten()
      if (ten) {
        const g = tenGrid(machine, ten.plans, { compact: true })
        g.showAll()
        kids.push(g.el)
      }
      else if (last) {
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
      const ids = ten ? ten.plans.map(p => p.video.id) : last ? [last.id] : []
      if (a && ids.some(id => sameVideo(id, a.video))) {
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
      const next = upNext(machine, { compact: true })
      if (next)
        kids.push(next)
      // The last pull is the card above; the strip shows the ones before it too.
      const recent = s.history.slice(0, PANEL_HISTORY)
      if (recent.length > 1 && !ten) {
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
      opening?.skip()
      fx?.skip()
      clearInterval(countdown)
      off()
      offSettings()
      host.remove()
    }
  }
}
