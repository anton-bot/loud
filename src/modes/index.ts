/** All modes, in the order of the style menu and the ‹ › buttons. New modes go at the end. */
import { ascii } from './ascii';
import { attractor } from './attractor';
import { bars } from './bars';
import { blocks } from './blocks';
import { bounce } from './bounce';
import { coral } from './coral';
import { corrupt } from './corrupt';
import { cutout } from './cutout';
import { cymatics } from './cymatics';
import { datamatics } from './datamatics';
import { eightBit } from './eightBit';
import { embers } from './embers';
import { f1 } from './f1';
import { film } from './film';
import { fireworks } from './fireworks';
import { flow } from './flow';
import { grid } from './grid';
import { halftone } from './halftone';
import { halo } from './halo';
import { inkMode } from './ink';
import { julia } from './julia';
import { kaleido } from './kaleido';
import { lasers } from './lasers';
import { mandala } from './mandala';
import { matrix } from './matrix';
import { melt } from './melt';
import type { Mode } from './mode';
import { moire } from './moire';
import { mosh } from './mosh';
import { murmur } from './murmur';
import { nebula } from './nebula';
import { neon } from './neon';
import { neonKnot } from './neonKnot';
import { neonStrings } from './neonStrings';
import { neonTesla } from './neonTesla';
import { orb } from './orb';
import { parallax } from './parallax';
import { pixels } from './pixels';
import { plasma } from './plasma';
import { rays } from './rays';
import { ridges } from './ridges';
import { ripples } from './ripples';
import { scope } from './scope';
import { shroom } from './shroom';
import { slime } from './slime';
import { smear } from './smear';
import { solids } from './solids';
import { spiral } from './spiral';
import { spiro } from './spiro';
import { splats } from './splats';
import { sprites } from './sprites';
import { strings } from './strings';
import { terrain } from './terrain';
import { tree } from './tree';
import { tunnel } from './tunnel';
import { words } from './words';

export type { Mode } from './mode';

export const MODES: readonly Mode[] = [
  nebula,
  halo,
  tunnel,
  kaleido,
  grid,
  flow,
  fireworks,
  scope,
  bars,
  splats,
  words,
  blocks,
  rays,
  spiral,
  strings,
  bounce,
  halftone,
  ripples,
  ascii,
  cutout,
  terrain,
  ridges,
  mandala,
  plasma,
  melt,
  julia,
  moire,
  spiro,
  shroom,
  tree,
  matrix,
  pixels,
  mosh,
  sprites,
  corrupt,
  lasers,
  embers,
  neon,
  orb,
  film,
  slime,
  coral,
  cymatics,
  datamatics,
  attractor,
  murmur,
  eightBit,
  neonStrings,
  neonTesla,
  neonKnot,
  solids,
  inkMode,
  parallax,
  smear,
  f1,
];
