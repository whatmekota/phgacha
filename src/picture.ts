import type { ModifierId } from './modifiers'
import type { PictureEffects } from './types'

/**
 * The picture modifiers' effects (player.effects): CSS on the picture,
 * around its centre. Mirror, Noir, Dreamy and Tilt hold still; Pulse zooms a
 * little with the stroke, a new effect every animation frame.
 */

/** How far Tilt turns the picture, degrees. */
export const TILT_DEG = 2.5
/** How much Pulse zooms in at the bottom of a stroke: 5%. */
export const PULSE_ZOOM = 0.05
/** Pulse with reduced motion asked for after it started: a still zoom, halfway. */
export const PULSE_STILL = `scale(${1 + PULSE_ZOOM / 2})`

/**
 * How much to zoom a picture of `aspect` (width / height) turned by `deg`
 * so that it still covers its own box: no corner of the box left empty.
 * Rounded up, so it never falls short.
 */
export function tiltScale(deg: number, aspect: number): number {
  const a = Math.abs(deg) * Math.PI / 180
  const r = aspect > 0 && Number.isFinite(aspect) ? Math.max(aspect, 1 / aspect) : 16 / 9
  return Math.ceil((Math.cos(a) + r * Math.sin(a)) * 1000) / 1000
}

/**
 * A still picture modifier's effect. `aspect` is the picture's width over
 * its height (16 / 9 when not known), `dir` which way Tilt turns. Null for
 * Pulse (see pulseEffects) and for modifiers that leave the picture alone.
 */
export function pictureEffects(id: ModifierId, opts: { aspect?: number, dir?: 1 | -1 } = {}): PictureEffects | null {
  switch (id) {
    case 'mirror':
      return { transform: 'scaleX(-1)' }
    case 'noir':
      return { filter: 'grayscale(1) contrast(1.35) brightness(0.95)' }
    case 'dreamy':
      return { filter: 'blur(1.2px) brightness(1.08) saturate(1.25) contrast(0.92) drop-shadow(0 0 16px rgb(255 214 236 / 0.4))' }
    case 'tilt': {
      const deg = TILT_DEG * (opts.dir ?? 1)
      return { transform: `rotate(${deg}deg) scale(${tiltScale(deg, opts.aspect ?? 16 / 9)})` }
    }
    default:
      return null
  }
}

/**
 * Pulse for this frame: the stroke's position `l0` (0 the bottom, 1 the
 * top) zooms the picture in, most at the bottom. Null (the picture as it
 * is) while it doesn't play or the position isn't known; a still zoom with
 * reduced motion.
 */
export function pulseEffects(l0: number | null | undefined, playing: boolean, still: boolean): PictureEffects | null {
  if (still)
    return { transform: PULSE_STILL }
  if (!playing || typeof l0 !== 'number' || !Number.isFinite(l0))
    return null
  const k = 1 - Math.min(1, Math.max(0, l0))
  return { transform: `scale(${(1 + PULSE_ZOOM * k).toFixed(4)})` }
}

/** Two effects the same (so an unchanged frame isn't sent again). */
export const sameEffects = (a: PictureEffects | null, b: PictureEffects | null) =>
  a === b || (!!a && !!b && a.transform === b.transform && a.filter === b.filter && a.opacity === b.opacity)
