# loud

A music visualizer that runs in the browser. 55 visual modes react to the bass, the mids, the
treble and the beats of the music. There are 29 palettes and 14 looks (film, CRT, stop-motion,
mirror, glitch, LED wall and others).

**Open <https://loud.ivanov.hk>, tap Mic and play some music.**

The app is one self-contained file, `index.html` (the old `loud.html` address forwards to it). The
mic needs an http or https address, so serve the file (for example `python -m http.server 8000`)
when you use a local copy.

## Controls

| Control                  | What it does                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Mic                      | Listen to the music around you. Tap again to stop                                        |
| Tap the picture          | Hide or show the controls                                                                |
| Double-tap the picture   | On the right half: next mode. On the left half: previous mode                            |
| ‹ mode ›, palette, look  | Tap for the next one. Hold for the full list                                             |
| Shuffle                  | A new random mode, palette and look                                                      |
| Auto-switch              | A new scene every 30 s and on some beats                                                 |
| Sections                 | A new scene when the music changes (a drop, a breakdown)                                 |
| Motion                   | Phone tilt, shake and twist move the picture                                             |
| Cutoff (with the mic on) | The red mark is the sound level. Put the cutoff just above it when it's quiet            |
| Aa (words)               | With the mic on: every 45 s, send 8 s of sound to ElevenLabs and show the words it hears |

Keyboard: <kbd>M</kbd> mic, <kbd>←</kbd> <kbd>→</kbd> mode, <kbd>P</kbd> palette, <kbd>L</kbd> look,
<kbd>Space</kbd> shuffle, <kbd>H</kbd> hide the controls.

### Words: show what the room says

With **Aa** (words) on (it is off at first), every 45 s the page records 8 s of sound, sends it to
ElevenLabs speech to text (`scribe_v2`), and shows the words over any mode for 16 s. Each text gets
one big hero style in the middle, which changes every 8 beats: **slam** (one word per beat),
**particles** (each word built from glowing particles that burst on beats), **decode** (hacker-text
scramble), **kaleido** (a mandala of the word), **cutout** (giant letters that invert the picture),
**anagram** (letters hop to new places), **slide** (diagonal slides corner to corner), **blinds**
(slices shoot in as a staircase or a comb), **flap** (a split-flap board) and **stretch** (a rubber
word). Around it, one or two of: **tunnel**, **orbit**, **wave**, **bounce**, **rain**, **spiral**,
**tape** (diagonal caution tapes), **stickers**, **crawl** (lines on a floor in perspective) and,
rarely, **marquee**. Two round styles (orbit, spiral, kaleido) never show at the same time.

Each text gets a typeface for the ambient styles and one for the hero: Unbounded, Press Start 2P
(pixel), Rubik Glitch, Creepster (horror), Rubik Wet Paint (drip), Rubik Beastly or Monoton (neon),
all from Google Fonts. Faces without Cyrillic fall back to one with it; Chinese uses Noto Sans SC
and is cut into short chunks. The Mic dot is red while it records. The choice is kept in the
browser. Try it in the console: `loudSay('hello there')`, or with styles and a face:
`loudSay('hello there', 'flap', 'tape', 'face:pixel')`.

The ElevenLabs API key is in the page on purpose: it is an experiment key with a small balance and
no automatic top-up, so anyone who opens the page can read it and use it up.

The mic (and speech recognition with it) turns off 1 hour after the tap on Mic, in case it was
forgotten. A tap on Mic turns it on again.

### Say it, see it

Heard words also steer the show: "fire" or "огонь" starts flames, "ocean", "космос", "龙", "love",
"laser", "mushroom", "dance" and about 20 other topics in English, Russian and Chinese each have a
mode and a palette (`src/keywords.ts`).

### Build-up and drop

The section detector (`src/audio/sections.ts`) also measures the build-up before a drop: the bass
is gone and the rest of the music rises. The colour drains, the frame closes in and streaks rush to
the middle. At the drop the scene changes with shock rings. Try it without music: `loudDrop()`.

### Key colour

The **scriabin** palette follows the harmony: a 12-note chroma of the spectrum gives the chord and
the key (`src/audio/harmony.ts`), and the colours are those that Scriabin gave the notes (A green, C
red, D yellow, ...). With this palette on, the status line shows the key when it changes.

### Camera and dream frames

The **time-smear** mode uses the back camera: each row of the picture comes from a different moment
(slit-scan). It asks for the camera only when you go to it yourself; auto-switch picks it only after
the camera was allowed. The camera turns off when you leave the mode, and after 1 hour. Without a
camera it smears its own dancers.

Dream frames turn heard phrases into pictures (Pollinations) that melt away over the mode. They are
off: Pollinations now needs a token (`TOKEN` in `src/render/dream.ts`). Try the melt with any
picture: `loudDream('https://.../picture.jpg')`.

### The mic on Android

Chrome on Android does not open the mic on its own. It selects a "communication device": the
input and output pair that a voice call would use. When the page asks for no specific device,
Chrome prefers a wired headset, then USB, then Bluetooth. With Bluetooth headphones or a Bluetooth
speaker connected, that device then leaves music mode (A2DP) for call mode (SCO), and the music app
stops. Chrome resets this only for mic streams that use echo cancellation, and `loud` must turn
echo cancellation off (it would remove the music). So the Bluetooth device stayed in call mode
until the browser was closed.

`loud` now asks for the built-in microphone ("Speakerphone" in Chrome's Android device list) by
its device ID, so headsets and Bluetooth devices are not touched. The first time, before the mic is
allowed, Chrome does not show device names, so `loud` opens the default mic and then switches to
the built-in one at once. See `src/audio/mic.ts`.

## Development

You need Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev          # dev server with live reload: http://localhost:5173/
pnpm build        # type check, then build index.html (copied to the repository root)
pnpm typecheck
pnpm format       # Prettier
```

The source is in `src/`. **Do not edit `index.html` in the repository root by hand**: `pnpm build`
writes it, and GitHub Pages serves it from there. The CI check fails when `index.html` does not
match the source. `loud.html` in the root is a small hand-written page that forwards old links. The build is not minified, so the deployed file stays readable.

### Visual regression test

```bash
pnpm build
pnpm test:visual                        # index.html against the last commit
pnpm test:visual --base origin/master   # index.html against master
```

The test renders two builds of the app in Chrome with the same seeded random numbers and a fake
clock, and compares the pictures frame by frame: every mode, palette and look, and two long runs
with scene changes. Both builds run on the same machine in the same browser, so the result does not
depend on the GPU, the CPU or the fonts, and there are no reference pictures to keep up to date. It
takes about 1.5 minutes (`--quick`: one case per mode). It needs Google Chrome, or Playwright's
Chromium (`pnpm exec playwright-core install chromium`, then `--browser chromium`).

In a pull request, CI compares the pictures with the base branch. A refactor must not change them.
When a change of the pictures is on purpose (a new mode, a different effect, a changed random
sequence), add the `visual-change` label: the job then only reports the differences.

## How it works

Each frame (`src/loop.ts`):

1. `audio/analysis.ts` reads the mic analyser: noise gate, automatic gain, bass, mid and high
   levels and beat detection. `audio/sections.ts` watches for section changes. With the mic off
   (or a quiet room), a synthetic pulse keeps the picture moving.
2. `render/renderer.ts` draws the scene canvas. It starts from the last frame (feedback zoom and
   rotation, then a fade toward the background), so trails come for free. Then the current mode
   draws, and the beat rings go on top.
3. `render/lookEffects.ts` applies the current look (pixelate, mirror, ghost, glitch, grain and
   others).
4. `render/compositor.ts` copies the scene to the visible canvas with effects that must not feed
   back into the scene: a camera punch-in on the beat, chromatic aberration, bloom, scene
   transitions, a vignette and dither.

```
src/
  main.ts              entry point
  loop.ts              the frame loop
  scene.ts             mode, palette and look changes; reaction to beats
  core/                state shared by all modules, math, DOM and colour helpers
  audio/               mic, Web Audio graph, analysis, sections
  input/motion.ts      phone tilt, shake and twist
  look/                the palettes and the looks (data)
  render/              canvases, colours, shapes, renderer, look effects, compositor
  modes/               one file per visual mode, and the list of modes (index.ts)
  ui/                  controls, menu, status line, wake lock
tests/visual/          visual regression test (harness and compare script)
```

### Add a mode

1. Copy a small mode, for example `src/modes/spiral.ts`. A mode is an object with a `name`, a
   `fade` and a `draw(dt)` function, and optionally `beat()`, `resize()` and the options in
   `src/modes/mode.ts`.
2. Draw on `ctx` from `render/canvases.ts`. Read the music from `audio` (and `spectrumAt`,
   `waveAt` from `core/signal.ts`) and the screen size from `view`. Use
   `color(k, alpha, lightness)` for palette colours.
3. Add the mode to the list in `src/modes/index.ts`.

## Where some modes come from

- **slime**: the Physarum slime-mold agent model of Jeff Jones (2010), as in Sage Jenson's art.
- **coral**: Gray-Scott reaction-diffusion with Karl Sims's constants; Yoshi Sodeoka used
  reaction-diffusion for Max Cooper's "Spike" video.
- **cymatics**: Chladni figures, sand on a vibrating plate.
- **datamatics**: Ryoji Ikeda's "test pattern" (barcodes and binary data in black and white).
- **attractor**: Peter de Jong and Clifford Pickover strange attractors.
- **murmur**: Craig Reynolds's boids, as a starling murmuration with a falcon.
- **rays**, **plasma**: op-art interference, demo-scene plasma with domain warping (Inigo Quilez).
- **led wall** look: concert LED screens.
- **neon-strings**: "times table" string art (point i joined to point i × k), as a neon sign.
- **neon-tesla**: a plasma globe with midpoint-displacement lightning.
- **neon-knot**: a (p, q) torus knot as a neon tube in 3D.
- **8bit**: an original glitchy 8-bit platformer (a hero with headphones, eye blocks, speaker
  stacks), in the spirit of NES-era games.

## License

Apache 2.0. See [LICENSE](LICENSE).
