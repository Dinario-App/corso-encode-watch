/** UTC calendar day. The once-per-day claim is this string, not a local midnight. */
export function watchDigestDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
