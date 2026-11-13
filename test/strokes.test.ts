import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BREAK_WINDOW_MS, breakPoints, dueBreak, strokeBottoms } from '../src/strokes.ts'

/** Down-and-up strokes, one every 500 ms, the bottom of each at 250 + 500·i. */
const strokes = (n: number) => Array.from({ length: n * 2 + 1 }, (_, i) => ({ at: i * 250, pos: i % 2 ? 0 : 100 }))

describe('strokes', () => {
  it('counts one stroke per bottom', () => {
    assert.deepEqual(strokeBottoms(strokes(3)), [250, 750, 1250])
  })

  it('takes a hold at the bottom as one turn, and ignores points going the same way', () => {
    const acts = [{ at: 0, pos: 100 }, { at: 100, pos: 50 }, { at: 200, pos: 0 }, { at: 300, pos: 0 }, { at: 400, pos: 100 }, { at: 500, pos: 0 }]
    // The bottom is where the hold starts; the last way down has no way up after it.
    assert.deepEqual(strokeBottoms(acts), [200])
    assert.deepEqual(strokeBottoms([]), [])
  })

  it('puts a break at every Nth stroke', () => {
    const bottoms = strokeBottoms(strokes(45))
    assert.deepEqual(breakPoints(bottoms, 20), [bottoms[19], bottoms[39]])
  })

  it('says a break is due once, and not long after a seek past it', () => {
    const pts = [10_000, 20_000]
    assert.equal(dueBreak(pts, 9_990, -Infinity), null)
    assert.equal(dueBreak(pts, 10_050, -Infinity), 10_000)
    assert.equal(dueBreak(pts, 10_100, 10_000), null)
    assert.equal(dueBreak(pts, 10_000 + BREAK_WINDOW_MS + 1, -Infinity), null)
    assert.equal(dueBreak(pts, 20_010, 10_000), 20_000)
  })
})
