# phgacha

**18+ only.** A gacha machine for your [playhound](https://github.com/whatmekota/playhound) library. Turn the crank, a capsule drops, and out comes the next video: the rarer the better, sometimes with a twist on top. Pull ten at once and they play one after another. Every pull goes into your collection, and the machine has achievements of its own.

Needs playhound **2.2.8** or newer (plugin API 7).

## Install

It's in playhound's plugin store, under **For fun**: **Settings → Plugins → Discover**, find Gacha and install it.

For developers: **Settings → Plugins → Load from folder…** and pick this folder (after `npm run build`). It runs `dist/index.js` and reloads when you build again. Or drop `phgacha.zip` on that page to install it.

It asks for six permissions:

- **Read your library**: the videos to pull from, their stats (plays, finishes, stars, intensity), tags (for the banner) and thumbnails.
- **Play, pause, seek and change the speed**: to play the pull and a ×10's videos one after another, and for the speed, finale and break modifiers.
- **See what is playing, where**: to know when the pulled video changes or ends, so its modifier ends with it, and where the stroke is, for Pulse.
- **Read the loaded scripts**: to count strokes for the break modifier.
- **Move your device, and reshape scripts**: only for the stroke modifiers (inverted, half range, top half), and only while one is on.
- **Show its own page, draw over the video and change how the picture looks**: the machine's page, a small label over the video naming the modifier, and the picture modifiers.

## Pulling

- **Gacha** in the left nav opens the machine. Press **Pull**: the crank turns, a capsule in the rarity's colour drops and opens, and the card shows what you got. The video starts, and a moment later you're on the player (a setting; **Stay here** cancels it). Click the machine to skip the animation.
- **Shift+P** anywhere pulls at once with a toast instead of the animation (or Alt+P, or Alt+Shift+P, whichever is free; the page says which). Also **Pull from the gacha** in the command palette (Ctrl K).
- The **Gacha** panel on the right rail has a smaller machine with the same animation, the pity meter, the last pull, the modifier that is on and the last 5 pulls. A pull there plays at once and keeps you where you are.
- The plugin's button on the rail says how the machine stands: the modifier while one is on (a pulsing dot), otherwise the pity count ("Pity 7/10") with the last Legendary in its tooltip.

## Pull ×10

**Pull ×10**, next to Pull on the page and in the panel, pulls ten at once. The pity counts across them, as it would over ten pulls: if it comes due on the fourth, the fourth is an Epic or better. The ten are different videos while the pool has enough.

The crank turns and ten closed capsules wait in a grid, rarest last. They open one by one: a Common at once, an Epic or a Legendary only after it has glowed its colour and shaken for a moment. Click the grid to open the rest at once. With the animation off or reduced motion, the grid shows open. An Epic or a Legendary among them then gets its moment.

All ten go into the collection and the last pulls, and they play one after another in the grid's order: the first now, each next one when the one before ends. Only the best of the ten carries a modifier, if it rolled one. **Up next from your ×10** shows what's still to come: click one to play it now (the rest follow it), or **Clear** to stop there. Pulling again, or playing something else yourself, ends it too, and so does panic. Also **Pull ×10 from the gacha** in the command palette, with a toast.

## Rarity

Each video's rarity comes from what playhound knows about it. Points:

| | |
| --- | --- |
| Intensity | gentle 0, medium 1, intense 2 (0 until its script is analysed; the machine asks for that in the background) |
| Left alone | never played 2; not played for 60 days, or only once or twice, 1 |
| Never finished | 1 |
| Starred | 1 |

0–1 points is **Common**, 2–3 **Rare**, 4 **Epic**, 5–6 **Legendary**. A pull rolls the tier first (Common 55%, Rare 30%, Epic 12%, Legendary 3%), then a video of that tier. If the library has none of that tier, the nearest tier that has some stands in. A tier with only a few videos gets less than its share, so no video comes up more than twice as often as it would in a plain shuffle: the rest goes to the nearest tier. The odds under the machine are your pool's own.

**The reveal** gets grander the rarer the pull. The capsule glows its tier on the way out, sometimes starting lower and flashing up a tier (never higher than it is: gold always means Legendary), and an Epic or Legendary cranks, drops and wobbles longer. A Legendary then dims the page, bursts gold light, showers confetti, shakes and holds a big LEGENDARY title; an Epic gets a smaller purple version. Each tier has its own short sound (a blip, a chime, an arpeggio, a fanfare). Legendary cards have a turning gold foil edge. Under the pity meter, the page and the panel say how many pulls ago the last Legendary was.

**Pity**: after 10 pulls in a row without an Epic or better (a setting), the next one is guaranteed to be.

## The daily banner

Each day one tag from your library is on the banner: "Today's banner: #pov" above the machine. It's picked from the tags that at least 3 videos in the pool have, by the date, so it stays the same all day and changes at midnight. The tier is rolled as usual; then, half the time, the video is one with the banner's tag, when that tier has one. When only a few of the tier's videos have it, less often: a banner video comes up at most about four times as often as one without the tag, so the same few don't keep coming back. A pull that lands on it says **Banner** on its card. A setting turns the banner off.

## Modifiers

Each pull may roll one. The chance is set for a Rare (40% by default); a Common gets about half of it, an Epic or Legendary more, never above 90%. "No modifier" stays the usual outcome.

- **Upside down**, **Half range**, **Top half only**: the stroke reshaped on its way to the device. Only rolled with a device connected and a script.
- **Slow motion ×0.75**, **Fast ×1.25**, **Turbo ×1.5**: the speed, on top of yours.
- **Finale only**: straight to the last 90 s (a setting). Only for videos well over twice that long.
- **Breaks**: a pause of 4 s every 20 strokes (both settings), counted from the stroke script.
- The picture: **Mirror** flips it left to right, **Noir** makes it black and white with more contrast, **Dreamy** softens it with a little blur and glow, **Tilt** turns it a few degrees and zooms just enough that no edge shows, and **Pulse** zooms it a little with each stroke, most at the bottom, while the video plays. Not for sound alone; Pulse needs a script and isn't rolled with reduced motion (if that's asked for while it's on, it holds a still zoom).

A modifier ends when the video changes or ends, on panic, with **End it** (the page and the panel), or **End the gacha modifier** in the command palette. Ending takes the stroke filter and the picture's effect off and puts your speed back, unless you changed the speed yourself meanwhile; then yours stands. A break is never resumed after a panic.

## Last pulls and the collection

**Last pulls** on the page is a strip of the last 10 pulls, newest first: the thumbnail edged in its rarity's colour, the modifier as a tag, and when in the tooltip. Click one to play it again, without a modifier.

The **collection** lists every video you've pulled, rarest first, with how often. A card's colour is the rarest it has come up as. Click one to play it as it is, without a modifier. **Reset the collection** (at the bottom, two clicks) forgets every pull and the pity count. Achievements already earned stay earned.

## Achievements

The machine's own, in **Stats → Achievements** under Gacha, with a notice when one is earned. They're worked out from what the machine has saved, so pulls from before 0.4.0 count too. An achievement earned by a pull waits until its reveal is over.

| | |
| --- | --- |
| First crank | Pull for the first time |
| Regular, High roller, Whale | Pull 10, 100, 500 times |
| Something blue, Purple patch, Struck gold | Pull a Rare, an Epic, a Legendary |
| Midas touch, Living legend | Pull 5, 25 Legendaries |
| Collector, Curator, Museum piece | Have 25, 100, 250 different videos in the collection |
| Survived Turbo | Watch a Turbo ×1.5 pull to the end |
| Seen every twist | Watch a pull to the end under each kind of modifier: stroke, speed, finale, breaks and picture |
| On the banner | Pull a video with the day's banner tag |
| Lucky ten | Get two or more Epic-or-better in one ×10 |
| Worth the wait | Get a Legendary from the pity |

And three hidden ones.

## Settings

In **Settings → Plugins → Gacha**: the pool (only videos with a script, on by default; only starred; tags to include and exclude), the modifier chance, each modifier on or off (the picture modifiers under their own heading), the finale and break lengths, the daily banner, the pity, the pull animation, sounds and their volume, going to the player after a pull, and the label over the video.

## Privacy

It reads your library and what's playing, and keeps its pulls and collection in playhound's plugin storage; its achievements are kept by playhound with its own. It sends nothing anywhere.

## Build

    npm install
    npm run build      # dist/index.js and phgacha.zip
    npm test
    npm run typecheck

`manifest.json` points at `dist/index.js`, so Load from folder runs this folder as it is after a build; the zip's copy points at `index.js`. `src/types.ts` is a copy of playhound's plugin contract (`src/plugins/types.ts`); keep it in step.

## License

MIT
