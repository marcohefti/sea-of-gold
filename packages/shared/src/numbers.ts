export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function parseNonNegIntLike(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (!Number.isInteger(value)) return null;
    if (value < 0) return null;
    return BigInt(value);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!/^\d+$/.test(s)) return null;
    try {
      return BigInt(s);
    } catch {
      return null;
    }
  }
  return null;
}

export function bigintToJsonNumberString(v: bigint): string {
  return v.toString(10);
}

