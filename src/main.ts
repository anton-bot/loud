/** loud: a music visualizer for the browser. Entry point. */
import './styles.css';
import { isListening, onPageVisibility, releaseMic } from './audio/mic';
import { onHeard } from './audio/speech';
import { initMotion } from './input/motion';
import { startLoop } from './loop';
import { MODES } from './modes';
import { onResize, resize } from './render/canvases';
import { enableTransitions } from './render/compositor';
import { showHeardWords } from './render/heardWords';
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

onHeard(showHeardWords);
// For trying the heard-words overlay from the console: loudSay('hello there').
window.loudSay = showHeardWords;

initControls();
initMotion();
resize();
shuffle();
enableTransitions();
startLoop();
