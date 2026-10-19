import { hexToRgb, type Rgb } from '../core/rgb';

interface PaletteSpec {
  readonly name: string;
  /** Background colour, '#rrggbb'. */
  readonly bg: string;
  /** How the modes blend their shapes onto the scene. */
  readonly blend: GlobalCompositeOperation;
  /** The colours that the modes cycle through. Without colours: a rainbow that follows the scene hue. */
  readonly colors?: readonly string[];
  /** Light background with dark ink. Turns off bloom and flips some effects. */
  readonly light?: boolean;
}

export interface Palette extends PaletteSpec {
  /** `colors` as RGB, or null for the rainbow. */
  readonly rgb: readonly Rgb[] | null;
  readonly bgRgb: Rgb;
}

// prettier-ignore
const SPECS = [
  { name: 'void', bg: '#000000', blend: 'lighter' },
  { name: 'neon', bg: '#0b0b12', blend: 'lighter', colors: ['#ff2d95', '#00e5ff', '#ffe600', '#7cff00'] },
  { name: 'wine', bg: '#1c0612', blend: 'lighter', colors: ['#ff4d6d', '#ff9e00', '#ffd166', '#ffffff'] },
  { name: 'deep sea', bg: '#03141f', blend: 'lighter', colors: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'] },
  { name: 'forest', bg: '#07190f', blend: 'lighter', colors: ['#b5ff3d', '#2ee6a6', '#ffd60a', '#ff7b00'] },
  { name: 'sunset', bg: '#130622', blend: 'lighter', colors: ['#ff9e00', '#ff0054', '#9e0059', '#5a189a'] },
  { name: 'phosphor', bg: '#020a04', blend: 'lighter', colors: ['#39ff14', '#c8ffc8', '#0aff9d'] },
  { name: 'slate', bg: '#252b33', blend: 'lighter', colors: ['#ffffff', '#ffd166', '#06d6a0', '#ef476f'] },
  { name: 'hazard', bg: '#141414', blend: 'source-over', colors: ['#ffd100', '#ffffff', '#ff3b00'] },
  { name: 'blueprint', bg: '#0d2a5c', blend: 'source-over', colors: ['#ffffff', '#9ecbff', '#ffd166'] },
  { name: 'chalk', bg: '#1f2b2b', blend: 'source-over', colors: ['#f7f3e8', '#ffb3c1', '#a8dadc', '#ffe066'] },
  { name: 'paper', bg: '#f2ead8', blend: 'source-over', colors: ['#e63946', '#1d3557', '#f4a261', '#2a9d8f'], light: true },
  { name: 'cream', bg: '#fff4e0', blend: 'multiply', colors: ['#ff006e', '#3a86ff', '#ffbe0b', '#8338ec'], light: true },
  { name: 'mint', bg: '#dff5ec', blend: 'source-over', colors: ['#0b3d2e', '#ff6b6b', '#1b998b', '#f4d35e'], light: true },
  { name: 'candy', bg: '#ffd6e8', blend: 'multiply', colors: ['#ff2e88', '#7b2cbf', '#00b4d8', '#ffb703'], light: true },
  { name: 'sand', bg: '#e9dcc5', blend: 'multiply', colors: ['#c1272d', '#1b1b1b', '#0077b6', '#f77f00'], light: true },
  { name: 'acid', bg: '#0a0014', blend: 'lighter', colors: ['#ff00e6', '#aaff00', '#00ffe1', '#ffe600'] },
  { name: 'lava', bg: '#1a0300', blend: 'lighter', colors: ['#ff3d00', '#ffb300', '#fff3c4', '#ff005c'] },
  { name: 'ultraviolet', bg: '#12002b', blend: 'lighter', colors: ['#7b2cff', '#ff2fd6', '#3d7bff', '#c8a4ff'] },
  { name: 'toxic', bg: '#061a08', blend: 'lighter', colors: ['#b6ff00', '#ffea00', '#ff6a00', '#00ffb3'] },
  { name: 'vapor', bg: '#2b1055', blend: 'lighter', colors: ['#ff71ce', '#01cdfe', '#b967ff', '#fffb96'] },
  { name: 'mushroom', bg: '#1c0d05', blend: 'source-over', colors: ['#e63b2e', '#f6e7c1', '#f5a623', '#7bd35a'] },
  { name: 'mono', bg: '#101010', blend: 'source-over', colors: ['#ffffff', '#8c8c8c', '#d9d9d9'] },
  { name: 'noir', bg: '#0a0a0a', blend: 'source-over', colors: ['#ff1e1e', '#f5f5f5', '#b30000'] },
  { name: 'ice', bg: '#e8f4ff', blend: 'multiply', colors: ['#003f8a', '#00a6a6', '#ff4fa3', '#4c6ef5'], light: true },
  { name: 'peach', bg: '#ffe5d0', blend: 'multiply', colors: ['#d72638', '#3f88c5', '#f49d37', '#140f2d'], light: true },
  { name: 'sepia', bg: '#1a120a', blend: 'lighter', colors: ['#e8c39e', '#c47a3a', '#fff1dc', '#8a4b1f'] },
  { name: 'technicolor', bg: '#0d0810', blend: 'lighter', colors: ['#ff3b3b', '#2dd4bf', '#ffd400', '#7b5cff'] },
] as const satisfies readonly PaletteSpec[];

export type PaletteName = (typeof SPECS)[number]['name'];

export const PALETTES: readonly Palette[] = SPECS.map((spec: PaletteSpec) => ({
  ...spec,
  rgb: spec.colors ? spec.colors.map(hexToRgb) : null,
  bgRgb: hexToRgb(spec.bg),
}));
