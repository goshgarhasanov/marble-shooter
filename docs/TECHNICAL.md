# Technical notes

Deeper implementation detail than the [README](../README.md) carries. Written
for anyone extending the project — or for future me.

- [Rendering: everything is generated](#rendering-everything-is-generated)
- [Audio: everything is synthesised](#audio-everything-is-synthesised)
- [Responsive layout](#responsive-layout)
- [Genre mechanics and what is missing](#genre-mechanics-and-what-is-missing)
- [Balance and tuning](#balance-and-tuning)
- [Release plan](#release-plan)

## Rendering: everything is generated

There is not a single image file in the repository. Every texture is drawn
with the **Canvas 2D API** at startup in `src/game/textures.ts`.

Canvas 2D is used rather than Phaser's `Graphics` because it supports
gradients, real drop shadows (`shadowBlur`) and repeating patterns
(`createPattern`). Those three features are the difference between flat
coloured shapes and surfaces that read as glass and stone.

### Marbles

Each marble is seven stacked layers, and each one corresponds to something
real glass does:

1. Sphere body gradient, light source upper-left
2. Internal scattering — the soft colour density inside the glass
3. Bounce light creeping in from the lower-right rim
4. **Caustic** — the bright crescent light forms after passing through glass
5. Inner edge darkening, which finishes the volume
6. Soft primary specular highlight
7. A small sharp secondary glint

Marbles are rendered at 160 px and scaled down, so they stay crisp on
high-density displays.

### Track

The path is stroked into one full-screen canvas texture, once:

1. A drop shadow onto the floor — this is what makes the channel read as
   carved rather than painted
2. A stone border stroked with a noise pattern
3. A lighter top edge, offset upward, for the lit rim
4. The dark inner channel
5. An inner shadow via `source-atop`, dark at the walls
6. A thin gold guide line so the route stays readable

### Background

Dark base, then large-scale mottling from dozens of soft radial blobs, a fine
grain pattern in `overlay` mode, and finally a vignette that pulls the eye to
the play area.

### Frog and cursor

The shooter is a top-down frog drawn facing up; aiming rotates it. The same
drawing, tinted very dark, becomes the stone idols in the corners. A smaller
32 px version is exported as a `data:` URI and set as the CSS cursor.

## Audio: everything is synthesised

No audio files either. `src/audio/` builds every sound from oscillators and
filtered noise through the **Web Audio API**.

### Music

A procedural loop in **Phrygian dominant** on A — the scale that gives the
genre its "ancient temple" colour. Four bars of sixteenth steps drive a kick,
shaker, woodblock, bass, marimba lead and a pad.

Timing uses **lookahead scheduling** against the audio clock rather than
`setInterval` alone, so timer jitter cannot smear the beat. Tempo rises from
96 to 130 BPM as the chain approaches the skull, and an extra percussion
layer enters — pressure you can hear without looking.

> One subtlety worth keeping: when a tab is backgrounded, `setInterval` is
> throttled and the scheduler falls behind the audio clock. Without a resync
> guard, returning to the tab schedules hundreds of past-dated notes that all
> fire at once. `Music.schedule()` resyncs when it detects that gap.

### Sound effects

Shot, marble impact, explosion, swap, danger pulse, lose, win and UI sounds.
The explosion is pitched **up with the combo level**, so chain reactions are
audible without watching the score.

### Announcer

Combo callouts ("Double!", "Triple!", "Quadruple!") use the browser's
`speechSynthesis` at a lowered pitch. Zero bytes of payload. If the API is
unavailable the announcer disables itself silently. Callouts stay English on
purpose: it is the genre convention, and per-language voice availability is
not guaranteed.

## Responsive layout

The canvas always fills the window (`Scale.RESIZE`) — no letterboxing. The
layout is **derived from the real viewport** in `src/game/layout.ts` rather
than being a fixed design that gets scaled.

```
ui      = clamp(min(w / 900, h / 620), 0.62, 1.3)   // text and button scale
squash  = clamp(availW / availH, 0.5, 1.9)          // spiral aspect ratio
outer   = min(availW / 2 / squash, availH / 2) * 0.97
scale   = outer / 244                                // world scale factor
```

That `scale` feeds `scaledConfig()`, which multiplies every distance-based
constant: ball size, spacing, march speed, pullback speed, projectile speed
and bomb radius. Because they all scale together, the time it takes the chain
to cross the board is identical on every device.

Verified at 390×844, 844×390, 820×1180 and 1600×900 — the canvas fills the
window at all four, and the spiral reshapes from a tall ellipse in portrait
to a wide one in landscape.

Rotating mid-game does not restart the level: the camera refits to the new
viewport and progress is preserved. The next level is built for the new size.

## Genre mechanics and what is missing

Mechanics were taken from primary documentation of the original rather than
from memory. Notable detail that shaped the implementation:

> *"...it also generates a backward momentum which gets stronger each time.
> After a triple or quadruple combo, you will have a significant knockback and
> the balls will pause for a few moments before beginning to roll forward
> again."*

The first implementation had a fixed pullback and no pause, which made combos
feel flat. Knockback now scales with the combo level and the chain halts
briefly afterwards.

Two subtleties that are easy to get wrong:

- **Gap shots must be threaded between marbles.** Counting every crossing of
  an empty stretch of track means the shooter — which sits at the centre of a
  spiral — earns a bonus on nearly every shot. A crossing only counts when
  there are marbles nearby.
- **The level-completion bonus must be measured before the chain empties.**
  Reading the remaining distance after the last marble is gone returns the
  full track length, so every clear would score the maximum.

### Deliberately not implemented

- Tunnels that hide sections of the chain
- Levels with two simultaneous tracks
- Temple/stage progression with rising speed
- Ace-time bonus

All four need authored levels and a path editor. They are a separate piece of
work from the mechanics, which is why the current build uses one procedural
spiral.

## Balance and tuning

Every tunable number lives in `src/core/balance.ts` — ball spacing, speeds,
score values, power-up durations, meter target, lives, extra-life threshold.

The object is shaped to be loaded from JSON and driven by remote config, so
balance can be changed without shipping an app store update. That matters
more than it sounds: getting difficulty right needs real player data, and
waiting on review cycles to test a curve is how balancing stalls.

Because `src/core/` has no engine dependency, a balance change can be
validated by simulating thousands of frames in a test instead of playing.

## Release plan

| Day | Work |
|---|---|
| 1 ✅ | Core chain model, tests, rendering, HUD, four languages |
| 2 | Start countdown, level-end flow, shot feel |
| 3 | Audio pass |
| 4 | Several levels, path variety, difficulty curve |
| 5 | Mobile: touch tuning, portrait/landscape, FPS on low-end devices |
| 6 | Menu, settings, high score, translation review |
| 7 | Deploy: itch.io and Netlify, then a CrazyGames Basic Launch submission |

**A realistic note on the mobile store.** Web can ship in a week; a mobile
store listing cannot. New individual Google Play developer accounts have to
run a closed test before production access (at one point twelve testers for
fourteen days). The rules change, so check the current requirement before
planning around it — but budget for it rather than assuming a same-week
launch.

CrazyGames' Basic Launch tier is worth using early: a build can be uploaded
without SDK integration and gets real traffic, which is the cheapest way to
find out whether the game holds attention before spending on user
acquisition.

## Next steps

- Power-up expansion and a level editor (`phaser3-plugin-pathbuilder` can
  author paths that feed `Polyline`)
- Android build via Capacitor with LevelPlay mediation
- Poki and CrazyGames providers implementing the `AdProvider` interface in
  `src/ads/`
