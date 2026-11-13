/**
 * The page, the panel and the badge. The theme's CSS variables for
 * everything but the rarity colours (--phg-tier, set per element), which are
 * the same in every theme: grey, blue, purple, gold is what players expect.
 */
export const CSS = `
.phg { color: var(--text); font-size: 13px; }
.phg * { box-sizing: border-box; }
.phg p { margin: 0; }
.phg button { font: inherit; }
.phg-muted { color: var(--text-muted); }
.phg-faint { color: var(--text-faint); font-size: 11.5px; }
.phg-btn { height: 30px; padding: 0 12px; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-strong); background: var(--bg-800); color: var(--text); font-weight: 500; cursor: pointer; white-space: nowrap; transition: background var(--dur-fast, 120ms), border-color var(--dur-fast, 120ms); }
.phg-btn:hover { background: var(--bg-700); }
.phg-btn:focus-visible, .phg-pull:focus-visible, .phg-tile:focus-visible, .phg-link:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); border-color: var(--accent); }
.phg-btn:disabled { opacity: .5; cursor: default; }
.phg-link { background: none; border: 0; padding: 0; color: var(--accent-light, var(--accent)); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; border-radius: 3px; }

/* ─── The pull button ─── */
.phg-pull { position: relative; height: 44px; min-width: 150px; padding: 0 26px; border-radius: 99px; border: 0; background: var(--accent); color: var(--accent-contrast); font-size: 15px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 55%, #000), 0 8px 20px color-mix(in srgb, var(--accent) 30%, transparent); transition: transform 90ms ease, box-shadow 90ms ease, background var(--dur-fast, 120ms); }
.phg-pull:hover { background: var(--accent-strong, var(--accent)); }
.phg-pull:active { transform: translateY(3px); box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 55%, #000), 0 4px 12px color-mix(in srgb, var(--accent) 25%, transparent); }
.phg-pull:disabled { cursor: default; opacity: .7; }
.phg-pull[data-due] { box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 55%, #000), 0 0 0 3px color-mix(in srgb, #fbbf24 70%, transparent), 0 0 26px #fbbf2499; }
.phg-kbd { display: inline-block; padding: 0 5px; border-radius: 4px; border: 1px solid var(--border-strong); background: var(--bg-850); font-size: 10.5px; font-family: var(--font-mono, ui-monospace, monospace); color: var(--text-muted); }

/* ─── The page ─── */
.phg-page { height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: 20px clamp(12px, 3vw, 32px) 32px; display: flex; flex-direction: column; gap: 26px; }
.phg-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; max-width: 980px; width: 100%; margin: 0 auto; }
.phg-left { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.phg-stage { position: relative; width: min(240px, 70vw); aspect-ratio: 200 / 280; cursor: default; user-select: none; }
.phg-stage[data-phase]:not([data-phase=done]) { cursor: pointer; }
.phg-machine-svg { display: block; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 10px 18px rgb(0 0 0 / .28)); }
.phg-m-rim { fill: none; stroke: var(--border-strong); stroke-width: 4; }
.phg-m-back { fill: color-mix(in srgb, var(--bg-900) 75%, transparent); }
.phg-m-cap, .phg-m-neck { fill: color-mix(in srgb, var(--accent) 70%, #000); }
.phg-m-body { fill: var(--accent); }
.phg-m-slot { fill: color-mix(in srgb, var(--accent) 45%, #000); }
.phg-m-dial { fill: color-mix(in srgb, var(--accent) 60%, #000); }
.phg-m-knob { fill: var(--accent); stroke: #f8fafc; stroke-width: 2; }
.phg-m-chute { fill: color-mix(in srgb, var(--bg-900) 92%, #000); stroke: color-mix(in srgb, var(--accent) 50%, #000); stroke-width: 3; }
.phg-crank { transform-box: view-box; transform-origin: 128px 200px; }
.phg-pile { transform-box: view-box; transform-origin: 100px 120px; }
.phg-stage[data-phase=crank] .phg-crank { animation: phg-crank .65s cubic-bezier(.5, 0, .3, 1); }
.phg-stage[data-phase=crank] .phg-pile { animation: phg-shake .65s ease-in-out; }
@keyframes phg-crank { to { transform: rotate(360deg); } }
@keyframes phg-shake { 15% { transform: translate(-3px, 1px) rotate(-3deg); } 35% { transform: translate(3px, -2px) rotate(3deg); } 55% { transform: translate(-2px, -1px) rotate(-2deg); } 75% { transform: translate(2px, 1px) rotate(1deg); } }

/* The capsule that comes out, and the light behind it. */
.phg-drop { position: absolute; left: 50%; top: 85.7%; width: 56px; height: 56px; margin: -28px 0 0 -28px; opacity: 0; pointer-events: none; z-index: 2; }
.phg-drop svg { display: block; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 4px 6px rgb(0 0 0 / .35)); }
.phg-cap-top, .phg-cap-bottom { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .45s cubic-bezier(.2, .8, .3, 1.2), opacity .45s ease; }
.phg-cap-bottom { transform-origin: 50% 0; }
.phg-stage[data-phase=drop] .phg-drop { animation: phg-drop .52s cubic-bezier(.3, 0, .5, 1) forwards; }
.phg-stage[data-phase=wobble] .phg-drop, .phg-stage[data-phase=open] .phg-drop { opacity: 1; }
.phg-stage[data-phase=wobble] .phg-drop svg { animation: phg-wobble .42s ease-in-out infinite; }
.phg-stage[data-phase=wobble][data-tier=epic] .phg-drop svg { filter: drop-shadow(0 0 10px var(--phg-tier)); }
.phg-stage[data-phase=wobble][data-tier=legendary] .phg-drop svg { animation-duration: .3s; filter: drop-shadow(0 0 14px var(--phg-tier)); }
.phg-stage[data-phase=open] .phg-cap-top, .phg-stage[data-phase=done] .phg-cap-top { transform: translate(-10px, -26px) rotate(-38deg); opacity: 0; }
.phg-stage[data-phase=open] .phg-cap-bottom, .phg-stage[data-phase=done] .phg-cap-bottom { transform: translate(6px, 14px) rotate(14deg); opacity: 0; }
.phg-stage[data-phase=done] .phg-drop { transition: opacity .6s ease .4s; opacity: 0; }
@keyframes phg-drop { 0% { opacity: 0; transform: translateY(-34px) scale(.55); } 25% { opacity: 1; } 70% { transform: translateY(6px) scale(1.04, .94); } 85% { transform: translateY(-5px) scale(.98, 1.02); } 100% { opacity: 1; transform: none; } }
@keyframes phg-wobble { 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
.phg-burst { position: absolute; left: 50%; top: 85.7%; width: 300px; height: 300px; margin: -150px 0 0 -150px; border-radius: 50%; pointer-events: none; opacity: 0; z-index: 1;
  background: radial-gradient(circle, color-mix(in srgb, var(--phg-tier) 85%, #fff) 0 9%, transparent 10%), repeating-conic-gradient(color-mix(in srgb, var(--phg-tier) 70%, transparent) 0 7deg, transparent 7deg 22deg);
  -webkit-mask: radial-gradient(circle, #000 0 22%, transparent 68%); mask: radial-gradient(circle, #000 0 22%, transparent 68%); }
.phg-stage[data-phase=open] .phg-burst, .phg-stage[data-phase=done] .phg-burst { animation: phg-burst 1.6s ease-out forwards; }
.phg-stage[data-tier=legendary][data-phase=open] .phg-burst, .phg-stage[data-tier=legendary][data-phase=done] .phg-burst { animation-name: phg-burst-big; animation-duration: 2.4s; }
@keyframes phg-burst { 0% { opacity: 0; transform: scale(.2) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: scale(1.15) rotate(70deg); } }
@keyframes phg-burst-big { 0% { opacity: 0; transform: scale(.2) rotate(0); } 15% { opacity: 1; } 60% { opacity: .9; } 100% { opacity: 0; transform: scale(1.5) rotate(140deg); } }
.phg-skip { position: absolute; left: 0; right: 0; bottom: -18px; text-align: center; font-size: 10.5px; color: var(--text-faint); opacity: 0; transition: opacity .3s; }
.phg-stage[data-phase]:not([data-phase=done]) .phg-skip { opacity: 1; }

.phg-pity { width: min(260px, 80vw); display: flex; flex-direction: column; gap: 5px; }
.phg-pity-line { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--text-muted); }
.phg-pity-line b { color: var(--text); font-weight: 650; font-variant-numeric: tabular-nums; }
.phg-pity-bar { height: 5px; border-radius: 99px; background: var(--bg-700); overflow: hidden; }
.phg-pity-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #c084fc, #fbbf24); transition: width .4s ease; }
.phg-pity[data-due] .phg-pity-line b { color: #fbbf24; }
.phg-odds { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; font-size: 11px; color: var(--text-faint); }
.phg-odds span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; background: var(--phg-tier); vertical-align: 0; }

/* ─── The result card ─── */
.phg-right { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.phg-card { position: relative; display: flex; flex-direction: column; border-radius: var(--radius-lg, 14px); background: var(--bg-850); border: 2px solid var(--phg-tier); overflow: hidden; box-shadow: 0 0 0 1px rgb(0 0 0 / .2), 0 10px 30px color-mix(in srgb, var(--phg-tier) 22%, transparent); }
.phg-card[data-tier=legendary] { box-shadow: 0 0 0 1px rgb(0 0 0 / .2), 0 0 34px color-mix(in srgb, var(--phg-tier) 45%, transparent); }
.phg-card.phg-reveal { animation: phg-reveal .55s cubic-bezier(.2, .9, .3, 1.25); }
@keyframes phg-reveal { 0% { opacity: 0; transform: perspective(700px) rotateY(80deg) scale(.85); } 100% { opacity: 1; transform: none; } }
.phg-card[data-tier=legendary]::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / .28) 45%, transparent 60%); background-size: 250% 100%; animation: phg-shine 3.2s ease-in-out infinite; }
@keyframes phg-shine { 0% { background-position: 130% 0; } 60%, 100% { background-position: -40% 0; } }
.phg-thumb { position: relative; aspect-ratio: 16 / 9; background: var(--bg-900); overflow: hidden; }
.phg-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .3s; }
.phg-thumb img[data-ok] { opacity: 1; }
.phg-thumb-ph { position: absolute; inset: 0; display: grid; place-items: center; opacity: .5; }
.phg-ribbon { position: absolute; top: 8px; left: 8px; display: flex; gap: 5px; }
.phg-chip { padding: 1px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; background: rgb(0 0 0 / .6); color: #fff; }
.phg-chip[data-k=new] { background: #f43f5e; }
.phg-chip[data-k=pity] { background: #fbbf24; color: #1c1300; }
.phg-card-body { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 12px; }
.phg-tier { display: flex; align-items: baseline; gap: 8px; color: var(--phg-tier); font-weight: 750; letter-spacing: .03em; text-transform: uppercase; font-size: 12px; }
.phg-stars { letter-spacing: 1px; font-size: 14px; }
.phg-title { font-size: 15px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
.phg-why { font-size: 11.5px; color: var(--text-muted); }
.phg-mod { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius-md, 10px); background: color-mix(in srgb, var(--phg-tier) 12%, var(--bg-800)); border: 1px solid color-mix(in srgb, var(--phg-tier) 35%, transparent); }
.phg-mod[data-none] { background: var(--bg-800); border-color: var(--border); color: var(--text-muted); }
.phg-mod-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; line-height: 1.3; }
.phg-mod-text b { font-weight: 650; }
.phg-mod-text span { font-size: 11.5px; color: var(--text-muted); }
.phg-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.phg-going { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-muted); }
.phg-going-bar { flex: 1; height: 3px; border-radius: 99px; background: var(--bg-700); overflow: hidden; }
.phg-going-bar span { display: block; height: 100%; width: 100%; background: var(--accent); transform-origin: left; animation: phg-going var(--phg-going, 2s) linear forwards; }
@keyframes phg-going { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.phg-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 200px; padding: 20px; border-radius: var(--radius-lg, 14px); border: 2px dashed var(--border-strong); color: var(--text-muted); text-align: center; }
.phg-empty b { color: var(--text); font-size: 14px; }
.phg-live { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius-md, 10px); border: 1px solid color-mix(in srgb, var(--phg-tier) 50%, transparent); background: var(--bg-850); }
.phg-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--phg-tier); flex: none; animation: phg-pulse 1.6s ease-in-out infinite; }
@keyframes phg-pulse { 50% { opacity: .35; } }

/* ─── The collection ─── */
.phg-coll { max-width: 980px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.phg-coll-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.phg-coll-head h2 { margin: 0; font-size: 16px; font-weight: 700; }
.phg-tally { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.phg-tally span { padding: 1px 8px; border-radius: 99px; font-size: 11px; font-weight: 650; color: var(--phg-tier); background: color-mix(in srgb, var(--phg-tier) 14%, transparent); font-variant-numeric: tabular-nums; }
.phg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.phg-tile { display: flex; flex-direction: column; padding: 0; text-align: left; border-radius: var(--radius-md, 10px); border: 2px solid color-mix(in srgb, var(--phg-tier) 70%, transparent); background: var(--bg-850); color: var(--text); overflow: hidden; cursor: pointer; transition: transform var(--dur-fast, 120ms) ease, box-shadow var(--dur-fast, 120ms) ease; }
.phg-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--phg-tier) 25%, transparent); }
.phg-tile .phg-thumb { aspect-ratio: 16 / 9; }
.phg-tile-body { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px 7px; min-width: 0; }
.phg-tile-title { font-size: 12px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.phg-tile-meta { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; color: var(--phg-tier); }
.phg-tile-meta span:last-child { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.phg-foot { display: flex; justify-content: flex-end; }

/* The compact machine (the panel's): the same drawing, the capsule and its light scaled to it. */
.phg-stage.phg-compact { width: 116px; flex: none; }
.phg-compact .phg-drop { width: 34px; height: 34px; margin: -17px 0 0 -17px; }
.phg-compact .phg-burst { width: 190px; height: 190px; margin: -95px 0 0 -95px; }
.phg-compact .phg-skip { bottom: -15px; font-size: 10px; }
.phg-compact .phg-machine-svg { filter: drop-shadow(0 6px 10px rgb(0 0 0 / .25)); }

/* ─── The last pulls ─── */
.phg-recent { max-width: 980px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.phg-recent[hidden] { display: none; }
.phg-timeline { display: flex; gap: 10px; overflow-x: auto; padding: 6px 4px 8px; scrollbar-width: thin; }
.phg-tl-item { flex: none; width: 120px; padding: 0; border-radius: 8px; border: 2px solid var(--phg-tier); background: var(--bg-900); overflow: hidden; cursor: pointer; box-shadow: 0 0 10px color-mix(in srgb, var(--phg-tier) 35%, transparent); transition: transform var(--dur-fast, 120ms) ease, box-shadow var(--dur-fast, 120ms) ease; }
.phg-tl-item:hover { transform: translateY(-2px); box-shadow: 0 0 16px color-mix(in srgb, var(--phg-tier) 60%, transparent); }
.phg-tl-item:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
.phg-tl-item[data-tier=legendary] { box-shadow: 0 0 14px color-mix(in srgb, var(--phg-tier) 65%, transparent); }
.phg-tl-item:first-child { width: 140px; }
.phg-tl-tag { position: absolute; right: 4px; bottom: 4px; padding: 0 5px; border-radius: 99px; font-size: 9.5px; font-weight: 700; line-height: 15px; color: #fff; background: color-mix(in srgb, var(--phg-tier) 55%, rgb(0 0 0 / .75)); }
.phg-panel .phg-timeline { gap: 7px; padding: 4px 2px 6px; }
.phg-panel .phg-tl-item, .phg-panel .phg-tl-item:first-child { width: 64px; border-radius: 6px; }
.phg-panel .phg-tl-tag { right: 2px; bottom: 2px; font-size: 8.5px; line-height: 13px; padding: 0 4px; }

/* ─── The panel ─── */
.phg-panel { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 12px; }
.phg-panel-top { display: flex; align-items: center; gap: 14px; padding-bottom: 6px; }
.phg-panel-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.phg-panel-side .phg-pity { width: auto; }
.phg-panel-body { display: flex; flex-direction: column; gap: 10px; }
.phg-panel .phg-pull { align-self: stretch; min-width: 0; height: 38px; padding: 0 12px; font-size: 13.5px; }
.phg-sub { margin-bottom: -6px; color: var(--text-faint); font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.phg-mini { display: flex; gap: 9px; align-items: center; padding: 7px; border-radius: var(--radius-md, 10px); background: var(--bg-850); border: 1px solid color-mix(in srgb, var(--phg-tier) 55%, transparent); }
.phg-mini.phg-reveal { animation: phg-pop .4s cubic-bezier(.2, .9, .3, 1.4); }
@keyframes phg-pop { 0% { transform: scale(.9); opacity: .3; } 100% { transform: none; opacity: 1; } }
.phg-mini .phg-thumb { width: 72px; flex: none; border-radius: 6px; }
.phg-mini-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.phg-mini-text .phg-tier { font-size: 10.5px; }
.phg-mini-title { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.phg-mini-mod { font-size: 11px; color: var(--text-muted); }

/* ─── The badge over the video ─── */
.phg-badge { position: absolute; left: 50%; top: calc(var(--ph-controls-top, 0px) + 14px); transform: translate(-50%, -8px); display: flex; align-items: center; gap: 7px; max-width: calc(100% - 24px); padding: 5px 12px 5px 9px; border-radius: 99px; background: rgb(10 10 14 / .72); border: 1px solid color-mix(in srgb, var(--phg-tier) 70%, transparent); color: #fff; font-size: 12.5px; font-weight: 600; pointer-events: none; opacity: 0; transition: opacity .3s ease, transform .3s ease, top .2s ease; backdrop-filter: blur(6px); white-space: nowrap; }
.phg-badge.phg-on { opacity: 1; transform: translate(-50%, 0); }
.phg-badge i { width: 8px; height: 8px; border-radius: 50%; background: var(--phg-tier); flex: none; font-style: normal; }
.phg-badge span { overflow: hidden; text-overflow: ellipsis; }
.phg-badge b { font-variant-numeric: tabular-nums; color: var(--phg-tier); }

@media (prefers-reduced-motion: reduce) {
  .phg-card.phg-reveal, .phg-mini.phg-reveal, .phg-card[data-tier=legendary]::after, .phg-live-dot { animation: none; }
  .phg-tile, .phg-badge, .phg-tl-item { transition: none; }
}
`
