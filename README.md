# phgacha

**18+ only.** A gacha machine for your [playhound](https://github.com/whatmekota/playhound) library. Turn the crank, a capsule drops, and out comes the next video: the rarer the better, sometimes with a twist on top. Every pull goes into your collection.

Needs playhound **2.2** or newer (plugin API 3).

## Install

Not published: load it from this folder. In playhound, **Settings → Plugins → Load from folder…** and pick this folder (after `npm run build`). It runs `dist/index.js` and reloads when you build again. Or drop `phgacha.zip` on that page to install it.

It asks for six permissions:

- **Read your library**: the videos to pull from, their stats (plays, finishes, stars, intensity) and thumbnails.
- **Play, pause, seek and change the speed**: to play the pull, and for the speed, finale and break modifiers.
- **See what is playing, where**: to know when the pulled video changes or ends, so its modifier ends with it.
- **Read the loaded scripts**: to count strokes for the break modifier.
- **Move your device, and reshape scripts**: only for the stroke modifiers (inverted, half range, top half), and only while one is on.
- **Show its own page and draw over the video**: the machine's page, and a small label over the video naming the modifier.

## Pulling

- **Gacha** in the left nav opens the machine. Press **Pull**: the crank turns, a capsule in the rarity's colour drops and opens, and the card shows what you got. The video starts, and a moment later you're on the player (a setting; **Stay here** cancels it). Click the machine to skip the animation.
- **Shift+P** anywhere pulls at once with a toast instead of the animation (or Alt+P, or Alt+Shift+P, whichever is free; the page says which). Also **Pull from the gacha** in the command palette (Ctrl K).
- The **Gacha** panel on the right rail has a smaller machine with the same animation, the pity meter, the last pull, the modifier that is on and the last 5 pulls. A pull there plays at once and keeps you where you are.

## Rarity

Each video's rarity comes from what playhound knows about it. Points:

| | |
| --- | --- |
| Intensity | gentle 0, medium 1, intense 2 (0 until its script is analysed; the machine asks for that in the background) |
| Left alone | never played 2; not played for 60 days, or only once or twice, 1 |
| Never finished | 1 |
| Starred | 1 |

0–1 points is **Common**, 2–3 **Rare**, 4 **Epic**, 5–6 **Legendary**. A pull rolls the tier first (Common 55%, Rare 30%, Epic 12%, Legendary 3%), then a video of that tier. If the library has none of that tier, the nearest tier that has some stands in.

**The reveal** gets grander the rarer the pull. The capsule glows its tier on the way out, sometimes starting lower and flashing up a tier (never higher than it is: gold always means Legendary), and an Epic or Legendary cranks, drops and wobbles longer. A Legendary then dims the page, bursts gold light, showers confetti, shakes and holds a big LEGENDARY title; an Epic gets a smaller purple version. Each tier has its own short sound (a blip, a chime, an arpeggio, a fanfare). Legendary cards have a turning gold foil edge, and your first Legendary gets a toast. Under the pity meter, the page and the panel say how many pulls ago the last Legendary was.

**Pity**: after 10 pulls in a row without an Epic or better (a setting), the next one is guaranteed to be.

## Modifiers

Each pull may roll one. The chance is set for a Rare (40% by default); a Common gets about half of it, an Epic or Legendary more, never above 90%. "No modifier" stays the usual outcome.

- **Upside down**, **Half range**, **Top half only**: the stroke reshaped on its way to the device. Only rolled with a device connected and a script.
- **Slow motion ×0.75**, **Fast ×1.25**, **Turbo ×1.5**: the speed, on top of yours.
- **Finale only**: straight to the last 90 s (a setting). Only for videos well over twice that long.
- **Breaks**: a pause of 4 s every 20 strokes (both settings), counted from the stroke script.

A modifier ends when the video changes or ends, on panic, with **End it** (the page and the panel), or **End the gacha modifier** in the command palette. Ending takes the stroke filter off and puts your speed back, unless you changed the speed yourself meanwhile; then yours stands. A break is never resumed after a panic.

## Last pulls and the collection

**Last pulls** on the page is a strip of the last 10 pulls, newest first: the thumbnail edged in its rarity's colour, the modifier as a tag, and when in the tooltip. Click one to play it again, without a modifier.

The **collection** lists every video you've pulled, rarest first, with how often. A card's colour is the rarest it has come up as. Click one to play it as it is, without a modifier. **Reset the collection** (at the bottom, two clicks) forgets every pull and the pity count.

## Settings

In **Settings → Plugins → Gacha**: the pool (only videos with a script, on by default; only starred; tags to include and exclude), the modifier chance, each modifier on or off, the finale and break lengths, the pity, the pull animation, sounds and their volume, going to the player after a pull, and the label over the video.

## Privacy

It reads your library and what's playing, and keeps its pulls and collection in playhound's plugin storage. It sends nothing anywhere.

## Build

    npm install
    npm run build      # dist/index.js and phgacha.zip
    npm test
    npm run typecheck

`manifest.json` points at `dist/index.js`, so Load from folder runs this folder as it is after a build; the zip's copy points at `index.js`. `src/types.ts` is a copy of playhound's plugin contract (`src/plugins/types.ts`); keep it in step.

## License

MIT
