import type { Tier } from '../rarity'
import { TIER_INFO, TIERS } from '../rarity'

/**
 * The machine and the capsules, as SVG markup. Built from our own constants
 * only; nothing from the library goes in here (titles go in as text).
 */

/** A capsule: the tier's colour on top, white below, split along the seam so the halves can fly apart. */
export function capsule(colour: string, size = 64): string {
  return `<svg class="phg-cap-svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
  <g class="phg-cap-top"><path d="M6 31 A26 26 0 0 1 58 31 Z" fill="${colour}" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M15 24 C17 17 22 12.5 29 11" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".55"/></g>
  <g class="phg-cap-bottom"><path d="M6 33 A26 26 0 0 0 58 33 Z" fill="#f8fafc" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M14 41 C16 46 20 50 25 52" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" opacity=".12"/></g>
</svg>`
}

/** Capsules piled in the globe: [x, y, rotation, tier]. Fixed, so the machine looks the same every time. */
const PILE: [number, number, number, Tier][] = [
  [72, 140, -20, 'common'], [95, 143, 15, 'rare'], [118, 141, -35, 'common'], [140, 133, 25, 'epic'],
  [54, 124, 40, 'rare'], [77, 121, -50, 'legendary'], [100, 123, 10, 'common'], [123, 120, -25, 'rare'], [146, 113, 35, 'common'],
  [64, 103, 5, 'epic'], [88, 101, 30, 'rare'], [111, 102, -15, 'common'], [134, 97, 50, 'rare'],
]

function pileCapsule([x, y, r, tier]: [number, number, number, Tier]): string {
  const c = TIER_INFO[tier].colour
  return `<g transform="translate(${x} ${y}) rotate(${r})"><circle r="11" fill="#f8fafc" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><path d="M-11 -0.5 A11 11 0 0 1 11 -0.5 Z" fill="${c}"/><path d="M-6 -5 C-5 -7.5 -3 -8.6 -0.5 -9" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".6"/></g>`
}

/**
 * The machine: a glass globe of capsules on a body in the theme's accent,
 * with a crank and a chute. The crank and the pile have classes the pull
 * animation moves.
 */
export function machine(): string {
  return `<svg class="phg-machine-svg" viewBox="0 0 200 280" aria-hidden="true">
  <defs>
    <radialGradient id="phg-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></radialGradient>
    <clipPath id="phg-globe-clip"><circle cx="100" cy="90" r="70"/></clipPath>
  </defs>
  <rect x="62" y="16" width="76" height="10" rx="5" class="phg-m-cap"/>
  <circle cx="100" cy="90" r="72" class="phg-m-rim"/>
  <circle cx="100" cy="90" r="70" class="phg-m-back"/>
  <g clip-path="url(#phg-globe-clip)"><g class="phg-pile">${PILE.map(pileCapsule).join('')}</g></g>
  <circle cx="100" cy="90" r="70" fill="url(#phg-glass)"/>
  <path d="M52 62 C60 44 76 33 96 30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".35"/>
  <path d="M146 112 C142 122 136 130 128 136" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".2"/>
  <path d="M58 150 H142 L150 166 H50 Z" class="phg-m-neck"/>
  <rect x="34" y="164" width="132" height="106" rx="16" class="phg-m-body"/>
  <path d="M44 176 C44 171 48 168 53 168 H70" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".3"/>
  <rect x="52" y="180" width="38" height="10" rx="5" class="phg-m-slot"/>
  <circle cx="128" cy="200" r="21" class="phg-m-dial"/>
  <g class="phg-crank"><rect x="108" y="195" width="40" height="10" rx="5" fill="#f8fafc"/><circle cx="128" cy="200" r="6" fill="#f8fafc"/><circle cx="145" cy="200" r="5" class="phg-m-knob"/></g>
  <rect x="58" y="222" width="84" height="36" rx="10" class="phg-m-chute"/>
  <rect x="64" y="228" width="72" height="8" rx="4" fill="#000" opacity=".25"/>
  ${TIERS.map((t, i) => `<circle cx="${60 + i * 8}" cy="${207}" r="2.4" fill="${TIER_INFO[t].colour}"/>`).join('')}
</svg>`
}

/** Stars for a tier, filled and empty: ★★☆☆. */
export const stars = (tier: Tier) => '★'.repeat(TIER_INFO[tier].stars) + '☆'.repeat(4 - TIER_INFO[tier].stars)
