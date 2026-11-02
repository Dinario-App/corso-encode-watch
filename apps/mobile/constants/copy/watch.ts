/**
 * Corso Watch, behind
 * `EXPO_PUBLIC_FLAG_WATCH` (default off).
 *
 * The screen reuses approved words wherever one exists: the title is
 * `copy.watchlist.watch`, the section `copy.browse.watchlistSection`, the
 * empty title `copy.watchlist.emptyTitle`, and the presets are the approved
 * alert rows (`ALERT_COPY.rowAbove/rowBelow`, `ALERT_COPY.set`).
 *
 * ⛔ New customer-facing copy says what to tap and what happens, never buy,
 *    sell or "should".
 * ⛔ Not `copy.watchlist.emptyBody`: that line promises a verdict, and Watch
 *    draws none.
 */
export const watchCopy = {
  emptyBody: 'Tap Watch on a coin’s page to see it here.',
} as const;
