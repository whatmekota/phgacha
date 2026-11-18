import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MODIFIERS } from '../src/modifiers.ts'
import { pictureEffects, PULSE_STILL, PULSE_ZOOM, pulseEffects, sameEffects, TILT_DEG, tiltScale } from '../src/picture.ts'

/** Whether a picture of `aspect`, turned by `deg` and zoomed by `scale` about its centre, still covers its own box. */
function covers(aspect: number, deg: number, scale: number): boolean {
  const a = deg * Math.PI / 180
  const w = aspect / 2
  const h = 0.5
  // Every corner of the box, in the turned picture's own frame, has to be inside it.
  return [[w, h], [w, -h], [-w, h], [-w, -h]].every(([x, y]) => {
    const u = x * Math.cos(a) + y * Math.sin(a)
    const v = -x * Math.sin(a) + y * Math.cos(a)
    return Math.abs(u) <= w * scale + 1e-9 && Math.abs(v) <= h * scale + 1e-9
  })
}

describe('picture modifiers', () => {
  it('has an effect for every still picture modifier, and none for the rest', () => {
    for (const m of MODIFIERS) {
      const fx = pictureEffects(m.id)
      assert.equal(!!fx, !!m.picture && m.id !== 'pulse', m.id)
    }
    assert.deepEqual(pictureEffects('mirror'), { transform: 'scaleX(-1)' })
    assert.match(pictureEffects('noir')!.filter!, /grayscale\(1\).*contrast/)
    assert.match(pictureEffects('dreamy')!.filter!, /blur\(/)
  })

  it('zooms Tilt just enough that no edge shows, wide or tall', () => {
    for (const aspect of [16 / 9, 4 / 3, 9 / 16, 1]) {
      const s = tiltScale(TILT_DEG, aspect)
      assert.ok(covers(aspect, TILT_DEG, s), `${aspect}`)
      assert.ok(!covers(aspect, TILT_DEG, s - 0.01), `${aspect} is not more than it needs`)
    }
    assert.equal(tiltScale(TILT_DEG, 9 / 16), tiltScale(TILT_DEG, 16 / 9))
    assert.match(pictureEffects('tilt', { aspect: 16 / 9, dir: -1 })!.transform!, /^rotate\(-2\.5deg\) scale\(1\.0\d+\)$/)
  })

  it('pulses most at the bottom of the stroke, only while playing', () => {
    assert.deepEqual(pulseEffects(0, true, false), { transform: `scale(${(1 + PULSE_ZOOM).toFixed(4)})` })
    assert.deepEqual(pulseEffects(1, true, false), { transform: 'scale(1.0000)' })
    assert.equal(pulseEffects(0.3, false, false), null)
    assert.equal(pulseEffects(null, true, false), null)
    // Reduced motion: it holds still.
    assert.deepEqual(pulseEffects(0.3, true, true), { transform: PULSE_STILL })
    assert.ok(sameEffects(pulseEffects(0.5, true, false), pulseEffects(0.5, true, false)))
    assert.ok(!sameEffects(pulseEffects(0.5, true, false), null))
  })
})
