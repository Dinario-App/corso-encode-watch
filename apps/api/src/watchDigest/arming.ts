import type { AppEnv } from '../env.js';

/**
 * The daily Watch digest reads 24h moves, which are vendor prices.
 * Off unless both flags are on. The body stays one expression so the arming
 * gate can see both names.
 */
export function isWatchDigestArmed(
  env: Pick<AppEnv, 'FLAG_WATCH_DIGEST' | 'FLAG_PRICES'>,
): boolean {
  return env.FLAG_WATCH_DIGEST && env.FLAG_PRICES;
}
