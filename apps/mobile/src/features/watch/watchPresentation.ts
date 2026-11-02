import { copy } from '@/constants/copy';
import { watchCopy } from '@/constants/copy/watch';
import {
  CASH_STABLECOINS,
  getMajorAsset,
} from '@/src/features/balances/majors';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import { USDC_MINT_MAINNET } from '@/src/features/balances/usdcConstants';
import {
  readFailLine,
  type ReadFailState,
} from '@/src/features/connectivity/connectivity';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import {
  formatObservationClock,
  resolveMovingContext,
} from '@/src/features/home/asOfPresentation';
import {
  formatMarketsChange,
  type MarketsChange,
  type MarketsPricesRead,
} from '@/src/features/markets/marketsMovingPresentation';
import {
  alertLine,
  safeAlertSymbol,
} from '@/src/features/priceAlerts/alertCopy';
import {
  normalizeThreshold,
  type Direction,
} from '@/src/features/priceAlerts/alertModel';
import type { WatchedToken } from '@/src/features/watchlist/watchlistEntry';
import type { WhyRead } from '@/src/features/why/useWhy';
import {
  oneLineFor,
  type WhyLineView,
} from '@/src/features/why/whyPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';

/**
 * ── Corso Watch (FLAG_WATCH) ────────────────────────────────────────────────
 *
 * One row per watched token, in the watchlist's own order (newest star
 * first). Pure: no React, no network, no clock of its own.
 *
 * ── Where each figure comes from ───────────────────────────────────────────
 *   · price, its as-of and 24h: `GET /v1/prices` (`changePct24h` rides on the
 *     same line), read in batches of `MAX_PRICE_MINTS`.
 *   · the why line: `GET /v1/why?surface=moving`, the server's first line for
 *     the mint, as served. ⛔ The client never re-thresholds, re-ranks or
 *     reorders it: no line is a row without one.
 *   · the plain-risk facts: `usePlainRisk` in the row view, drawn as facts
 *     only (`PlainRiskFacts`). No level or badge.
 *
 * ⛔ The list is the person's own, so a row never leaves it because a read
 * failed. A row with no price shows its name only: never `$0`, a dash or
 * `0.0%`. One line under the section says the prices didn't load.
 */

export type WatchAlertPreset = {
  direction: Direction;
  /** A `normalizeThreshold` decimal string: what the sheet opens with. */
  thresholdPrice: string;
  /** The approved alert row line (`ALERT_COPY.rowAbove/rowBelow`). */
  label: string;
};

export type WatchRow = {
  key: string;
  mint: string;
  /** The label the row prints: the withheld word when moderation says so. */
  symbol: string;
  /** The stored symbol when it is a W5-safe alert ticker, else `null`. */
  alertSymbol: string | null;
  /** `null` → no price for this row: the row shows its name only. */
  price: string | null;
  change: MarketsChange | null;
  why: WhyLineView | null;
  /** Empty when no alert can be offered (no fresh price, unsafe ticker). */
  presets: readonly WatchAlertPreset[];
};

export type WatchModel =
  | { kind: 'loading'; label: string }
  | { kind: 'empty'; title: string; body: string }
  | {
      kind: 'loaded' | 'stale';
      label: string;
      /** The section's one as-of; `null` when no price is shown. */
      asOf: string | null;
      /** One line when prices are off or didn't load; else `null`. */
      notice: string | null;
      rows: WatchRow[];
    };

/** The presets' distance from the spot price, in percent, either way. */
export const WATCH_ALERT_PRESET_PCT = 10;
const CASH_MINTS: ReadonlySet<string> = new Set([
  USDC_MINT_MAINNET,
  ...CASH_STABLECOINS.map((coin) => coin.mint),
]);

const SCALE = 18;
const SIGNIFICANT = 4;
const ONE_DOLLAR = 10n ** BigInt(SCALE);
const CENT = 10n ** BigInt(SCALE - 2);

function toScaled(price: string): bigint | null {
  const normal = normalizeThreshold(price);
  if (normal == null) return null;
  const [whole, fraction = ''] = normal.split('.');
  return BigInt(whole + fraction.padEnd(SCALE, '0'));
}

function fromScaled(value: bigint): string | null {
  if (value <= 0n) return null;
  const digits = value.toString().padStart(SCALE + 1, '0');
  const fraction = digits.slice(-SCALE).replace(/0+$/, '');
  return normalizeThreshold(
    digits.slice(0, -SCALE) + (fraction ? `.${fraction}` : ''),
  );
}

/**
 * Keeps `SIGNIFICANT` digits, rounding away from the spot price. At $1 and
 * up it also stops at whole cents, so `1.099` becomes `1.10`: the threshold
 * the sheet saves is then exactly the price its label prints.
 */
function roundAway(value: bigint, mode: 'up' | 'down'): bigint {
  const length = value.toString().length;
  let unit = length <= SIGNIFICANT ? 1n : 10n ** BigInt(length - SIGNIFICANT);
  if (value >= ONE_DOLLAR && unit < CENT) unit = CENT;
  const floor = (value / unit) * unit;
  return mode === 'down' || floor === value ? floor : floor + unit;
}

/**
 * The two preset thresholds for a spot price: `WATCH_ALERT_PRESET_PCT` above
 * and below, at four significant digits (whole cents at $1 and up), each
 * rounded away from the spot so neither starts out crossed. The sheet still
 * re-reads the price and refuses a crossed one before anything is saved
 * (`refusal`).
 */
export function watchAlertThresholds(price: string): {
  above: string | null;
  below: string | null;
} {
  const spot = toScaled(price);
  if (spot == null || spot <= 0n) return { above: null, below: null };
  const pct = BigInt(WATCH_ALERT_PRESET_PCT);
  const above = roundAway((spot * (100n + pct)) / 100n, 'up');
  const below = roundAway((spot * (100n - pct)) / 100n, 'down');
  return {
    above: above > spot ? fromScaled(above) : null,
    below: below < spot ? fromScaled(below) : null,
  };
}

/**
 * The threshold as a display price for the pill: two decimals at $1 and up
 * (`1.1` → `1.10`, `165` → `165.00`), the threshold's own digits below $1.
 * It only pads zeros, so the label never names a price other than the one
 * the sheet saves.
 */
export function watchPresetLabelPrice(threshold: string): string {
  const [whole, fraction = ''] = threshold.split('.');
  if (BigInt(whole!) === 0n || fraction.length > 2) return threshold;
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

/**
 * A cash name (USDC, USDT, PYUSD) gets no presets row: ±10% on a
 * coin that holds near $1 never fires, and a ±1% stablecoin alert is not one
 * a person needs.
 */
export function watchAlertPresets(
  alertSymbol: string | null,
  price: string | null,
  mint: string | null = null,
): WatchAlertPreset[] {
  if (alertSymbol == null || price == null) return [];
  if (mint != null && CASH_MINTS.has(mint)) return [];
  const thresholds = watchAlertThresholds(price);
  const presets: WatchAlertPreset[] = [];
  for (const direction of ['above', 'below'] as const) {
    const thresholdPrice = thresholds[direction];
    if (thresholdPrice == null) continue;
    presets.push({
      direction,
      thresholdPrice,
      label: alertLine(
        'row',
        alertSymbol,
        direction,
        watchPresetLabelPrice(thresholdPrice),
      ),
    });
  }
  return presets;
}

export function presentWatch(args: {
  hydrated: boolean;
  tokens: readonly WatchedToken[];
  prices: MarketsPricesRead;
  why: WhyRead;
  nowMs: number;
  failState?: ReadFailState;
}): WatchModel {
  const label = copy.browse.watchlistSection;
  if (!args.hydrated) return { kind: 'loading', label };
  if (args.tokens.length === 0) {
    return {
      kind: 'empty',
      title: copy.watchlist.emptyTitle,
      body: watchCopy.emptyBody,
    };
  }
  if (args.prices.phase === 'pending') return { kind: 'loading', label };

  const whyResponse =
    args.why !== 'off' && args.why !== 'loading' ? args.why : null;
  const snapshot: PriceSnapshot | null =
    args.prices.phase === 'settled' ? args.prices.snapshot : null;
  const off = args.prices.phase === 'off' || snapshot?.status === 'disabled';
  const refreshFailed =
    args.prices.phase === 'settled' && args.prices.refreshFailed;

  let oldestAsOfMs = Number.POSITIVE_INFINITY;
  let overAge = false;
  let anyChange = false;
  const rows = args.tokens.map((token): WatchRow => {
    // The store upper-cases what it keeps (`CBBTC`), so a major
    // prints its own ticker (`cbBTC`), the one its coin page shows.
    const tokenSymbol = getMajorAsset(token.mint)?.symbol ?? token.symbol;
    const withheld = isModeratedTokenLabel({
      name: token.name ?? tokenSymbol,
      symbol: tokenSymbol,
    });
    const line = off
      ? undefined
      : snapshot?.lines.find((entry) => entry.mint === token.mint);
    const quote = line?.status === 'ok' ? line.quote : null;
    // ⛔ A zero or unreadable price is withheld, never rendered as `$0`.
    const price =
      quote && Number.isFinite(quote.asOfMs) && quote.asOfMs >= 0
        ? formatPriceUsd(quote.price)
        : null;
    let change: MarketsChange | null = null;
    if (quote && price != null) {
      oldestAsOfMs = Math.min(oldestAsOfMs, quote.asOfMs);
      if (args.nowMs - quote.asOfMs > quote.maxAgeMs) overAge = true;
      change = formatMarketsChange(quote.changePct24h);
      if (change) anyChange = true;
    }
    const alertSymbol = withheld ? null : safeAlertSymbol(tokenSymbol);
    return {
      key: token.mint,
      mint: token.mint,
      symbol: withheld ? copy.watchlist.withheldSymbol : tokenSymbol,
      alertSymbol,
      price,
      change,
      why: oneLineFor(whyResponse, token.mint),
      presets:
        price != null && quote != null
          ? watchAlertPresets(alertSymbol, quote.price, token.mint)
          : [],
    };
  });

  const shown = Number.isFinite(oldestAsOfMs);
  // One as-of for the section: the OLDEST shown price, so no row is newer
  // than the line claims. It names the 24h column only when a 24h is shown.
  const asOf = !shown
    ? null
    : anyChange
      ? resolveMovingContext(oldestAsOfMs)
      : (() => {
          const clock = formatObservationClock(oldestAsOfMs);
          return clock == null ? null : copy.diyLists.asOf(clock);
        })();
  // ⛔ A figure with no as-of is not shown: drop every price with the line.
  const priced = asOf != null;
  const finalRows = priced
    ? rows
    : rows.map((row) => ({ ...row, price: null, change: null, presets: [] }));
  const notice = off
    ? copy.diyLists.pricesUnavailable
    : !priced
      ? readFailLine(args.failState, copy.diyLists.pricesUnavailable)
      : null;

  return {
    kind: refreshFailed || overAge ? 'stale' : 'loaded',
    label,
    asOf,
    notice,
    rows: finalRows,
  };
}
