# Changelog

## 0.4.0

For playhound 2.2.8 and newer (plugin API 7). In the plugin store, under For fun.

- **Pull ×10**, next to Pull on the page and in the panel, and in the command palette. Ten pulls at once, the pity counting across them, ten different videos while the pool has enough. Ten closed capsules open one by one in a grid, rarest last; an Epic or a Legendary glows and shakes before it opens. A click opens the rest; with the animation off or reduced motion the grid shows open. All ten go into the collection, and they play one after another, rarest last: the first now, each next one when the one before ends. Only the best carries a modifier. **Up next from your ×10** shows the rest: click one to play it now, or Clear. Pulling again, playing something else, or panic ends it.
- **The daily banner**: a tag with at least 3 videos in the pool, picked by the date, on the page as "Today's banner: #tag". Within the tier a pull rolls, half the time the video is one with the tag (when the tier has one), marked Banner on its card. A setting turns it off.
- **Picture modifiers**: Mirror, Noir, Dreamy, Tilt (zoomed so no edge shows) and Pulse (a small zoom with each stroke, while the video plays). They end like the others, with the video, on panic or with End it, and take the effect off. Each has its own setting. Not rolled for sound alone; Pulse needs a script and isn't rolled with reduced motion.
- **Achievements**, 20 of them, in Stats → Achievements: pull counts, the first of each tier, Legendary counts, the size of the collection, seeing Turbo and every kind of modifier through to the end, the banner, a lucky ×10, a Legendary from the pity, and three hidden ones. Pulls saved before this version count. One earned by a pull waits until its reveal is over. The first Legendary's toast is now its achievement.
- **Fewer repeats**: a tier with only a few videos in the pool no longer takes its whole share of pulls. A library mostly of Rares had a handful of Commons, and they took 55% of the pulls between them, so the same few came up again and again. Now no video comes up more than twice as often as in a plain shuffle; the rest goes to the nearest tier. The odds under the machine are your pool's own. The banner likewise: with only a few of a tier's videos tagged, a banner video comes up at most about four times as often as the rest, not half the tier's pulls.
- **Status on the rail**: the modifier while one is on, otherwise the pity count, with the last Legendary in the tooltip.
- The plugin contract (`src/types.ts`) is playhound's API 7 copy.

## 0.3.0

Rarer pulls feel rarer.

- **Tells**: the globe and the capsule glow in the tier's colour on the way out, and an Epic or Legendary takes longer to crank, drop and wobble, the wobble building. Sometimes it lies low: an Epic can come out blue and flash purple, a Legendary blue or purple and flash gold. It never glows above what it is, so gold always means Legendary.
- **The moment**: a Legendary dims the page, bursts gold light and rays, showers gold confetti, shakes, and holds a big LEGENDARY title for about 2.5 s; an Epic gets a smaller purple version. Click to skip. Common and Rare stay quick. The panel gets a scaled version over the drawer, and its video still starts at once.
- **Sounds**, made with Web Audio: a blip, a chime, a rising arpeggio, a fanfare with a shimmer, and a short rising tick when the glow steps up. Settings: Sounds on or off, and the volume (40%).
- **Foil**: a Legendary's card, collection card and timeline item have a turning gold edge; an Epic's card glows. A toast for your first Legendary.
- **Legendary streak**: "Last Legendary N pulls ago" under the pity meter, on the page and in the panel.
- With reduced motion an Epic or Legendary still gets its title card, without the movement; sounds still play.

## 0.2.0

- The **panel has the machine too**, smaller, with the same pull animation (the capsule, its wobble, the burst), skippable by a click. A pull there still plays at once and stays where you are; the capsule opens while the video starts.
- **Last pulls**: a strip of the last 10 pulls, newest first, on the page between the machine and the collection (the last 5 in the panel). Each is edged in its rarity's colour with the modifier as a tag; hover for when; click to play it again without a modifier.

## 0.1.0

First version, for playhound 2.2 and newer. Not published.

- A **gacha machine** page: the crank, a capsule in the rarity's colour, the reveal, and the pulled video's card (thumbnail, title, rarity and why, modifier). Click to skip; off with a setting or reduced motion.
- **Rarity** from real data: intensity, how long a video has been left alone, whether it was ever finished, and stars. Common, Rare, Epic and Legendary, at 55 / 30 / 12 / 3%.
- **Pity**: an Epic or better guaranteed after 10 pulls without one.
- **Modifiers**: inverted strokes, half range, top half only, ×0.75 / ×1.25 / ×1.5 speed, the finale only, and breaks every 20 strokes. The chance grows with rarity. They end with the video, or on panic, and leave the stroke and the speed as they were.
- A **collection** of every pull, rarest first; click a card to play it without a modifier.
- **Shift+P** (or the first free of Alt+P, Alt+Shift+P) pulls from anywhere; a panel with a Pull button; a label over the video naming the modifier and counting down breaks.
