/**
 * Push copy. It says what happened. It does not
 * say buy, sell, or should.
 *
 * Title, for a count of 3: "3 of your watched tokens moved more than 10%"
 * Body: "Open Watch."
 * Push data is exactly `{ screen: "watch" }`, which opens the Watch screen.
 */
export const WATCH_DIGEST_PUSH_BODY = 'Open Watch.';
export const WATCH_DIGEST_PUSH_SCREEN = 'watch' as const;
export const WATCH_DIGEST_MAX_WATCHES = 24;

export function watchDigestPushTitle(count: number): string | null {
  if (!Number.isInteger(count) || count < 1 || count > WATCH_DIGEST_MAX_WATCHES) {
    return null;
  }
  return `${count} of your watched tokens moved more than 10%`;
}
