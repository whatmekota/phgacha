import type { PlayerSnapshot, PluginContext, ScriptSnapshot } from '../src/types.ts'
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { createRunner } from '../src/runner.ts'

/** Just enough of the plugin API for the runner, with the player as plain state. */
function fakeCtx() {
  const state: PlayerSnapshot = { playing: true, title: 'a.mp4', time: 0, duration: 600, hasScript: true, rate: 1, width: 0, height: 0 }
  const on = { change: new Set<(s: PlayerSnapshot) => void>(), ended: new Set<(id: string | null) => void>(), panic: new Set<() => void>(), scripts: new Set<(s: ScriptSnapshot) => void>() }
  const sub = <T>(set: Set<T>) => (fn: T) => {
    set.add(fn)
    return () => set.delete(fn)
  }
  const f = {
    state,
    filters: 0,
    panicked: false,
    clock: 0,
    calls: [] as string[],
    script: { video: 'a.mp4', axes: [] } as ScriptSnapshot,
    emit: () => on.change.forEach(fn => fn({ ...state })),
    end: () => on.ended.forEach(fn => fn(state.title)),
    panic: () => {
      f.panicked = true
      on.panic.forEach(fn => fn())
    },
  }
  const ctx = {
    player: {
      state: () => ({ ...state }),
      onChange: sub(on.change),
      clock: () => f.clock,
      setRate: (r: number) => {
        state.rate = r
        f.emit()
      },
      seek: (t: number) => {
        f.calls.push(`seek ${t}`)
        return true
      },
    },
    playback: {
      onEnded: sub(on.ended),
      pause: () => {
        state.playing = false
        f.calls.push('pause')
      },
      resume: () => {
        state.playing = true
        f.calls.push('resume')
      },
    },
    motion: {
      filter: () => {
        f.filters++
        return () => f.filters--
      },
    },
    scripts: { current: () => f.script, onChange: sub(on.scripts) },
    safety: { panicked: () => f.panicked, onPanic: sub(on.panic) },
  } as unknown as PluginContext
  return { f, ctx }
}

const opts = { finaleS: () => 90, breakEvery: () => 2, breakS: () => 3, changed: () => {} }

describe('runner', () => {
  it('puts the speed back when the video changes', () => {
    const { f, ctx } = fakeCtx()
    const r = createRunner(ctx, opts)
    r.start('turbo', 'epic', 'a.mp4')
    assert.equal(f.state.rate, 1.5)
    f.state.title = 'b.mp4'
    f.emit()
    assert.equal(r.active(), null)
    assert.equal(f.state.rate, 1)
  })

  it('takes the filter off on panic, and when the video ends', () => {
    const { f, ctx } = fakeCtx()
    const r = createRunner(ctx, opts)
    r.start('invert', 'rare', 'a.mp4')
    assert.equal(f.filters, 1)
    f.panic()
    assert.equal(f.filters, 0)
    f.panicked = false
    r.start('half', 'rare', 'a.mp4')
    f.end()
    assert.equal(f.filters, 0)
    r.start('top', 'rare', 'a.mp4')
    r.dispose()
    assert.equal(f.filters, 0)
  })

  it('leaves a speed the user set themselves', () => {
    const { f, ctx } = fakeCtx()
    const r = createRunner(ctx, opts)
    r.start('slow', 'rare', 'a.mp4')
    ctx.player.setRate(2)
    r.end('user')
    assert.equal(f.state.rate, 2)
  })

  it('jumps to the finale', () => {
    const { f, ctx } = fakeCtx()
    createRunner(ctx, opts).start('finale', 'rare', 'a.mp4')
    assert.deepEqual(f.calls, ['seek 510'])
  })

  it('takes a break every few strokes, and never resumes after a panic', () => {
    mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] })
    try {
      const { f, ctx } = fakeCtx()
      // Bottoms at 0.25 s, 0.75 s, 1.25 s, 1.75 s: a break (every 2) at 0.75 s and 1.75 s.
      f.script = { video: 'a.mp4', axes: [{ axis: 'L0', label: 'Stroke', name: 'a', offsetMs: 0, actions: Array.from({ length: 9 }, (_, i) => ({ at: i * 250, pos: i % 2 ? 0 : 100 })) }] }
      const r = createRunner(ctx, opts)
      r.start('breaks', 'rare', 'a.mp4')
      f.clock = 0.8
      mock.timers.tick(100)
      assert.deepEqual(f.calls, ['pause'])
      assert.ok(r.active()!.breakUntil)
      mock.timers.tick(3000)
      assert.deepEqual(f.calls, ['pause', 'resume'])
      f.clock = 1.8
      mock.timers.tick(100)
      assert.deepEqual(f.calls, ['pause', 'resume', 'pause'])
      f.panic()
      mock.timers.tick(5000)
      assert.deepEqual(f.calls, ['pause', 'resume', 'pause'])
      assert.equal(f.state.playing, false)
    }
    finally {
      mock.timers.reset()
    }
  })
})
