/** A full turn in radians. */
export const TAU = Math.PI * 2;

/** Random number in [min, max). */
export function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in [0, n). */
export function rndInt(n: number): number {
  return Math.floor(Math.random() * n);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** `i` wrapped into [0, n), also for negative `i`. */
export function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * Moves `value` toward `target` by a fraction of the gap: `rise` when the target
 * is higher, `fall` when it is lower. Fast attack and slow release, for example.
 */
export function follow(value: number, target: number, rise: number, fall: number): number {
  return value + (target - value) * (target > value ? rise : fall);
}

/** Random item of `items`. When there is a choice, never `not`. */
export function pick<T>(items: readonly T[], not?: T): T {
  let item: T;
  do {
    item = items[rndInt(items.length)];
  } while (items.length > 1 && item === not);
  return item;
}

/** Cheap repeatable pseudo-random number in [0, 1) for a seed. */
export function hash01(seed: number): number {
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}
