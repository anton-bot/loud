/**
 * Test harness for the visual regression test (compare.mjs puts it into loud.html,
 * before the app starts). It makes every run repeatable:
 *   - Math.random is a seeded generator. The seed comes from `?seed=` in the URL.
 *   - performance.now is a fake clock, and requestAnimationFrame only queues the
 *     callback. Frames run when the test calls `step()`, 60 per fake second.
 *   - Every 2D canvas renders in software, so that the GPU cannot change the pixels.
 * It uses only the page's canvas and its keyboard shortcuts, so it also works with
 * older builds of loud.html.
 */
(() => {
  let seed = Number(new URLSearchParams(location.search).get('seed') || 1) >>> 0;
  // mulberry32
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    if (type !== '2d') return getContext.call(this, type, options);
    return getContext.call(this, type, { ...options, willReadFrequently: true });
  };

  let now = 0;
  let queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (callback) => queue.push(callback);

  /** Runs `frames` frames. */
  function step(frames) {
    for (let i = 0; i < frames; i++) {
      now += 1000 / 60;
      const callbacks = queue;
      queue = [];
      for (const callback of callbacks) callback(now);
    }
  }

  /** FNV-1a hash of the visible canvas pixels. */
  function hash() {
    const canvas = document.querySelector('canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0x811c9dc5;
    for (let i = 0; i < pixels.length; i++) {
      h ^= pixels[i];
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function press(key, times) {
    for (let i = 0; i < times; i++) dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  /** Mode, palette and look, as the controls show them. */
  function scene() {
    const text = (id) => document.getElementById(id)?.textContent ?? '?';
    return `${text('modeName')} | ${text('palBtn')} | ${text('lookBtn')}`;
  }

  /**
   * One test case: go to the next mode, palette and look the given number of times,
   * then run `frames` frames and hash the picture every `every` frames.
   */
  async function run({ nextMode, nextPalette, nextLook, frames, every }) {
    await document.fonts.ready;
    step(2);
    press('ArrowRight', nextMode);
    press('p', nextPalette);
    press('l', nextLook);
    const start = scene();
    const hashes = [];
    for (let f = every; f <= frames; f += every) {
      step(every);
      hashes.push(hash());
    }
    return { hashes, scene: start };
  }

  window.__loudTest = { run };
})();
