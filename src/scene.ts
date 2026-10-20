/** Scene control: which mode, palette and look are on screen, and how they change. */
import { pick, wrap } from './core/math';
import { audio, clock, scene } from './core/state';
import { LOOKS } from './look/looks';
import { PALETTES } from './look/palettes';
import { MODES, type Mode } from './modes';
import { camera } from './input/camera';
import { addBeatRing } from './render/beatRings';
import { mashupBeat } from './render/mashup';
import { startTransition } from './render/compositor';

const listeners: (() => void)[] = [];

/** Calls `listener` after each change of mode, palette or look. */
export function onSceneChange(listener: () => void): void {
  listeners.push(listener);
}

function changed(): void {
  for (const listener of listeners) listener();
}

export function currentMode(): Mode {
  return MODES[scene.modeIndex];
}

export function setMode(index: number): void {
  scene.modeIndex = wrap(index, MODES.length);
  startTransition(0.9, true);
  scene.lastSwitch = clock.time;
  audio.beat = Math.max(audio.beat, 0.6);
  changed();
}

export function setPalette(index: number): void {
  startTransition(0.6, false);
  scene.paletteIndex = wrap(index, PALETTES.length);
  scene.palette = PALETTES[scene.paletteIndex];
  changed();
}

export function setLook(index: number): void {
  startTransition(0.45, false);
  scene.lookIndex = wrap(index, LOOKS.length);
  scene.look = LOOKS[scene.lookIndex];
  changed();
}

/** A random palette, often one that suits the current mode. */
export function randomPalette(): void {
  const preferred = currentMode().palettes;
  let palette = null;
  if (preferred && Math.random() < 0.65) {
    const name = pick(preferred);
    palette = PALETTES.find((p) => p.name === name);
  }
  if (!palette) palette = pick(PALETTES, scene.palette);
  setPalette(PALETTES.indexOf(palette));
}

/** A random look; about a third of the time the clean one. */
export function randomLook(): void {
  setLook(Math.random() < 0.35 ? 0 : LOOKS.indexOf(pick(LOOKS.slice(1))));
}

/** A new random mode with a fitting palette and a random look. */
export function shuffle(): void {
  // Never ask for the camera on its own: camera modes only once it was allowed.
  const modes = MODES.filter((m) => !m.camera || camera.allowed);
  scene.modeIndex = MODES.indexOf(pick(modes, currentMode()));
  randomPalette();
  randomLook();
  setMode(scene.modeIndex);
}

/** Reacts to a detected beat. */
export function onBeat(): void {
  audio.beat = 1;
  audio.beats++;
  scene.hue = (scene.hue + 20 + Math.random() * 50) % 360;
  const mode = currentMode();
  // Rings move only while they are drawn: rings of a mode without them would pile up and burst out later.
  if (mode.beatRings !== false) addBeatRing();
  mode.beat?.();
  if (scene.look.mashup) mashupBeat();
  if (scene.autoSwitch) {
    if (audio.beats % 32 === 0) shuffle();
    else if (audio.beats % 16 === 8) randomPalette();
    else if (audio.beats % 12 === 6) randomLook();
  }
}
