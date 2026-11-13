import type { Machine, Plan } from '../machine'
import type { Config } from '../settings'
import type { PluginContext } from '../types'
import { sameVideo } from '../machine'
import { pityDue } from '../pick'
import { TIER_INFO } from '../rarity'
import { stars } from './art'
import { setTier, thumb } from './card'
import { h } from './dom'

/**
 * The small panel: a Pull button, the pity count, the last pull and the
 * modifier that is on. No big animation here: it pulls and plays at once.
 */
export function mountPanel(ctx: PluginContext, machine: Machine, cfg: () => Config, pullNow: () => Promise<Plan | null>) {
  return (el: HTMLElement) => {
    const root = h('div', { class: 'phg phg-panel' })
    el.append(root)
    let busy = false
    let reveal = false

    const pullBtn = h('button', {
      type: 'button',
      class: 'phg-pull',
      onclick: async () => {
        if (busy)
          return
        busy = true
        pullBtn.disabled = true
        pullBtn.classList.add('phg-busy')
        try {
          reveal = !!await pullNow()
          render()
        }
        finally {
          busy = false
          pullBtn.disabled = false
          pullBtn.classList.remove('phg-busy')
        }
      },
    }, 'Pull')
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })
    root.append(pullBtn, body)

    function render() {
      const s = machine.state()
      const c = cfg()
      const due = pityDue(s.pity, c.pityAt)
      pullBtn.toggleAttribute('data-due', due)
      const kids: HTMLElement[] = [
        h('p', { class: 'phg-faint', text: due ? 'Next pull: Epic or better, guaranteed.' : `Epic or better guaranteed in ${c.pityAt - s.pity} ${c.pityAt - s.pity === 1 ? 'pull' : 'pulls'}.` }),
      ]
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
      kids.push(h('button', { type: 'button', class: 'phg-link', style: { alignSelf: 'flex-start' }, onclick: () => ctx.ui.openPage() }, 'Open the machine and the collection'))
      body.replaceChildren(...kids)
    }

    const countdown = setInterval(() => {
      if (machine.active()?.breakUntil != null)
        render()
    }, 500)
    const off = machine.subscribe(() => {
      if (!busy)
        render()
    })
    const offSettings = ctx.settings.onChange(render)
    render()

    return () => {
      clearInterval(countdown)
      off()
      offSettings()
      root.remove()
    }
  }
}
