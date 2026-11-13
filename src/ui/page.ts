import type { Machine, Plan } from '../machine'
import { sameVideo } from '../machine'
import type { Config } from '../settings'
import type { PluginContext } from '../types'
import type { CardData } from './card'
import { sorted, tally } from '../collection'
import { ODDS, pityDue } from '../pick'
import { reasons, TIER_INFO, TIERS } from '../rarity'
import { capsule, machine as machineArt, stars } from './art'
import { lazyThumbs, resultCard, setTier, thumb } from './card'
import { h, reducedMotion, svg } from './dom'

/** How long the page waits after the reveal before going to the player. */
const TO_PLAYER_MS = 2200

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

/** Sets the tier colour variable on the stage (for the capsule's glow and burst). */
function stageTier(stage: HTMLElement, tier: Plan['tier']) {
  stage.style.setProperty('--phg-tier', TIER_INFO[tier].colour)
  stage.dataset.tier = tier
}

/**
 * The machine's page: the gacha machine with its Pull button and pity
 * meter, the last pull's card, and the collection.
 */
export function mountPage(ctx: PluginContext, machine: Machine, cfg: () => Config, pullKey: () => string | null) {
  return (el: HTMLElement) => {
    const root = h('div', { class: 'phg phg-page' })
    el.append(root)
    let alive = true
    let busy = false
    /** The card for a pull made while the page is up, with its reasons; else the saved last pull. */
    let shown: CardData | null = null
    let goTimer: ReturnType<typeof setTimeout> | undefined
    let poolSize: number | null = null
    let card: { key: string, el: HTMLElement } | null = null
    /** The last pull rendered: one made elsewhere (the shortcut, the panel) still gets its reveal here. */
    let lastAt = machine.state().last?.at ?? 0

    // ─── The machine ───
    const stage = h('div', { class: 'phg-stage', title: '' })
    stage.append(svg(machineArt()))
    const drop = h('div', { class: 'phg-drop' })
    const burst = h('div', { class: 'phg-burst' })
    const skipNote = h('div', { class: 'phg-skip', text: 'Click to skip' })
    stage.append(burst, drop, skipNote)
    let skipper: ReturnType<typeof skippable> | null = null
    stage.addEventListener('click', () => skipper?.skip())

    const pullBtn = h('button', { type: 'button', class: 'phg-pull', onclick: () => void pull() }, 'Pull')
    const keyHint = h('p', { class: 'phg-faint' })
    const pityLine = h('div', { class: 'phg-pity-line' })
    const pityBar = h('span')
    const pity = h('div', { class: 'phg-pity' }, pityLine, h('div', { class: 'phg-pity-bar' }, pityBar))
    const odds = h('div', { class: 'phg-odds' }, ...TIERS.map((t) => {
      const s = h('span', { text: `${TIER_INFO[t].name} ${ODDS[t]}%` })
      s.style.setProperty('--phg-tier', TIER_INFO[t].colour)
      return s
    }))
    const left = h('div', { class: 'phg-left' }, stage, pullBtn, keyHint, pity, odds)

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

    root.append(h('div', { class: 'phg-top' }, left, right), coll)
    const io = lazyThumbs(root)

    function renderMachine() {
      const s = machine.state()
      const c = cfg()
      const due = pityDue(s.pity, c.pityAt)
      pity.toggleAttribute('data-due', due)
      pullBtn.toggleAttribute('data-due', due)
      pityLine.replaceChildren(
        h('span', { text: due ? 'Next pull' : 'Epic or better in' }),
        h('b', { text: due ? 'Epic or better, guaranteed' : `${c.pityAt - s.pity} ${c.pityAt - s.pity === 1 ? 'pull' : 'pulls'}` }),
      )
      pityBar.style.width = `${Math.min(100, (s.pity / c.pityAt) * 100)}%`
      const key = pullKey()
      keyHint.replaceChildren(...(key ? ['Or ', h('span', { class: 'phg-kbd', text: key }), ' anywhere in playhound'] : ['Or "Pull from the gacha" in the command palette (Ctrl K)']))
    }

    function renderResult(reveal = false) {
      const s = machine.state()
      const data: CardData | null = shown?.id === s.last?.id ? shown : s.last
      const kids: (HTMLElement | null)[] = []
      if (!data) {
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
      const a = machine.active()
      if (a && data && sameVideo(data.id, a.video)) {
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
      if (data) {
        const playing = ctx.player.state().title
        const actions = h('div', { class: 'phg-actions' })
        if (playing && sameVideo(data.id, playing))
          actions.append(h('button', { type: 'button', class: 'phg-btn', onclick: () => ctx.ui.showStage('player') }, 'Watch'))
        if (goTimer !== undefined) {
          const bar = h('div', { class: 'phg-going-bar' }, h('span'))
          bar.style.setProperty('--phg-going', `${TO_PLAYER_MS}ms`)
          actions.append(h('div', { class: 'phg-going', style: { flex: '1' } }, 'To the player', bar, h('button', { type: 'button', class: 'phg-link', onclick: stay }, 'Stay here')))
        }
        if (actions.childElementCount)
          kids.push(actions)
      }
      right.replaceChildren(...kids.filter((k): k is HTMLElement => !!k))
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
        tile.addEventListener('click', () => {
          void machine.replay(id)
          ctx.ui.showStage('player')
        })
        tile.append(thumb(machine, id, e.best, io), h('div', { class: 'phg-tile-body' },
          h('span', { class: 'phg-tile-title', text: e.title }),
          h('div', { class: 'phg-tile-meta' }, h('span', { text: stars(e.best) }), h('span', { text: `×${e.count}` })),
        ))
        return tile
      }))
      resetBtn.hidden = !list.length
    }

    function stay() {
      clearTimeout(goTimer)
      goTimer = undefined
      renderResult()
    }

    async function animate(p: Plan) {
      stageTier(stage, p.tier)
      drop.replaceChildren(svg(capsule(TIER_INFO[p.tier].colour, 56)))
      skipper = skippable()
      const { sleep } = skipper
      stage.dataset.phase = 'crank'
      await sleep(650)
      stage.dataset.phase = 'drop'
      await sleep(520)
      stage.dataset.phase = 'wobble'
      // The rarer, the longer the suspense.
      await sleep(p.tier === 'legendary' ? 1100 : p.tier === 'epic' ? 750 : 450)
      stage.dataset.phase = 'open'
      await sleep(320)
      stage.dataset.phase = 'done'
      skipper = null
    }

    async function pull() {
      if (busy)
        return
      busy = true
      pullBtn.disabled = true
      stay()
      try {
        const p = await machine.plan()
        if (!p || !alive)
          return
        const c = cfg()
        if (c.animation && !reducedMotion())
          await animate(p)
        if (!alive)
          return
        shown = { id: p.video.id, title: p.video.title, tier: p.tier, modifier: p.modifier, guaranteed: p.guaranteed, isNew: p.isNew, reasons: reasons(p.score) }
        lastAt = machine.state().last?.at ?? 0
        void machine.launch(p)
        if (c.toPlayer)
          goTimer = setTimeout(() => {
            goTimer = undefined
            if (alive)
              ctx.ui.showStage('player')
          }, TO_PLAYER_MS)
        renderMachine()
        renderResult(true)
        renderCollection()
      }
      finally {
        busy = false
        pullBtn.disabled = false
      }
    }

    // A break's countdown, while one runs.
    const countdown = setInterval(() => {
      if (machine.active()?.breakUntil != null)
        renderResult()
    }, 500)

    const off = machine.subscribe(() => {
      // While the page animates a pull, its own reveal renders it all: the
      // pity meter dropping to zero early would give an Epic away.
      if (busy)
        return
      const at = machine.state().last?.at ?? 0
      renderMachine()
      renderResult(at !== lastAt)
      renderCollection()
      lastAt = at
    })
    const offPlayer = ctx.player.onChange(() => {
      if (!busy)
        renderResult()
    })
    const refreshPool = () => {
      machine.pool().then((p) => {
        poolSize = p.length
        if (alive)
          renderCollection()
      }).catch(() => {})
    }
    const offLib = ctx.library.onChange(refreshPool)
    const offSettings = ctx.settings.onChange(() => {
      renderMachine()
      refreshPool()
    })

    renderMachine()
    renderResult()
    renderCollection()
    refreshPool()

    return () => {
      alive = false
      skipper?.skip()
      clearTimeout(goTimer)
      clearInterval(countdown)
      io.disconnect()
      off()
      offPlayer()
      offLib()
      offSettings()
      root.remove()
    }
  }
}
