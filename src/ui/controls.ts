/** The on-screen controls, the style menu, keyboard shortcuts and fullscreen. */
import { levels } from '../audio/analysis';
import { resumeAudio } from '../audio/engine';
import { sections } from '../audio/sections';
import { isListening, toggleMic } from '../audio/mic';
import { byId } from '../core/dom';
import { clamp } from '../core/math';
import { motion, scene } from '../core/state';
import { onMotionChange, toggleMotion } from '../input/motion';
import { LOOKS } from '../look/looks';
import { PALETTES } from '../look/palettes';
import { MODES } from '../modes';
import { display } from '../render/canvases';
import { currentMode, onSceneChange, setLook, setMode, setPalette, shuffle } from '../scene';
import { initDirectLink } from './directLink';
import { setStatus } from './status';
import { keepAwake } from './wakeLock';

const HIDE_AFTER_MS = 5000;
const LONG_PRESS_MS = 450;

const ui = byId('ui');
const meterFill = byId('meterFill');
const meterGate = byId('meterGate');
const menu = byId('menu');
const menuList = byId('menuList');
const menuTitle = byId('menuTitle');
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const controlsHidden = (): boolean => ui.classList.contains('hide');

function hideControls(): void {
  ui.classList.add('hide');
  clearTimeout(hideTimer);
}

/** Shows the controls. While the mic is on, they hide again after a few seconds. */
export function showControls(): void {
  ui.classList.remove('hide');
  clearTimeout(hideTimer);
  if (isListening()) hideTimer = setTimeout(() => ui.classList.add('hide'), HIDE_AFTER_MS);
}

/** Moves the level meter. Call once per frame. */
export function updateMeter(): void {
  if (controlsHidden()) return;
  const level = isListening() ? clamp((levels.inputDb + 80) / 60, 0, 1) : 0;
  meterFill.style.width = (level * 100).toFixed(1) + '%';
  meterGate.style.left = (clamp((levels.gateDb + 80) / 60, 0, 1) * 100).toFixed(1) + '%';
}

/** Lights a toggle chip when it is on. `status` says what changed. */
function setToggle(id: string, on: boolean, status?: string): void {
  const button = byId(id);
  button.classList.toggle('on', on);
  button.setAttribute('aria-pressed', String(on));
  if (status) setStatus(status);
}

/** A small swatch of the palette colours: a rainbow for the palette without colours. */
function paletteSwatch(): string {
  const { colors } = scene.palette;
  return colors?.length
    ? `linear-gradient(135deg, ${colors.join(', ')})`
    : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)';
}

function updateSceneLabels(): void {
  const name = currentMode().name;
  byId('modeName').textContent = name;
  byId('modeBtn').textContent = name;
  byId('palName').textContent = scene.palette.name;
  byId('palBtn').setAttribute('aria-label', 'Palette: ' + scene.palette.name);
  byId('palSwatch').style.background = paletteSwatch();
  byId('lookBtn').textContent = scene.look.name;
}

type MenuKind = 'mode' | 'palette' | 'look';

const MENUS: Record<
  MenuKind,
  { title: string; names: () => string[]; current: () => number; choose: (i: number) => void }
> = {
  mode: {
    title: 'Style',
    names: () => MODES.map((m) => m.name),
    current: () => scene.modeIndex,
    choose: setMode,
  },
  palette: {
    title: 'Palette',
    names: () => PALETTES.map((p) => p.name),
    current: () => scene.paletteIndex,
    choose: setPalette,
  },
  look: {
    title: 'Look',
    names: () => LOOKS.map((l) => l.name),
    current: () => scene.lookIndex,
    choose: setLook,
  },
};

function openMenu(kind: MenuKind): void {
  const spec = MENUS[kind];
  const current = spec.current();
  menuTitle.textContent = spec.title;
  menuList.replaceChildren(
    ...spec.names().map((name, i) => {
      const item = document.createElement('button');
      item.className = 'mi' + (i === current ? ' on' : '');
      item.textContent = name;
      item.addEventListener('click', () => {
        spec.choose(i);
        closeMenu();
      });
      return item;
    }),
  );
  menu.hidden = false;
  clearTimeout(hideTimer);
  ui.classList.remove('hide');
  menuList.querySelector('.on')?.scrollIntoView({ block: 'center' });
}

function closeMenu(): void {
  menu.hidden = true;
  showControls();
}

/** Calls `action` when `element` is held down; the click that follows a long press is swallowed. */
function onLongPress(element: HTMLElement, action: () => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  let startX = 0;
  let startY = 0;
  const cancel = (): void => clearTimeout(timer);
  element.addEventListener('pointerdown', (e) => {
    fired = false;
    startX = e.clientX;
    startY = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      action();
    }, LONG_PRESS_MS);
  });
  element.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'])
    element.addEventListener(type, cancel);
  element.addEventListener('click', (e) => {
    if (!fired) return;
    fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  });
  element.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function pressMic(): Promise<void> {
  await toggleMic();
  if (isListening()) void keepAwake();
  showControls();
}

function initMicButton(): void {
  byId('micBtn').addEventListener('click', () => void pressMic());
  byId<HTMLInputElement>('gate').addEventListener('input', (e) => {
    levels.gateDb = +(e.currentTarget as HTMLInputElement).value;
  });
  // Browsers start audio suspended until the user taps; resume on any tap.
  document.addEventListener('pointerdown', resumeAudio);
}

function initSceneButtons(): void {
  onLongPress(byId('modeBtn'), () => openMenu('mode'));
  onLongPress(byId('palBtn'), () => openMenu('palette'));
  onLongPress(byId('lookBtn'), () => openMenu('look'));
  byId('prevMode').addEventListener('click', () => setMode(scene.modeIndex - 1));
  byId('nextMode').addEventListener('click', () => setMode(scene.modeIndex + 1));
  byId('modeBtn').addEventListener('click', () => setMode(scene.modeIndex + 1));
  byId('palBtn').addEventListener('click', () => setPalette(scene.paletteIndex + 1));
  byId('lookBtn').addEventListener('click', () => setLook(scene.lookIndex + 1));
  byId('shuffleBtn').addEventListener('click', shuffle);
  byId('autoBtn').addEventListener('click', () => {
    scene.autoSwitch = !scene.autoSwitch;
    setToggle(
      'autoBtn',
      scene.autoSwitch,
      scene.autoSwitch ? 'Auto-switch on: a new scene now and then.' : 'Auto-switch off.',
    );
  });
  byId('secBtn').addEventListener('click', () => {
    sections.enabled = !sections.enabled;
    setToggle(
      'secBtn',
      sections.enabled,
      sections.enabled ? 'Sections on: a new scene when the music changes.' : 'Sections off.',
    );
  });
  byId('motionBtn').addEventListener('click', () => void toggleMotion());
  onMotionChange(() => setToggle('motionBtn', motion.enabled));
  onSceneChange(updateSceneLabels);
  byId('menuBack').addEventListener('click', closeMenu);
}

function initKeyboard(): void {
  addEventListener('keydown', (e) => {
    // Leave browser shortcuts (Cmd+P, Ctrl+L, ...) and typing in fields alone,
    // and let Space and Enter press a focused button.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select')) return;
    if ((e.key === ' ' || e.key === 'Enter') && target?.closest('button')) return;
    if (e.key === 'ArrowRight') setMode(scene.modeIndex + 1);
    else if (e.key === 'ArrowLeft') setMode(scene.modeIndex - 1);
    else if (e.key === 'p') setPalette(scene.paletteIndex + 1);
    else if (e.key === 'l') setLook(scene.lookIndex + 1);
    else if (e.key === ' ') {
      e.preventDefault();
      shuffle();
    } else if (e.key === 'm') void pressMic();
    else if (e.key === 'h') ui.classList.toggle('hide');
  });
}

function initFullscreen(): void {
  const button = byId('fsBtn');
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    button.hidden = true;
    return;
  }
  button.addEventListener('click', () => {
    const root = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        void (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      } else {
        void (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
      }
    } catch {
      // Fullscreen refused (for example inside a frame): nothing to do.
    }
  });
}

export function initControls(): void {
  // Tap the picture to hide or show the controls; any tap on the controls keeps them up.
  ui.addEventListener('pointerdown', showControls);
  display.addEventListener('pointerdown', () => {
    if (controlsHidden()) showControls();
    else hideControls();
  });
  initMicButton();
  initSceneButtons();
  initKeyboard();
  initFullscreen();
  initDirectLink();
}
