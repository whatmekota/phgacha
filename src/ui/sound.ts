import type { Tier } from '../rarity'

/**
 * Stingers for the reveal, made with Web Audio: no sound files. A soft blip
 * for a Common, a chime for a Rare, a rising arpeggio for an Epic, and a
 * fanfare chord with a shimmer on top for a Legendary. Plus a short rising
 * "tick" when a capsule's glow steps up.
 */

type Wave = OscillatorType

/** C major, from G4: the notes the stingers use. */
const N = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568 }

export function createSound(settings: () => { on: boolean, volume: number }) {
  let ac: AudioContext | null = null

  /** The context and a master gain at the user's volume; null when sounds are off or Web Audio isn't there. */
  function out(): { ac: AudioContext, master: GainNode } | null {
    const s = settings()
    if (!s.on || s.volume <= 0 || typeof AudioContext === 'undefined')
      return null
    try {
      ac ??= new AudioContext()
      if (ac.state === 'suspended')
        void ac.resume()
      const master = ac.createGain()
      // 0.5 at full volume: these are on top of a video's own sound.
      master.gain.value = 0.5 * s.volume
      master.connect(ac.destination)
      // Let it go once everything scheduled on it has played.
      setTimeout(() => master.disconnect(), 4000)
      return { ac, master }
    }
    catch {
      return null
    }
  }

  /** One note: a quick attack and an exponential fall, like a struck bell. */
  function note(o: { ac: AudioContext, master: GainNode }, freq: number, at: number, dur: number, opts: { wave?: Wave, gain?: number, filter?: number } = {}) {
    const t = o.ac.currentTime + at
    const osc = o.ac.createOscillator()
    osc.type = opts.wave ?? 'sine'
    osc.frequency.value = freq
    const g = o.ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let node: AudioNode = osc
    if (opts.filter) {
      const f = o.ac.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = opts.filter
      osc.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(o.master)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  return {
    stinger(tier: Tier) {
      const o = out()
      if (!o)
        return
      switch (tier) {
        case 'common':
          note(o, N.E5, 0, 0.16, { gain: 0.18 })
          break
        case 'rare':
          note(o, N.E6, 0, 0.9, { gain: 0.16 })
          note(o, N.G5, 0.07, 0.8, { gain: 0.14, wave: 'triangle' })
          break
        case 'epic':
          for (const [i, f] of [N.C5, N.E5, N.G5, N.C6].entries())
            note(o, f, i * 0.085, i === 3 ? 0.9 : 0.35, { wave: 'triangle', gain: 0.22 })
          note(o, N.E6, 0.34, 0.8, { gain: 0.08 })
          break
        case 'legendary': {
          // A quick run up, then the chord, held, with sparkles above it.
          for (const [i, f] of [N.G4, N.C5, N.E5, N.G5].entries())
            note(o, f, i * 0.07, 0.3, { wave: 'triangle', gain: 0.2 })
          for (const f of [N.C5, N.E5, N.G5, N.C6])
            note(o, f, 0.3, 1.6, { wave: 'sawtooth', gain: 0.07, filter: 2400 })
          note(o, N.C5 / 2, 0.3, 1.6, { wave: 'triangle', gain: 0.18 })
          for (let i = 0; i < 9; i++)
            note(o, [N.C6, N.E6, N.G6][i % 3] * (i > 5 ? 2 : 1), 0.45 + i * 0.09, 0.4, { gain: 0.05 })
          break
        }
      }
    },
    /** The glow stepping up a tier: a short rising blip. */
    upgrade() {
      const o = out()
      if (!o)
        return
      note(o, N.G5, 0, 0.12, { wave: 'triangle', gain: 0.14 })
      note(o, N.C6, 0.06, 0.2, { wave: 'triangle', gain: 0.14 })
    },
    dispose() {
      void ac?.close().catch(() => {})
      ac = null
    },
  }
}

export type Sound = ReturnType<typeof createSound>
