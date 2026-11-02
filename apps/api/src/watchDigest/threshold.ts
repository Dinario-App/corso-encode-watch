/** Absolute 24h move, in percent, that counts toward the daily digest. */
export const WATCH_DIGEST_MOVE_PERCENT = 10;

/**
 * True when the vendor reported a finite 24h change whose magnitude is
 * greater than 10. Exactly 10 does not count. A missing or non-finite
 * change does not count, and is never treated as zero.
 */
export function movedMoreThanTenPercent(changePct24h: number | null): boolean {
  if (typeof changePct24h !== 'number' || !Number.isFinite(changePct24h)) {
    return false;
  }
  return Math.abs(changePct24h) > WATCH_DIGEST_MOVE_PERCENT;
}

export function countMovedWatches(
  mints: readonly string[],
  changes: ReadonlyMap<string, number | null>,
): number {
  let moved = 0;
  for (const mint of mints) {
    if (movedMoreThanTenPercent(changes.get(mint) ?? null)) moved += 1;
  }
  return moved;
}
