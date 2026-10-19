/** loud: a music visualizer for the browser. Entry point. */
import './styles.css';
import { isListening, onPageVisibility, releaseMic } from './audio/mic';
import { initMotion } from './input/motion';
import { startLoop } from './loop';
import { MODES } from './modes';
import { onResize, resize } from './render/canvases';
import { enableTransitions } from './render/compositor';
import { shuffle } from './scene';
import { initControls } from './ui/controls';
import { keepAwake } from './ui/wakeLock';

onResize(() => {
  for (const mode of MODES) mode.resize?.();
});
addEventListener('resize', resize);

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState !== 'hidden';
  void onPageVisibility(visible).then(() => {
    if (visible && isListening()) void keepAwake();
  });
});
addEventListener('pagehide', releaseMic);

initControls();
initMotion();
resize();
shuffle();
enableTransitions();
startLoop();
