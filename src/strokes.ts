/**
 * Counting strokes for the Breaks modifier. A stroke ends where the script
 * turns at the bottom: one down-and-up is one stroke. Holds (the same
 * position twice) and points that keep going the same way are not turns.
 */

export interface Action { at: number, pos: number }

/** Times (ms) where the script turns from going down to going up: the bottom of each stroke. */
export function strokeBottoms(actions: Action[]): number[] {
  const pts = [...actions].filter(a => Number.isFinite(a.at) && Number.isFinite(a.pos)).sort((a, b) => a.at - b.at)
  const out: number[] = []
  let dir = 0 // -1 going down, 1 going up, 0 not known yet
  let low = pts[0]
  for (let i = 1; i < pts.length; i++) {
    const d = Math.sign(pts[i].pos - pts[i - 1].pos)
    if (d === 0)
      continue
    if (d < 0) {
      low = pts[i]
    }
    else if (dir < 0) {
      // Down, then up: the last low point was a bottom.
      out.push(low.at)
    }
    dir = d
  }
  return out
}

/** Where to take a break: at the bottom of every `every`th stroke. */
export function breakPoints(bottoms: number[], every: number): number[] {
  const n = Math.max(1, Math.round(every))
  const out: number[] = []
  for (let i = n - 1; i < bottoms.length; i += n)
    out.push(bottoms[i])
  return out
}

/** How late a break can still be taken: past that (a seek over it), it is skipped. */
export const BREAK_WINDOW_MS = 1500

/**
 * The break that is due at `t` (ms), if any: the latest point already
 * reached but less than BREAK_WINDOW_MS ago, and after `last`, the one taken
 * before. Null when none is due.
 */
export function dueBreak(points: number[], t: number, last: number): number | null {
  // The last point at or before t (points are in order).
  let lo = 0
  let hi = points.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid] <= t) {
      found = mid
      lo = mid + 1
    }
    else {
      hi = mid - 1
    }
  }
  if (found < 0)
    return null
  const p = points[found]
  return p > last && t - p < BREAK_WINDOW_MS ? p : null
}
