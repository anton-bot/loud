/**
 * Say it, see it: words that the mic hears steer the show. Someone shouts "fire" and
 * the screen bursts into flames; "ocean", "космос" or "龙" each have their scene and
 * palette. Works for English, Russian and Chinese.
 */
import { clock, scene } from './core/state';
import { PALETTES, type PaletteName } from './look/palettes';
import { MODES } from './modes';
import { setMode, setPalette } from './scene';
import { setStatus } from './ui/status';

interface Topic {
  mode: string;
  palette?: PaletteName;
  /**
   * Space-separated. An English word also matches with -s or -es; a word ending in
   * "*" matches any word that starts with it (for Russian endings); Chinese matches
   * anywhere in the text.
   */
  words: string;
}

// prettier-ignore
const TOPICS: readonly Topic[] = [
  { mode: 'zeds-embers', palette: 'lava', words: 'fire flame burn burning hot огон* огн* плам* жар* горит гори 火 焰 燃烧' },
  { mode: 'zeds-embers', palette: 'ice', words: 'snow ice cold winter frozen снег* лёд льд* лед холод* зим* мороз* 雪 冰 冷 冬天' },
  { mode: 'ripples', palette: 'deep sea', words: 'ocean sea water wave swim beach море моря морю морем морск* океан* вода воды воду водой волн* пляж* 海 水 浪 游泳' },
  { mode: 'nebula', palette: 'void', words: 'space cosmos galaxy star universe planet moon космос* звезд* звёзд* галакт* вселенн* планет* лун* 星 宇宙 银河 月亮' },
  { mode: 'tree', palette: 'forest', words: 'tree forest jungle nature leaf лес* дерев* природ* джунгл* 树 森林 自然' },
  { mode: 'shroom', palette: 'mushroom', words: 'mushroom shroom trip psychedelic гриб* трип* психодел* 蘑菇 迷幻' },
  { mode: 'zeds-lasers', palette: 'neon', words: 'laser lasers лазер* 激光' },
  { mode: 'bounce', palette: 'technicolor', words: 'dance dancing jump bounce ball танц* прыга* пляш* мяч* 跳舞 跳 球' },
  { mode: '8bit', words: 'mario game gaming pixel nintendo марио игр* пиксел* 游戏 马里奥 像素' },
  { mode: 'zeds-neon', palette: 'neon', words: 'neon неон* 霓虹' },
  { mode: 'matrix', palette: 'phosphor', words: 'matrix hacker hack code computer матриц* хакер* код* компьют* 黑客 代码 电脑 矩阵' },
  { mode: 'solids', palette: 'ultraviolet', words: 'crystal diamond geometry cube кристал* алмаз* бриллиант* геометр* куб* 水晶 钻石 几何' },
  { mode: 'plasma', palette: 'vapor', words: 'dream dreams sleep сон снится мечт* сны 梦 做梦' },
  { mode: 'halo', palette: 'candy', words: 'love heart kiss любов* любл* сердц* поцел* 爱 心 亲吻' },
  { mode: 'fireworks', palette: 'technicolor', words: 'firework fireworks party celebrate birthday салют* фейерверк* праздн* вечеринк* 烟花 派对 生日' },
  { mode: 'murmur', palette: 'sunset', words: 'bird birds flock fly flying птиц* стая* лета* 鸟 飞' },
  { mode: 'datamatics', palette: 'mono', words: 'data digital numbers данн* цифр* 数据 数字' },
  { mode: 'tunnel', palette: 'ultraviolet', words: 'tunnel deeper faster speed туннел* тоннел* быстр* глубж* 隧道 更快' },
  { mode: 'slime', palette: 'toxic', words: 'slime toxic acid poison слиз* токсич* кислот* яд* 毒 酸' },
  { mode: 'coral', palette: 'deep sea', words: 'coral reef корал* риф* 珊瑚' },
  { mode: 'attractor', palette: 'ultraviolet', words: 'chaos smoke ghost хаос* дым* призрак* 混沌 烟' },
  { mode: 'neon-tesla', palette: 'ultraviolet', words: 'electric lightning thunder storm tesla молни* гроз* электр* тесл* 闪电 雷 电' },
  { mode: 'fireworks', palette: 'lava', words: 'dragon дракон* 龙' },
];

/** Chinese, Japanese and Korean characters. */
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/** How many words of `topic` are in the text. */
function score(topic: Topic, text: string, tokens: readonly string[]): number {
  let hits = 0;
  for (const word of topic.words.split(' ')) {
    if (CJK.test(word)) {
      if (text.includes(word)) hits++;
    } else if (word.endsWith('*')) {
      const stem = word.slice(0, -1);
      hits += tokens.filter((t) => t.startsWith(stem)).length;
    } else {
      hits += tokens.filter((t) => t === word || t === `${word}s` || t === `${word}es`).length;
    }
  }
  return hits;
}

/** The topic that the text talks about most, if any. */
export function topicOf(text: string): Topic | null {
  const lower = text.toLowerCase();
  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let best: Topic | null = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const s = score(topic, lower, tokens);
    if (s > bestScore) {
      best = topic;
      bestScore = s;
    }
  }
  return best;
}

/** Switches to the scene of what was heard, if it names one. */
export function steerByWords(text: string): void {
  const topic = topicOf(text);
  if (!topic) return;
  const modeIndex = MODES.findIndex((m) => m.name === topic.mode);
  if (modeIndex < 0) return;
  if (modeIndex !== scene.modeIndex) setMode(modeIndex);
  else scene.lastSwitch = clock.time;
  const paletteIndex = topic.palette ? PALETTES.findIndex((p) => p.name === topic.palette) : -1;
  if (paletteIndex >= 0 && paletteIndex !== scene.paletteIndex) setPalette(paletteIndex);
  setStatus(`Heard it: ${topic.mode}`);
}
