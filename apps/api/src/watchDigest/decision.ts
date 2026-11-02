export type WatchDigestDecision = 'skip' | 'send';

/**
 * One push per wallet per day, and only when at least one watched token
 * moved. A wallet with no confirmed device is skipped so a later confirm
 * the same day can still send. An already-sent day never sends again.
 */
export function watchDigestDecision(input: {
  armed: boolean;
  moved: number;
  alreadySent: boolean;
  deviceCount: number;
}): WatchDigestDecision {
  if (!input.armed) return 'skip';
  if (input.alreadySent) return 'skip';
  if (input.deviceCount < 1) return 'skip';
  if (!Number.isInteger(input.moved) || input.moved < 1) return 'skip';
  return 'send';
}
