# loud

A music visualizer that runs in the browser. 40 visual modes react to the bass, the mids, the
treble and the beats of the music. There are 28 palettes and 13 looks (film, CRT, stop-motion,
mirror, glitch and others).

**Open <https://anton-bot.github.io/loud/loud.html>, tap Mic and play some music.**

`loud.html` is one self-contained file. The mic needs an http or https address, so serve the file
(for example `python -m http.server 8000`) when you use a local copy.

## Controls

| Control                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| Mic                     | Listen to the music around you. Tap again to stop        |
| Tap the picture         | Hide or show the controls                                |
| ‹ mode ›, palette, look | Tap for the next one. Hold for the full list             |
| Shuffle                 | A new random mode, palette and look                      |
| Auto-switch             | A new scene every 30 s and on some beats                 |
| Sections                | A new scene when the music changes (a drop, a breakdown) |
| Motion                  | Phone tilt, shake and twist move the picture             |
| Gate (with the mic on)  | Put the red mark just above the room noise               |

Keyboard: <kbd>M</kbd> mic, <kbd>←</kbd> <kbd>→</kbd> mode, <kbd>P</kbd> palette, <kbd>L</kbd> look,
<kbd>Space</kbd> shuffle, <kbd>H</kbd> hide the controls.

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
the built-in one at once. See `src/audio/sources.ts`.

## Development

You need Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev          # dev server with live reload: http://localhost:5173/loud.html
pnpm build        # type check, then build loud.html (copied to the repository root)
pnpm typecheck
pnpm format       # Prettier
```

The source is in `src/`. **Do not edit `loud.html` in the repository root by hand**: `pnpm build`
writes it, and GitHub Pages serves it from there. The CI check fails when `loud.html` does not match
the source. The build is not minified, so the deployed file stays readable.

### Visual regression test

```bash
pnpm build
pnpm test:visual                        # loud.html against the last commit
pnpm test:visual --base origin/master   # loud.html against master
```

The test renders two builds of `loud.html` in Chrome with the same seeded random numbers and a fake
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

## License

Apache 2.0. See [LICENSE](LICENSE).
