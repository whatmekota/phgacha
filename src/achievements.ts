import type { MachineState } from './collection'
import type { ModifierKind } from './modifiers'
import type { PluginAchievement, PluginContext } from './types'
import { MODIFIER_KINDS, modifierDef } from './modifiers'

/**
 * The machine's own achievements (plugin API 7), in Stats → Achievements
 * under its name. Every one is worked out from the saved state (the pulls,
 * the collection and a few counts), so they're synced at start and after
 * each change: a history from before 0.4.0 counts too.
 */
export const ACHIEVEMENTS: PluginAchievement[] = [
  { id: 'first-pull', title: 'First crank', description: 'Pull from the gacha machine for the first time', icon: '🎰', tier: 1 },
  { id: 'pulls-10', title: 'Regular', description: 'Pull 10 times', icon: '🪙', target: 10, tier: 1 },
  { id: 'pulls-100', title: 'High roller', description: 'Pull 100 times', icon: '💰', target: 100, tier: 2 },
  { id: 'pulls-500', title: 'Whale', description: 'Pull 500 times', icon: '🐋', target: 500, tier: 3 },
  { id: 'first-rare', title: 'Something blue', description: 'Pull a Rare', icon: '💠', tier: 1 },
  { id: 'first-epic', title: 'Purple patch', description: 'Pull an Epic', icon: '🔮', tier: 1 },
  { id: 'first-legendary', title: 'Struck gold', description: 'Pull a Legendary', icon: '🌟', tier: 2 },
  { id: 'legendary-5', title: 'Midas touch', description: 'Pull 5 Legendaries', icon: '👑', target: 5, tier: 3 },
  { id: 'legendary-25', title: 'Living legend', description: 'Pull 25 Legendaries', icon: '🏆', target: 25, tier: 4 },
  { id: 'collect-25', title: 'Collector', description: 'Have 25 different videos in the collection', icon: '📦', target: 25, tier: 1 },
  { id: 'collect-100', title: 'Curator', description: 'Have 100 different videos in the collection', icon: '🗂️', target: 100, tier: 2 },
  { id: 'collect-250', title: 'Museum piece', description: 'Have 250 different videos in the collection', icon: '🏛️', target: 250, tier: 3 },
  { id: 'turbo-survivor', title: 'Survived Turbo', description: 'Watch a Turbo ×1.5 pull to the end', icon: '🏎️', tier: 2 },
  { id: 'every-twist', title: 'Seen every twist', description: 'Watch a pull to the end under each kind of modifier: stroke, speed, finale, breaks and picture', icon: '🎭', target: MODIFIER_KINDS.length, tier: 3 },
  { id: 'banner-pull', title: 'On the banner', description: 'Pull a video with the day\'s banner tag', icon: '🎏', tier: 1 },
  { id: 'lucky-ten', title: 'Lucky ten', description: 'Get two or more Epic-or-better in one ×10 pull', icon: '🍀', tier: 2 },
  { id: 'pity-gold', title: 'Worth the wait', description: 'Get a Legendary from the pity', icon: '⏳', tier: 2 },
  { id: 'lied-low', title: 'It lied low', description: 'See a Legendary\'s capsule come out blue or purple and flash gold', icon: '🥷', tier: 2, hidden: true },
  { id: 'back-to-back', title: 'Lightning twice', description: 'Pull a Legendary straight after a Legendary', icon: '⚡', tier: 3, hidden: true },
  { id: 'all-commons', title: 'Ten of nothing', description: 'Get nothing but Commons in a ×10 pull', icon: '🪨', tier: 2, hidden: true },
]

const targetOf = new Map(ACHIEVEMENTS.filter(a => a.target).map(a => [a.id, a.target!]))

/** The kinds of modifier watched to the end so far. */
export const kindsEndured = (s: MachineState): ModifierKind[] =>
  MODIFIER_KINDS.filter(k => s.endured.some(id => modifierDef(id).kind === k))

/**
 * Where every achievement stands, from the state alone: the count for each
 * counted one (at most its target), and the ids of the others that are earned.
 */
export function standing(s: MachineState): { progress: Record<string, number>, earned: string[] } {
  const collected = Object.keys(s.collection).length
  const counts: Record<string, number> = {
    'pulls-10': s.pulls,
    'pulls-100': s.pulls,
    'pulls-500': s.pulls,
    'legendary-5': s.legendaries,
    'legendary-25': s.legendaries,
    'collect-25': collected,
    'collect-100': collected,
    'collect-250': collected,
    'every-twist': kindsEndured(s).length,
  }
  const progress: Record<string, number> = {}
  for (const [id, n] of Object.entries(counts))
    progress[id] = Math.min(n, targetOf.get(id) ?? n)
  const done: Record<string, boolean> = {
    'first-pull': s.pulls > 0,
    'first-rare': s.tiers.rare > 0,
    'first-epic': s.tiers.epic > 0,
    'first-legendary': s.legendaries > 0 || s.tiers.legendary > 0,
    'turbo-survivor': s.endured.includes('turbo'),
    'banner-pull': s.feats.banner > 0,
    'lucky-ten': s.feats.luckyTen > 0,
    'pity-gold': s.feats.pityLegendary > 0,
    'lied-low': s.feats.liedLow > 0,
    'back-to-back': s.feats.backToBack > 0,
    'all-commons': s.feats.dullTen > 0,
  }
  return { progress, earned: Object.keys(done).filter(id => done[id]) }
}

/**
 * The achievements, as far as this playhound has them: they're declared at
 * once, and sync() hands over only what changed since it last did. Without
 * ctx.achievements (a playhound before API 7) it does nothing.
 */
export function createTrophies(api: Partial<PluginContext['achievements']> | undefined, log: (...args: unknown[]) => void = () => {}) {
  if (!api || typeof api.define !== 'function' || typeof api.unlock !== 'function' || typeof api.progress !== 'function')
    return { available: false, sync: (_s: MachineState) => {} }
  const a = api as PluginContext['achievements']
  try {
    a.define(ACHIEVEMENTS)
  }
  catch (err) {
    log('declaring the achievements failed', err)
  }
  const sent = new Map<string, number>()
  return {
    available: true,
    sync(s: MachineState) {
      const now = standing(s)
      try {
        for (const [id, n] of Object.entries(now.progress)) {
          if (sent.get(id) !== n) {
            sent.set(id, n)
            a.progress(id, n)
          }
        }
        for (const id of now.earned) {
          if (!sent.has(id)) {
            sent.set(id, 1)
            a.unlock(id)
          }
        }
      }
      catch (err) {
        log('updating the achievements failed', err)
      }
    },
  }
}
