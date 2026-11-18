import type { Machine, Plan } from '../machine'
import type { Config } from '../settings'
import type { Fanfare } from '../index'
import type { PluginContext } from '../types'
import type { CardData } from './card'
import { sorted, tally } from '../collection'
import { sameVideo } from '../machine'
import { ODDS, tierChances, tierCounts } from '../pick'
import { atLeast, reasons, TIER_INFO, TIERS } from '../rarity'
import { holdFor } from '../reveal'
import { capsule, stars } from './art'
import { lazyThumbs, resultCard, setTier, thumb } from './card'
import { h, reducedMotion, svg } from './dom'
import { celebrate } from './fx'
import { machineView, pityMeter } from './machineView'
import { tenGrid, tenTally, upNext } from './ten'
import { timeline } from './timeline'

/** How long the page waits after the reveal before going to the player. */
const TO_PLAYER_MS = 2200
/** The same after a ×10: there are ten cards to look at. */
const TEN_TO_PLAYER_MS = 4000

/**
 * The machine's page: the gacha machine with its Pull and Pull ×10 buttons,
 * the day's banner and the pity meter, the last pull's card (or a ×10's
 * grid), what's up next from a ×10, the last pulls, and the collection.
 */
export function mountPage(ctx: PluginContext, machine: Machine, cfg: () => Config, fanfare: Fanfare, pullKey: () => string | null) {
  return (el: HTMLElement) => {
    const root = h('div', { class: 'phg phg-page' })
    // The host holds the page and, over it, an Epic's or a Legendary's moment.
    const host = h('div', { class: 'phg phg-host' }, root)
    el.append(host)
    let fx: ReturnType<typeof celebrate> | null = null
    let alive = true
    let busy = false
    /** The card for a pull made while the page is up, with its reasons; else the saved last pull. */
    let shown: CardData | null = null
    let goTimer: ReturnType<typeof setTimeout> | undefined
    let goMs = TO_PLAYER_MS
    let poolSize: number | null = null
    let bannerTag: string | null = null
    let card: { key: string, el: HTMLElement } | null = null
    /** A ×10's grid while it opens: skipped when the page goes. */
    let opening: ReturnType<typeof tenGrid> | null = null
    /** The last pull rendered: one made elsewhere (the shortcut, the panel) still gets its reveal here. */
    let lastAt = machine.state().last?.at ?? 0

    // ─── The machine ───
    const view = machineView()
    const pullBtn = h('button', { type: 'button', class: 'phg-pull', onclick: () => void pull() }, 'Pull')
    const tenBtn = h('button', { type: 'button', class: 'phg-pull phg-pull-ten', title: 'Ten pulls at once, played one after another', onclick: () => void pullTen() }, 'Pull ×10')
    const keyHint = h('p', { class: 'phg-faint' })
    const pity = pityMeter()
    const odds = h('div', { class: 'phg-odds', title: 'The chance of each tier in a pull. A tier with only a few videos in the pool gets less, so those few do not come up again and again.' })
    /** The odds, or the pool's own chances once it's known. */
    const showOdds = (chances: Record<string, number> | null) => {
      odds.replaceChildren(...TIERS.map((t) => {
        const pct = chances ? chances[t] * 100 : ODDS[t]
        const s = h('span', { text: `${TIER_INFO[t].name} ${pct > 0 && pct < 1 ? '<1' : Math.round(pct)}%` })
        s.style.setProperty('--phg-tier', TIER_INFO[t].colour)
        return s
      }))
    }
    showOdds(null)
    const streak = h('p', { class: 'phg-streak' })
    const banner = h('p', { class: 'phg-banner', title: 'Half the time, a pull takes a video with this tag from the tier it rolled, when that tier has one. A new tag each day.' })
    const left = h('div', { class: 'phg-left' }, banner, view.el, h('div', { class: 'phg-pulls' }, pullBtn, tenBtn), keyHint, pity.el, streak, odds)

    // ─── The result ───
    const right = h('div', { class: 'phg-right' })

    // ─── The collection ───
    const collHead = h('div', { class: 'phg-coll-head' })
    const grid = h('div', { class: 'phg-grid' })
    let armed = false
    const resetBtn = h('button', {
      type: 'button',
      class: 'phg-link',
      onclick: () => {
        if (!armed) {
          armed = true
          resetBtn.textContent = 'Click again to forget every pull'
          setTimeout(() => {
            armed = false
            resetBtn.textContent = 'Reset the collection'
          }, 4000)
          return
        }
        void machine.reset()
      },
    }, 'Reset the collection')
    const coll = h('div', { class: 'phg-coll' }, collHead, grid, h('div', { class: 'phg-foot' }, resetBtn))

    // ─── Up next from a ×10, and the last pulls ───
    const queued = h('div', { class: 'phg-recent' })
    const recent = h('div', { class: 'phg-recent' })

    root.append(h('div', { class: 'phg-top' }, left, right), queued, recent, coll)
    const io = lazyThumbs(root)

    function renderMachine() {
      const s = machine.state()
      pullBtn.toggleAttribute('data-due', pity.render(s, cfg()))
      const n = s.sinceLegendary
      streak.replaceChildren(...(s.legendaries === 0
        ? [s.pulls ? `No Legendary yet, ${s.pulls} ${s.pulls === 1 ? 'pull' : 'pulls'} in` : '']
        : n === 0
          ? [h('b', { text: 'Legendary' }), ' on the last pull!']
          : ['Last Legendary ', h('b', { text: String(n) }), ` ${n === 1 ? 'pull' : 'pulls'} ago · ${s.legendaries} in all`]))
      const key = pullKey()
      keyHint.replaceChildren(...(key ? ['Or ', h('span', { class: 'phg-kbd', text: key }), ' anywhere in playhound'] : ['Or "Pull from the gacha" in the command palette (Ctrl K)']))
      banner.hidden = !bannerTag
      banner.replaceChildren(...(bannerTag ? ['Today\'s banner: ', h('b', { text: `#${bannerTag}` })] : []))
    }

    function renderResult(reveal = false) {
      const s = machine.state()
      const ten = machine.ten()
      const data: CardData | null = ten ? null : shown?.id === s.last?.id ? shown : s.last
      const kids: (HTMLElement | null)[] = []
      if (ten) {
        // The same ×10 keeps its grid (the one that just opened, if it opened here).
        const key = `ten|${ten.at}`
        if (!card || card.key !== key) {
          const g = tenGrid(machine, ten.plans)
          g.showAll()
          card = { key, el: g.el }
        }
        kids.push(card.el, tenTally(ten.plans))
      }
      else if (!data) {
        const empty = h('div', { class: 'phg-empty' }, h('b', { text: 'Nothing pulled yet' }), h('span', { text: 'Turn the crank: a video from your library, the rarer the better, maybe with a twist.' }))
        empty.prepend(svg(capsule(TIER_INFO.rare.colour, 48)))
        kids.push(empty)
      }
      else {
        // The same pull keeps its card, so a re-render doesn't cut its reveal short.
        const key = `${data.id}|${s.last?.at ?? 0}`
        if (!card || card.key !== key || reveal)
          card = { key, el: resultCard(machine, data, reveal) }
        kids.push(card.el)
      }
      const ids = ten ? ten.plans.map(p => p.video.id) : data ? [data.id] : []
      const a = machine.active()
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
      if (ids.length) {
        const playing = ctx.player.state().title
        const actions = h('div', { class: 'phg-actions' })
        if (playing && ids.some(id => sameVideo(id, playing)))
          actions.append(h('button', { type: 'button', class: 'phg-btn', onclick: () => ctx.ui.showStage('player') }, 'Watch'))
        if (goTimer !== undefined) {
          const bar = h('div', { class: 'phg-going-bar' }, h('span'))
          bar.style.setProperty('--phg-going', `${goMs}ms`)
          actions.append(h('div', { class: 'phg-going', style: { flex: '1' } }, 'To the player', bar, h('button', { type: 'button', class: 'phg-link', onclick: stay }, 'Stay here')))
        }
        if (actions.childElementCount)
          kids.push(actions)
      }
      right.replaceChildren(...kids.filter((k): k is HTMLElement => !!k))
    }

    function playAgain(id: string) {
      void machine.replay(id)
      ctx.ui.showStage('player')
    }

    function renderQueue() {
      const strip = upNext(machine)
      queued.hidden = !strip
      queued.replaceChildren(...(strip ? [strip] : []))
    }

    function renderRecent() {
      const items = machine.state().history
      recent.hidden = !items.length
      recent.replaceChildren(h('div', { class: 'phg-coll-head' }, h('h2', { text: 'Last pulls' }), h('span', { class: 'phg-muted', text: 'Newest first. Click one to play it again, without a modifier.' })), timeline(machine, items, playAgain))
    }

    function renderCollection() {
      const s = machine.state()
      const list = sorted(s.collection)
      const t = tally(s.collection)
      const chips = h('div', { class: 'phg-tally' }, ...[...TIERS].reverse().filter(x => t[x]).map((x) => {
        const c = h('span', { text: `${t[x]} ${TIER_INFO[x].name}` })
        c.style.setProperty('--phg-tier', TIER_INFO[x].colour)
        return c
      }))
      const count = poolSize !== null ? `${list.length} of ${poolSize} in the pool` : `${list.length} collected`
      collHead.replaceChildren(h('h2', { text: 'Collection' }), h('span', { class: 'phg-muted', text: `${count} · ${s.pulls} ${s.pulls === 1 ? 'pull' : 'pulls'}` }), chips)
      grid.replaceChildren(...list.map(([id, e]) => {
        const tile = h('button', { type: 'button', class: 'phg-tile', title: `Play ${e.title}, without a modifier` })
        setTier(tile, e.best)
        tile.addEventListener('click', () => playAgain(id))
        tile.append(thumb(machine, id, e.best, io), h('div', { class: 'phg-tile-body' },
          h('span', { class: 'phg-tile-title', text: e.title }),
          h('div', { class: 'phg-tile-meta' }, h('span', { text: stars(e.best) }), h('span', { text: `×${e.count}` })),
        ))
        return tile
      }))
      resetBtn.hidden = !list.length
    }

    function renderAll(reveal = false) {
      renderMachine()
      renderResult(reveal)
      renderQueue()
      renderRecent()
      renderCollection()
    }

    function stay() {
      clearTimeout(goTimer)
      goTimer = undefined
      renderResult()
    }

    /** Go to the player in a moment (a setting), unless Stay here. */
    function goSoon(ms: number) {
      if (!cfg().toPlayer)
        return
      goMs = ms
      goTimer = setTimeout(() => {
        goTimer = undefined
        if (alive)
          ctx.ui.showStage('player')
      }, ms)
    }

    function setBusy(on: boolean) {
      busy = on
      pullBtn.disabled = on
      tenBtn.disabled = on
    }

    /** An Epic's or a Legendary's moment over the page (with the animation on); resolves as it fades. */
    async function moment(p: Pick<Plan, 'tier'>) {
      if (!cfg().animation || !atLeast(p.tier, 'epic'))
        return
      fx = celebrate(host, root, p.tier, { compact: false, motion: !reducedMotion(), holdMs: holdFor(p.tier) })
      await fx.done
      fx = null
    }

    async function pull() {
      if (busy)
        return
      setBusy(true)
      const release = fanfare.hold()
      stay()
      try {
        const p = await machine.plan()
        if (!p || !alive)
          return
        const c = cfg()
        if (view.wanted(c))
          await view.animate(p.tier, { onUpgrade: to => fanfare.upgraded(to), onOpen: () => fanfare.sound.stinger(p.tier) })
        else
          fanfare.sound.stinger(p.tier)
        if (!alive)
          return
        // The video loads while the moment holds.
        void machine.launch(p)
        await moment(p)
        if (!alive)
          return
        shown = { id: p.video.id, title: p.video.title, tier: p.tier, modifier: p.modifier, guaranteed: p.guaranteed, isNew: p.isNew, reasons: reasons(p.score), banner: p.banner }
        lastAt = machine.state().last?.at ?? 0
        fanfare.revealed(p)
        goSoon(TO_PLAYER_MS)
        renderAll(true)
      }
      finally {
        setBusy(false)
        release()
      }
    }

    async function pullTen() {
      if (busy)
        return
      setBusy(true)
      const release = fanfare.hold()
      stay()
      try {
        const plans = await machine.planTen()
        if (!plans || !alive)
          return
        const c = cfg()
        const g = opening = tenGrid(machine, plans)
        const best = g.order[g.order.length - 1]
        card = { key: `ten|${machine.state().last?.at ?? 0}`, el: g.el }
        // The ten closed capsules wait while the crank turns.
        right.replaceChildren(g.el)
        if (view.wanted(c)) {
          await view.crank()
          await g.reveal(fanfare.sound)
        }
        else {
          g.showAll()
          fanfare.sound.stinger(best.tier)
        }
        opening = null
        if (!alive)
          return
        // The first starts while the best one's moment holds; the rest follow it.
        machine.startQueue(plans)
        await moment(best)
        if (!alive)
          return
        shown = null
        lastAt = machine.state().last?.at ?? 0
        const first = plans.find(p => p.firstLegendary)
        if (first)
          fanfare.revealed(first)
        goSoon(TEN_TO_PLAYER_MS)
        renderAll()
      }
      finally {
        opening = null
        setBusy(false)
        release()
      }
    }

    // A break's countdown, while one runs.
    const countdown = setInterval(() => {
      if (!busy && machine.active()?.breakUntil != null)
        renderResult()
    }, 500)

    const off = machine.subscribe(() => {
      // While the page animates a pull, its own reveal renders it all: the
      // pity meter dropping to zero early would give an Epic away.
      if (busy)
        return
      const at = machine.state().last?.at ?? 0
      renderAll(at !== lastAt)
      lastAt = at
    })
    const offPlayer = ctx.player.onChange(() => {
      if (!busy)
        renderResult()
    })
    const refreshPool = () => {
      machine.pool().then((p) => {
        poolSize = p.length
        bannerTag = machine.bannerFor(p)
        showOdds(p.length ? tierChances(tierCounts(p, Date.now()), false) : null)
        if (alive && !busy) {
          renderMachine()
          renderCollection()
        }
      }).catch(() => {})
    }
    const offLib = ctx.library.onChange(refreshPool)
    const offSettings = ctx.settings.onChange(() => {
      if (!busy)
        renderMachine()
      refreshPool()
    })

    renderAll()
    refreshPool()

    return () => {
      alive = false
      view.skip()
      opening?.skip()
      fx?.skip()
      clearTimeout(goTimer)
      clearInterval(countdown)
      io.disconnect()
      off()
      offPlayer()
      offLib()
      offSettings()
      host.remove()
    }
  }
}
