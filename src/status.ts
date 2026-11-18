import type { MachineState } from './collection'
import type { Active } from './runner'
import type { PluginStatus } from './types'
import { modifierDef } from './modifiers'
import { pityDue } from './pick'
import { TIER_INFO } from './rarity'

const pulls = (n: number) => `${n} ${n === 1 ? 'pull' : 'pulls'}`

/** "Last Legendary 12 pulls ago", "Legendary on the last pull", "No Legendary yet". */
export function legendaryLine(s: MachineState): string {
  if (!s.legendaries)
    return 'No Legendary yet'
  return s.sinceLegendary ? `Last Legendary ${pulls(s.sinceLegendary)} ago` : 'Legendary on the last pull'
}

/**
 * What the rail button says (ui.status): the modifier while one is on
 * (busy), otherwise the pity count and the last Legendary (neutral).
 * `queued`: videos still waiting from a ×10.
 */
export function statusOf(s: MachineState, active: Active | null, pityAt: number, queued = 0): PluginStatus {
  const more = queued ? ` · ${queued} more from your ×10` : ''
  if (active) {
    const m = modifierDef(active.id)
    return {
      text: active.breakUntil !== null ? `${m.name}: a break` : m.name,
      tone: 'busy',
      detail: `${TIER_INFO[active.tier].name} pull: ${m.hint.toLowerCase()}, until the video ends${more}`,
    }
  }
  if (!s.pulls)
    return { text: 'No pulls yet', tone: 'neutral' }
  return {
    text: pityDue(s.pity, pityAt) ? 'Epic or better next' : `Pity ${s.pity}/${pityAt}`,
    tone: 'neutral',
    detail: `${legendaryLine(s)}${more}`,
  }
}
