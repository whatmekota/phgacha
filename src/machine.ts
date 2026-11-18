import type { MachineState } from './collection'
import type { ModifierId, Situation } from './modifiers'
import type { Pick as Pulled } from './pick'
import type { Tier } from './rarity'
import type { Runner } from './runner'
import type { Config } from './settings'
import type { LibraryVideo, PluginContext } from './types'
import { bannerTag, dayKey } from './banner'
import { bump, endure, readState, record, recordTen, STORAGE_KEY } from './collection'
import { isAudio, MODIFIERS, rollModifier } from './modifiers'
import { bestIndex, inPool, pick, pickMany, pityAfter, revealOrder, TEN } from './pick'
import { scoreOf } from './rarity'
import { createRunner } from './runner'
import { reducedMotion } from './ui/dom'

/** What a pull came up with, before it plays. */
export interface Plan {
  video: LibraryVideo
  tier: Tier
  modifier: ModifierId | null
  guaranteed: boolean
  isNew: boolean
  /** The first Legendary ever pulled. */
  firstLegendary: boolean
  /** Why it's that rare ("intense", "never played"…). */
  score: ReturnType<typeof scoreOf>
  /** It has the day's banner tag. */
  banner: boolean
}

/** A ×10 just pulled: its pulls in the order they were rolled, all at `at`. */
export interface Ten {
  at: number
  plans: Plan[]
}

/** How long to wait for a pulled video to load before giving up on its modifier. */
const READY_TIMEOUT_MS = 15_000

/** "clip.mp4" from "Videos/sub/clip.mp4": what the player's title holds. */
const baseName = (id: string) => id.split(/[\\/]/).pop() ?? id

/** Whether the player's title (a file name) is library video `id`. */
export const sameVideo = (id: string, title: string) => title === id || baseName(id) === title

/**
 * The machine: its saved state (pulls, pity, the collection), pulling (one,
 * or ten at once), and starting the pulled video with its modifier; a ×10's
 * videos then play one after another. The page, the panel, the commands and
 * the badge all go through it and listen for changes.
 */
export async function createMachine(ctx: PluginContext, cfg: () => Config) {
  let state: MachineState = readState(await ctx.storage.get(STORAGE_KEY))
  const listeners = new Set<() => void>()
  const changed = () => {
    for (const fn of listeners) {
      try {
        fn()
      }
      catch (err) {
        ctx.log('a view failed to update', err)
      }
    }
  }
  const save = () => ctx.storage.set(STORAGE_KEY, state).catch(err => ctx.log('saving failed', err))

  const runner: Runner = createRunner(ctx, {
    finaleS: () => cfg().finaleS,
    breakEvery: () => cfg().breakEvery,
    breakS: () => cfg().breakS,
    still: reducedMotion,
    ended(a, reason) {
      // Still on when its video played to the end: it counts as seen through.
      if (reason !== 'ended')
        return
      const next = endure(state, a.id)
      if (next !== state) {
        state = next
        void save()
      }
    },
    changed,
  })

  // Thumbnails, kept for the session: the collection grid asks for many.
  const thumbs = new Map<string, Promise<string | null>>()
  function thumbnail(id: string): Promise<string | null> {
    let p = thumbs.get(id)
    if (!p) {
      p = ctx.library.thumbnail(id).catch(() => null)
      thumbs.set(id, p)
    }
    return p
  }

  // Intensity is only known once a script is analysed. Ask for the pool once
  // a session, in the background: later pulls then rate those videos fully.
  let analysed = false
  function analyseOnce(pool: LibraryVideo[]) {
    if (analysed)
      return
    analysed = true
    const ids = pool.filter(v => v.hasScript && !v.intensity).map(v => v.id).slice(0, 500)
    if (ids.length)
      ctx.library.analyse(ids).catch(err => ctx.log('analysing the pool failed', err))
  }

  async function pool(): Promise<LibraryVideo[]> {
    const c = cfg()
    return (await ctx.library.list()).filter(v => inPool(v, c.pool))
  }

  /** The day's banner tag for these videos; null with none, or with the banner off. */
  const bannerFor = (videos: LibraryVideo[]) => (cfg().banner ? bannerTag(videos, dayKey(new Date())) : null)

  /** What a pulled video and the setup offer its modifier. */
  function situation(v: LibraryVideo): Situation {
    return {
      device: ctx.motion.readout().device,
      hasScript: v.hasScript,
      durationS: v.durationS,
      finaleS: cfg().finaleS,
      picture: typeof ctx.player.effects === 'function' && !isAudio(v.path),
      still: reducedMotion(),
    }
  }

  /** The pool, if a pull can go ahead; null, with a toast saying why, if not. */
  async function pullable(): Promise<LibraryVideo[] | null> {
    if (ctx.safety.panicked()) {
      ctx.ui.toast('Panic is on', { detail: 'Lift it first (Esc), then pull.' })
      return null
    }
    const videos = await pool()
    if (!videos.length) {
      const all = (await ctx.library.list()).length
      ctx.ui.toast(all ? 'Nothing in the gacha\'s pool' : 'The library is empty', {
        tone: 'error',
        detail: all ? 'No video fits its filters: see Settings → Plugins → Gacha.' : 'Open a library folder first.',
      })
      return null
    }
    analyseOnce(videos)
    return videos
  }

  /** Put a pick in the state (the collection, the pity, the counts), as a Plan. */
  function take(p: Pulled, modifier: ModifierId | null, now: number): Plan {
    const firstLegendary = p.tier === 'legendary' && state.legendaries === 0
    state = record(state, { id: p.video.id, title: p.video.title, tier: p.tier, modifier, guaranteed: p.guaranteed, at: now }, pityAfter(state.pity, p.tier), { banner: p.banner })
    return { video: p.video, tier: p.tier, modifier, guaranteed: p.guaranteed, isNew: state.last!.isNew, firstLegendary, score: scoreOf(p.video, now), banner: p.banner }
  }

  function roll(p: Pulled): ModifierId | null {
    const c = cfg()
    return rollModifier(p.tier, { rand: Math.random, chance: c.chance, allowed: c.allowed, situation: situation(p.video) })
  }

  /**
   * Pull: pick a video and roll its modifier, and save it in the collection.
   * Doesn't play it yet (launch does), so the page can animate in between.
   * Ends a ×10 that is playing. Null, with a toast saying why, when there is
   * nothing to pull.
   */
  async function plan(): Promise<Plan | null> {
    const videos = await pullable()
    if (!videos)
      return null
    const now = Date.now()
    const p = pick(videos, { rand: Math.random, now, pity: state.pity, pityAt: cfg().pityAt, avoid: ctx.player.state().title, banner: bannerFor(videos) })
    if (!p)
      return null
    endQueue(false)
    ten = null
    const out = take(p, roll(p), now)
    await save()
    changed()
    return out
  }

  /**
   * A ×10: ten pulls at once, the pity counting across them, all saved in
   * the collection. Only the best of them (the rarest; the last of those)
   * may carry a modifier. Doesn't play them yet (startQueue does). Ends a
   * ×10 that is playing. In the order they were rolled; null when there is
   * nothing to pull.
   */
  async function planTen(): Promise<Plan[] | null> {
    const videos = await pullable()
    if (!videos)
      return null
    const now = Date.now()
    const picks = pickMany(videos, TEN, { rand: Math.random, now, pity: state.pity, pityAt: cfg().pityAt, avoid: ctx.player.state().title, banner: bannerFor(videos) })
    if (!picks.length)
      return null
    endQueue(false)
    const best = bestIndex(picks)
    const plans = picks.map((p, i) => take(p, i === best ? roll(p) : null, now))
    state = recordTen(state, picks.map(p => p.tier))
    ten = { at: now, plans }
    await save()
    changed()
    return plans
  }

  /** Resolves true once `id` is loaded and its length known; false on a timeout, or if something else loads. */
  function whenReady(id: string, token: number): Promise<boolean> {
    const ready = () => {
      const s = ctx.player.state()
      return s.title !== null && sameVideo(id, s.title) && s.duration > 0
    }
    if (ready())
      return Promise.resolve(true)
    return new Promise((resolve) => {
      const started = Date.now()
      let off = () => {}
      // Polled as well as watched: onChange is enough, the poll is a cheap safety net.
      const timer = setInterval(check, 250)
      off = ctx.player.onChange(check)
      function check() {
        const ok = ready()
        if (ok || token !== launchToken || Date.now() - started > READY_TIMEOUT_MS) {
          clearInterval(timer)
          off()
          resolve(ok && token === launchToken)
        }
      }
    })
  }

  let launchToken = 0
  /** Play a pulled video and put its modifier on once it has loaded. */
  async function launch(p: Plan): Promise<boolean> {
    const token = ++launchToken
    // The old modifier goes first, so its speed is put back before the new video starts.
    runner.end('replaced')
    const ok = await ctx.playback.play(p.video.id)
    if (!ok) {
      ctx.ui.toast('That video isn\'t in the library any more', { tone: 'error', detail: p.video.title })
      return false
    }
    if (p.modifier && await whenReady(p.video.id, token) && token === launchToken && !ctx.safety.panicked())
      runner.start(p.modifier, p.tier, ctx.player.state().title ?? baseName(p.video.id))
    return true
  }

  // ─── A ×10, played one after another ───
  /** The last ×10 pulled this session. */
  let ten: Ten | null = null
  /** The ×10's video playing now, and those still to come, in order. */
  let queueNow: Plan | null = null
  let queue: Plan[] = []
  /** What played before the queue's video now, until that has loaded: its title may still show for a moment. */
  let queuePrev: string | null = null

  /** Play a ×10's videos one after another, rarest last: the first now, each next when the one before ends. */
  function startQueue(plans: Plan[]) {
    queue = revealOrder(plans)
    queueNow = null
    playNext()
  }

  /** The next of the ×10, now. False when there was none left (the ×10 is over). */
  function playNext(): boolean {
    const next = queue.shift()
    if (!next) {
      endQueue()
      return false
    }
    queuePrev = ctx.player.state().title
    queueNow = next
    changed()
    void launch(next).then((ok) => {
      // Gone from the library: on to the one after.
      if (!ok && queueNow === next)
        playNext()
    })
    return true
  }

  /** Stop the ×10 (what plays now plays on). */
  function endQueue(notify = true) {
    if (!queueNow && !queue.length)
      return
    queueNow = null
    queue = []
    queuePrev = null
    if (notify)
      changed()
  }

  const offs = [
    ctx.playback.onEnded((id) => {
      if (!queueNow || (id && !sameVideo(queueNow.video.id, id)))
        return
      // Its modifier was on to the end; that counts before the next one replaces it.
      runner.end('ended')
      playNext()
    }),
    ctx.player.onChange((s) => {
      if (!queueNow || s.title === null)
        return
      if (sameVideo(queueNow.video.id, s.title)) {
        queuePrev = null
        return
      }
      if (queuePrev !== null && s.title === queuePrev)
        return
      // Something else plays: picked by hand. The ×10 is over.
      endQueue()
    }),
    ctx.safety.onPanic(() => endQueue()),
  ]

  /** Play a collected video as it is, without a modifier. Ends a ×10 that is playing. */
  async function replay(id: string) {
    ++launchToken
    endQueue()
    runner.end('replaced')
    if (!await ctx.playback.play(id))
      ctx.ui.toast('That video isn\'t in the library any more', { tone: 'error' })
  }

  return {
    state: () => state,
    active: runner.active,
    endModifier: () => runner.end('user'),
    plan,
    planTen,
    launch,
    startQueue,
    replay,
    /** The last ×10, while it is the last pull. */
    ten: (): Ten | null => (ten && ten.at === state.last?.at ? ten : null),
    /** The ×10 playing: its video now, and what's still to come. */
    queue: () => ({ now: queueNow, next: queue as readonly Plan[] }),
    /** Play the ×10's `i`th video still to come now; the rest follow it. */
    skipTo(i: number) {
      if (i < 0 || i >= queue.length)
        return
      queue = queue.slice(i)
      playNext()
    },
    endQueue: () => endQueue(),
    /** A Legendary's capsule came out lower and flashed gold, and it was seen. */
    liedLow() {
      state = bump(state, 'liedLow')
      void save()
      changed()
    },
    pool,
    /** The day's banner tag for this pool, or null (no tag has enough videos, or the banner is off). */
    bannerFor,
    thumbnail,
    modifierName: (id: ModifierId) => MODIFIERS.find(m => m.id === id)?.name ?? id,
    /** Forget every pull and the collection. */
    async reset() {
      state = readState(null)
      ten = null
      await ctx.storage.del(STORAGE_KEY)
      changed()
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      ++launchToken
      queue = []
      queueNow = null
      for (const off of offs)
        off()
      runner.dispose()
      listeners.clear()
    },
  }
}

export type Machine = Awaited<ReturnType<typeof createMachine>>
