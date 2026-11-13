import type { MachineState } from './collection'
import type { ModifierId } from './modifiers'
import type { Tier } from './rarity'
import type { Runner } from './runner'
import type { Config } from './settings'
import type { LibraryVideo, PluginContext } from './types'
import { readState, record, STORAGE_KEY } from './collection'
import { MODIFIERS, rollModifier } from './modifiers'
import { inPool, pick, pityAfter } from './pick'
import { scoreOf } from './rarity'
import { createRunner } from './runner'

/** What a pull came up with, before it plays. */
export interface Plan {
  video: LibraryVideo
  tier: Tier
  modifier: ModifierId | null
  guaranteed: boolean
  isNew: boolean
  /** Why it's that rare ("intense", "never played"…). */
  score: ReturnType<typeof scoreOf>
}

/** How long to wait for a pulled video to load before giving up on its modifier. */
const READY_TIMEOUT_MS = 15_000

/** "clip.mp4" from "Videos/sub/clip.mp4": what the player's title holds. */
const baseName = (id: string) => id.split(/[\\/]/).pop() ?? id

/** Whether the player's title (a file name) is library video `id`. */
export const sameVideo = (id: string, title: string) => title === id || baseName(id) === title

/**
 * The machine: its saved state (pulls, pity, the collection), pulling, and
 * starting the pulled video with its modifier. The page, the panel, the
 * command and the badge all go through it and listen for changes.
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

  const runner: Runner = createRunner(ctx, {
    finaleS: () => cfg().finaleS,
    breakEvery: () => cfg().breakEvery,
    breakS: () => cfg().breakS,
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

  /**
   * Pull: pick a video and roll its modifier, and save it in the collection.
   * Doesn't play it yet (launch does), so the page can animate in between.
   * Null, with a toast saying why, when there is nothing to pull.
   */
  async function plan(): Promise<Plan | null> {
    if (ctx.safety.panicked()) {
      ctx.ui.toast('Panic is on', { detail: 'Lift it first (Esc), then pull.' })
      return null
    }
    const c = cfg()
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
    const now = Date.now()
    const p = pick(videos, { rand: Math.random, now, pity: state.pity, pityAt: c.pityAt, avoid: ctx.player.state().title })
    if (!p)
      return null
    const readout = ctx.motion.readout()
    const modifier = rollModifier(p.tier, {
      rand: Math.random,
      chance: c.chance,
      allowed: c.allowed,
      situation: { device: readout.device, hasScript: p.video.hasScript, durationS: p.video.durationS, finaleS: c.finaleS },
    })
    state = record(state, { id: p.video.id, title: p.video.title, tier: p.tier, modifier, guaranteed: p.guaranteed, at: now }, pityAfter(state.pity, p.tier))
    await ctx.storage.set(STORAGE_KEY, state).catch(err => ctx.log('saving failed', err))
    changed()
    return { video: p.video, tier: p.tier, modifier, guaranteed: p.guaranteed, isNew: state.last!.isNew, score: scoreOf(p.video, now) }
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

  /** Play a collected video as it is, without a modifier. */
  async function replay(id: string) {
    ++launchToken
    runner.end('replaced')
    if (!await ctx.playback.play(id))
      ctx.ui.toast('That video isn\'t in the library any more', { tone: 'error' })
  }

  return {
    state: () => state,
    active: runner.active,
    endModifier: () => runner.end('user'),
    plan,
    launch,
    replay,
    pool,
    thumbnail,
    modifierName: (id: ModifierId) => MODIFIERS.find(m => m.id === id)?.name ?? id,
    /** Forget every pull and the collection. */
    async reset() {
      state = readState(null)
      await ctx.storage.del(STORAGE_KEY)
      changed()
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      ++launchToken
      runner.dispose()
      listeners.clear()
    },
  }
}

export type Machine = Awaited<ReturnType<typeof createMachine>>
