export type Mulberry32State = { algo: "mulberry32"; state: number };

export function rngFromSeed(seed: number): Mulberry32State {
  // Ensure uint32. Avoid 0 to keep cycle healthy.
  const s = (seed >>> 0) || 1;
  return { algo: "mulberry32", state: s };
}

export function rngNextUint32(rng: Mulberry32State): [number, Mulberry32State] {
  let t = (rng.state + 0x6d2b79f5) >>> 0;
  let x = t;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  const out = (x ^ (x >>> 14)) >>> 0;
  return [out, { algo: "mulberry32", state: t }];
}

export function rngNextFloat01(rng: Mulberry32State): [number, Mulberry32State] {
  const [u, next] = rngNextUint32(rng);
  return [u / 0x1_0000_0000, next];
}

