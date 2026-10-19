/** loud: a music visualizer for the browser. Entry point. */
import './styles.css';
import { isListening, onPageVisibility, releaseMic } from './audio/mic';
import { simulateDrop } from './audio/sections';
import { onHeard } from './audio/speech';
import { initMotion } from './input/motion';
import { startLoop } from './loop';
import { MODES } from './modes';
import { onResize, resize } from './render/canvases';
import { enableTransitions } from './render/compositor';
import { dreamFromUrl, requestDream } from './render/dream';
import { showHeardWords } from './render/words';
import { shuffle } from './scene';
import { steerByWords } from './keywords';
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
onHeard(steerByWords);
onHeard(requestDream);
// For trying the heard-words overlay from the console: loudSay('hello there'), or with
// styles: loudSay('hello there', 'particles', 'rain', 'spiral').
window.loudSay = (text, hero, ...ambient) => {
  showHeardWords(text, hero, ...ambient);
  steerByWords(text);
  requestDream(text);
};
// A build-up and a drop without music: loudDrop(), or loudDrop(10) for a 10 s build-up.
window.loudDrop = simulateDrop;
// A dream frame from any picture: loudDream('https://.../picture.jpg').
window.loudDream = dreamFromUrl;

initControls();
initMotion();
resize();
shuffle();
enableTransitions();
startLoop();
