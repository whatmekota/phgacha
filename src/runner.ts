import type { ModifierId } from './modifiers'
import type { Tier } from './rarity'
import type { PluginContext, ScriptSnapshot } from './types'
import { filterFor, finaleStart, RATES } from './modifiers'
import { breakPoints, dueBreak, strokeBottoms } from './strokes'

/** The modifier that is on, as the UI shows it. */
export interface Active {
  id: ModifierId
  tier: Tier
  /** The player's title for the video it is on. */
  video: string
  startedAt: number
  /** While a break pauses the video: when it resumes (ms since epoch). */
  breakUntil: number | null
}

export interface RunnerOptions {
  finaleS: () => number
  breakEvery: () => number
  breakS: () => number
  /** Something about the active modifier changed (started, ended, a break). */
  changed: () => void
}

/** How often Breaks looks at the clock. Strokes are seldom quicker than 5 a second. */
const TICK_MS = 100

/**
 * Runs one modifier at a time and makes sure it never outlives its video.
 * It ends when another video loads (player.onChange), when the video ends
 * (playback.onEnded), on panic (safety.onPanic), when the plugin is switched
 * off, or when asked. Ending removes the filter and puts the speed back to
 * what it was, unless the user changed the speed themselves meanwhile (then
 * theirs stands). A break in progress is resumed only if the user ended the
 * modifier by hand: never after a panic, and not on another video.
 */
export function createRunner(ctx: PluginContext, opts: RunnerOptions) {
  let active: Active | null = null
  let removeFilter: (() => void) | null = null
  /** The speed before a speed modifier, and the speed it set; null once the user has taken the speed back. */
  let rate: { before: number, ours: number } | null = null
  let breakTimer: ReturnType<typeof setTimeout> | undefined
  let tick: ReturnType<typeof setInterval> | undefined
  let unScripts: (() => void) | null = null
  let points: number[] = []
  let lastBreak = -Infinity
  /** The player has reported the break's pause: a play after that is the user's. */
  let breakPaused = false

  function end(reason: 'video' | 'ended' | 'panic' | 'user' | 'replaced' | 'off') {
    if (!active)
      return
    const was = active
    active = null
    removeFilter?.()
    removeFilter = null
    clearInterval(tick)
    tick = undefined
    unScripts?.()
    unScripts = null
    clearTimeout(breakTimer)
    breakTimer = undefined
    if (rate) {
      const now = ctx.player.state().rate
      // Only put it back if it's still the speed we set: the user's own change wins.
      if (Math.abs(now - rate.ours) < 0.01)
        ctx.player.setRate(rate.before)
      rate = null
    }
    if (was.breakUntil !== null && reason === 'user' && !ctx.safety.panicked()) {
      const s = ctx.player.state()
      if (s.title === was.video && !s.playing)
        ctx.playback.resume()
    }
    opts.changed()
  }

  /** The stroke axis's bottoms, from the scripts loaded for `video`. */
  function readPoints(snap: ScriptSnapshot, video: string) {
    if (snap.video !== null && snap.video !== video)
      return
    const axis = snap.axes.find(a => a.axis === 'L0') ?? snap.axes[0]
    points = axis ? breakPoints(strokeBottoms(axis.actions), opts.breakEvery()) : []
  }

  function startBreaks(video: string) {
    lastBreak = -Infinity
    readPoints(ctx.scripts.current(), video)
    unScripts = ctx.scripts.onChange(s => readPoints(s, video))
    tick = setInterval(() => {
      if (!active || active.breakUntil !== null || ctx.safety.panicked())
        return
      const s = ctx.player.state()
      if (!s.playing || s.title !== video)
        return
      const t = ctx.player.clock() * 1000
      // Sought back past the last break: those strokes count again.
      if (t < lastBreak - 1000)
        lastBreak = -Infinity
      const due = dueBreak(points, t, lastBreak)
      if (due === null)
        return
      lastBreak = due
      const ms = opts.breakS() * 1000
      active.breakUntil = Date.now() + ms
      breakPaused = false
      ctx.playback.pause()
      opts.changed()
      breakTimer = setTimeout(() => {
        breakTimer = undefined
        if (!active || active.breakUntil === null)
          return
        active.breakUntil = null
        const now = ctx.player.state()
        if (!ctx.safety.panicked() && now.title === video && !now.playing)
          ctx.playback.resume()
        opts.changed()
      }, ms)
    }, TICK_MS)
  }

  /**
   * Put a modifier on the video that is loaded now (`video`, its player
   * title). Ends whatever modifier was on first.
   */
  function start(id: ModifierId, tier: Tier, video: string) {
    end('replaced')
    if (ctx.safety.panicked())
      return
    active = { id, tier, video, startedAt: Date.now(), breakUntil: null }
    const filter = filterFor(id)
    if (filter)
      removeFilter = ctx.motion.filter(filter)
    const factor = RATES[id]
    if (factor) {
      const before = ctx.player.state().rate || 1
      const ours = Math.round(Math.min(10, Math.max(0.1, before * factor)) * 100) / 100
      rate = { before, ours }
      ctx.player.setRate(ours)
    }
    if (id === 'finale') {
      const d = ctx.player.state().duration
      if (d > 0)
        ctx.player.seek(finaleStart(d, opts.finaleS()))
    }
    if (id === 'breaks')
      startBreaks(video)
    opts.changed()
  }

  const offs = [
    ctx.player.onChange((s) => {
      if (!active)
        return
      if (s.title !== active.video) {
        end('video')
        return
      }
      // The user set another speed: it's theirs now, leave it when we end.
      if (rate && Math.abs(s.rate - rate.ours) >= 0.01)
        rate = null
      // The user pressed play during a break: the break is over. (The pause
      // shows up a moment after pause(); a report from before it doesn't count.)
      if (active.breakUntil !== null && !s.playing)
        breakPaused = true
      if (active.breakUntil !== null && s.playing && breakPaused) {
        clearTimeout(breakTimer)
        breakTimer = undefined
        active.breakUntil = null
        opts.changed()
      }
    }),
    ctx.playback.onEnded(() => end('ended')),
    ctx.safety.onPanic(() => end('panic')),
  ]

  return {
    start,
    end,
    active: () => active,
    dispose() {
      end('off')
      for (const off of offs)
        off()
    },
  }
}

export type Runner = ReturnType<typeof createRunner>
