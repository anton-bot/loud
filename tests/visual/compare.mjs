// @ts-check
/**
 * Visual regression test for the app (index.html; loud.html before the rename).
 *
 * Renders two builds of the app with the same seeded random numbers and the same
 * fake clock (see harness.js), and compares the pictures frame by frame:
 *   base  the app at a git commit (default: HEAD, the last commit), or a file
 *   head  index.html in the working tree (default), or a file
 * Both builds run in the same browser on the same machine. So the result does not
 * depend on the GPU, the CPU or the fonts, and no reference pictures are stored.
 *
 *   pnpm test:visual                        working tree against the last commit
 *   pnpm test:visual --base origin/master   working tree against master
 *
 * Options:
 *   --base <git ref or file>   the reference build
 *   --head <file>              the build to test
 *   --browser chrome|chromium  installed Google Chrome (default), or Playwright's Chromium
 *                              (install it first: pnpm exec playwright-core install chromium)
 *   --quick                    one case per mode only
 *   --report-only              show the differences, but exit with 0
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

/**
 * @typedef {object} TestCase
 * @property {number} seed
 * @property {number} nextMode     presses of → before the frames run
 * @property {number} nextPalette  presses of P
 * @property {number} nextLook     presses of L
 * @property {number} frames       frames to run
 * @property {number} every        hash the picture every this many frames
 *
 * @typedef {object} RunResult
 * @property {string[]} hashes  one picture hash per `every` frames
 * @property {string} scene     mode, palette and look when the frames start
 */

const MODES = 40;
const PALETTES = 28;
const LOOKS = 13;
/** A made-up origin for the two builds; all other requests are blocked. */
const ORIGIN = 'http://loud.test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const { values: options } = parseArgs({
  options: {
    base: { type: 'string', default: 'HEAD' },
    head: { type: 'string', default: join(root, 'index.html') },
    browser: { type: 'string', default: 'chrome' },
    quick: { type: 'boolean', default: false },
    'report-only': { type: 'boolean', default: false },
  },
});

/**
 * The HTML of a build: a file, or the app at a git ref. The app was loud.html before
 * it became index.html (and for a while index.html only forwarded to loud.html), so
 * take whichever of the two has the app's canvas.
 * @param {string} source
 */
function readBuild(source) {
  if (existsSync(source)) return readFileSync(source, 'utf8');
  for (const file of ['index.html', 'loud.html']) {
    let html = '';
    try {
      html = execFileSync('git', ['show', `${source}:${file}`], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      continue;
    }
    if (html.includes('id="display"')) return html;
  }
  throw new Error(`No build of the app at ${source}`);
}

const harness = readFileSync(join(here, 'harness.js'), 'utf8');

/**
 * The build with the harness as the first script, so that it runs before the app.
 * @param {string} html
 */
function withHarness(html) {
  const at = html.indexOf('<head>') + '<head>'.length;
  if (at < '<head>'.length) throw new Error('The build has no <head>');
  return `${html.slice(0, at)}\n<script>${harness}</script>${html.slice(at)}`;
}

/** @returns {TestCase[]} */
function testCases() {
  const cases = [];
  // Every mode once. All use one seed, so that they start from the same mode and
  // `nextMode` presses of → reach each mode once. Palettes and looks vary.
  for (let mode = 0; mode < MODES; mode++) {
    const nextPalette = (mode * 3) % PALETTES;
    cases.push({
      seed: 1,
      nextMode: mode,
      nextPalette,
      nextLook: mode % LOOKS,
      frames: 120,
      every: 40,
    });
  }
  if (options.quick) return cases;
  // Every look again, on other modes and palettes (one seed again, so that each look comes once).
  for (let look = 0; look < LOOKS; look++) {
    cases.push({
      seed: 2,
      nextMode: look * 3,
      nextPalette: look * 2,
      nextLook: look,
      frames: 90,
      every: 45,
    });
  }
  // Long runs: auto-switch, many beats, scene changes and transitions.
  cases.push({ seed: 7, nextMode: 0, nextPalette: 0, nextLook: 0, frames: 2700, every: 300 });
  cases.push({ seed: 8, nextMode: 5, nextPalette: 3, nextLook: 4, frames: 2700, every: 300 });
  return cases;
}

/** @type {Record<string, string>} */
const builds = {
  base: withHarness(readBuild(options.base)),
  head: withHarness(readBuild(options.head)),
};

let browser;
try {
  browser = await chromium.launch(
    options.browser === 'chromium' ? {} : { channel: options.browser },
  );
} catch (error) {
  console.error(String(error));
  console.error(
    `\nCould not start the browser "${options.browser}". Install Google Chrome, or run\n` +
      '  pnpm exec playwright-core install chromium\nand use --browser chromium.',
  );
  process.exit(2);
}
const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
// Web fonts are blocked too: both builds then use the same local fallback fonts.
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  const build = builds[url.pathname.slice(1)];
  if (url.origin === ORIGIN && build)
    return route.fulfill({ contentType: 'text/html', body: build });
  return route.abort();
});

/**
 * @param {'base' | 'head'} build
 * @param {TestCase} testCase
 * @returns {Promise<RunResult>}
 */
async function render(build, testCase) {
  await page.goto(`${ORIGIN}/${build}?seed=${testCase.seed}`);
  // @ts-expect-error The harness adds __loudTest to the page.
  return page.evaluate((c) => window.__loudTest.run(c), testCase);
}

const cases = testCases();
const started = Date.now();
console.log(`Visual test: ${options.head} against ${options.base}, ${cases.length} cases\n`);

// The test only means something when a build renders the same way twice.
const first = await render('base', cases[0]);
const again = await render('base', cases[0]);
if (JSON.stringify(first) !== JSON.stringify(again)) {
  console.error(
    'The base build gives different pictures in two identical runs. The test cannot work here.',
  );
  await browser.close();
  process.exit(2);
}

const failures = [];
for (const [i, testCase] of cases.entries()) {
  const base = i === 0 ? first : await render('base', testCase);
  const head = await render('head', testCase);
  const frame = base.hashes.findIndex((hash, n) => hash !== head.hashes[n]);
  const label = `case ${String(i + 1).padStart(2)}  seed ${String(testCase.seed).padEnd(3)}  ${head.scene}`;
  // Only the pictures count; the scene names are for the log (control labels can change).
  if (frame === -1) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(
      `  DIFF  ${label}  (from frame ${(frame + 1) * testCase.every}; base: ${base.scene})`,
    );
    failures.push(i + 1);
  }
}
await browser.close();

const seconds = ((Date.now() - started) / 1000).toFixed(0);
if (!failures.length) {
  console.log(`\nAll ${cases.length} cases render the same pictures (${seconds} s).`);
} else {
  console.log(
    `\n${failures.length} of ${cases.length} cases render different pictures (${seconds} s).`,
  );
  console.log('If the change is on purpose, add the "visual-change" label to the pull request.');
  if (!options['report-only']) process.exit(1);
}
