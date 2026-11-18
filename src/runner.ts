import type { ModifierId } from './modifiers'
import type { Tier } from './rarity'
import type { PictureEffects, PlayerSnapshot, PluginContext, ScriptSnapshot } from './types'
import { filterFor, finaleStart, modifierDef, RATES } from './modifiers'
import { pictureEffects, pulseEffects, sameEffects } from './picture'
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

/** Why a modifier ended: 'ended' is its video playing to the end with it on. */
export type EndReason = 'video' | 'ended' | 'panic' | 'user' | 'replaced' | 'off'

export interface RunnerOptions {
  finaleS: () => number
  breakEvery: () => number
  breakS: () => number
  /** Something about the active modifier changed (started, ended, a break). */
  changed: () => void
  /** A modifier ended, and why. */
  ended?: (a: Active, reason: EndReason) => void
  /** The system asks for reduced motion: Pulse holds still. */
  still?: () => boolean
}

/** How often Breaks looks at the clock. Strokes are seldom quicker than 5 a second. */
const TICK_MS = 100

/** The picture's width over its height; 16 / 9 until it's known. */
const aspectOf = (s: PlayerSnapshot) => (s.width > 0 && s.height > 0 ? s.width / s.height : 16 / 9)

// Animation frames, or a timer where there are none (tests).
const nextFrame = (fn: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16) as unknown as number
const cancelFrame = (h: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(h) : clearTimeout(h))

/**
 * Runs one modifier at a time and makes sure it never outlives its video.
 * It ends when another video loads (player.onChange), when the video ends
 * (playback.onEnded), on panic (safety.onPanic), when the plugin is switched
 * off, or when asked. Ending removes the filter and the picture's effect,
 * and puts the speed back to what it was, unless the user changed the speed
 * themselves meanwhile (then theirs stands). A break in progress is resumed
 * only if the user ended the modifier by hand: never after a panic, and not
 * on another video.
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
  /** What player.effects has from us now: null when the picture is left alone. */
  let fx: PictureEffects | null = null
  /** Pulse's animation frame, while it runs. */
  let frame = 0
  let playing = false
  /** Which way Tilt turns, rolled when it starts. */
  let tiltDir: 1 | -1 = 1

  function setFx(next: PictureEffects | null) {
    if (sameEffects(next, fx) || typeof ctx.player.effects !== 'function')
      return
    fx = next
    try {
      ctx.player.effects(next)
    }
    catch (err) {
      ctx.log('changing the picture failed', err)
    }
  }

  /** Where the stroke is, 0–1: the stroke axis as sent to the device, or the script's own position without one. */
  function strokePos(): number | null {
    try {
      const r = ctx.motion.readout()
      const l0 = r.device && typeof ctx.motion.axes === 'function' ? ctx.motion.axes().L0 : undefined
      return typeof l0 === 'number' ? l0 : r.pos
    }
    catch {
      return null
    }
  }

  /** Pulse: each frame, zoom with the stroke while the video plays. */
  function startPulse() {
    playing = ctx.player.state().playing
    const tick = () => {
      frame = nextFrame(tick)
      if (active?.id !== 'pulse')
        return
      setFx(pulseEffects(playing ? strokePos() : null, playing, opts.still?.() ?? false))
    }
    frame = nextFrame(tick)
  }

  function end(reason: EndReason) {
    if (!active)
      return
    const was = active
    active = null
    removeFilter?.()
    removeFilter = null
    if (frame) {
      cancelFrame(frame)
      frame = 0
    }
    setFx(null)
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
    try {
      opts.ended?.(was, reason)
    }
    catch (err) {
      ctx.log('noting how a modifier ended failed', err)
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
    if (id === 'pulse') {
      startPulse()
    }
    else if (modifierDef(id).picture) {
      tiltDir = Math.random() < 0.5 ? -1 : 1
      setFx(pictureEffects(id, { aspect: aspectOf(ctx.player.state()), dir: tiltDir }))
    }
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
      playing = s.playing
      // Tilt's zoom follows the picture's shape, once it's known.
      if (active.id === 'tilt')
        setFx(pictureEffects('tilt', { aspect: aspectOf(s), dir: tiltDir }))
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
