import type { FetchPricesResult } from '@/src/features/balances/fetchPrices';
import {
  MAX_PRICE_MINTS,
  type PriceSnapshot,
} from '@/src/features/balances/priceSnapshot';
import { loadPriceQuotes } from '@/src/features/balances/usePriceQuotes';
import type { MarketsPricesRead } from '@/src/features/markets/marketsMovingPresentation';
import { resolvePricesConfig, type PricesConfig } from '@/src/lib/apiConfig';
import type { WhyResponse } from '@corso/why';
import { WHY_CLIENT_MAX_MINTS, fetchWhy } from '@/src/features/why/whyClient';

/**
 * ── Corso Watch reads ───────────────────────────────────────────────────────
 *
 * ⛔ No new API. Prices go through `loadPriceQuotes` (`GET /v1/prices`), the
 * why lines through `fetchWhy` (`GET /v1/why?surface=moving`). Both take at
 * most ten mints a request and the watchlist holds up to 24, so each read is
 * cut into batches in the list's own order. Nothing is cached on disk.
 */

/** `[a,b,c,d,e]` in twos → `[[a,b],[c,d],[e]]`. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    out.push(items.slice(start, start + size));
  }
  return out;
}

/**
 * The batches as one snapshot. A failed batch leaves its mints unpriced
 * (their rows show their names only); every batch failing is `null`. A
 * `disabled` answer from any batch is the flag, so the whole read is off.
 */
export function mergeSnapshots(
  parts: readonly (PriceSnapshot | null)[],
): PriceSnapshot | null {
  const read = parts.filter((part): part is PriceSnapshot => part != null);
  if (read.length === 0) return null;
  const disabled = read.find((part) => part.status === 'disabled');
  if (disabled) return disabled;
  const [first] = read;
  const lines = read.flatMap((part) => part.lines);
  return {
    ...first!,
    status:
      read.length === parts.length && read.every((p) => p.status === 'ready')
        ? 'ready'
        : 'partial',
    asOfMs: Math.min(...read.map((part) => part.asOfMs)),
    lines,
    sources: [...new Set(read.flatMap((part) => part.sources))],
  };
}

export type WatchPricesDeps = {
  resolveConfig?: () => Promise<PricesConfig>;
  loadQuotes?: typeof loadPriceQuotes;
};

/** Always settles: a throw anywhere is `off` or a null snapshot. */
export async function readWatchPrices(
  mints: readonly string[],
  deps: WatchPricesDeps = {},
): Promise<MarketsPricesRead> {
  let config: PricesConfig;
  try {
    config = await (deps.resolveConfig ?? resolvePricesConfig)();
  } catch {
    return { phase: 'off' };
  }
  // ⛔ Off: no request.
  if (!config.pricesEnabled) return { phase: 'off' };
  if (mints.length === 0) {
    return { phase: 'settled', snapshot: null, refreshFailed: false };
  }
  const load = deps.loadQuotes ?? loadPriceQuotes;
  const parts = await Promise.all(
    batches(mints, MAX_PRICE_MINTS).map(async (batch) => {
      let result: FetchPricesResult;
      try {
        result = await load({
          resolveConfig: async () => config,
          mints: batch,
        });
      } catch {
        return null;
      }
      return result.ok ? result.snapshot : null;
    }),
  );
  return {
    phase: 'settled',
    snapshot: mergeSnapshots(parts),
    refreshFailed: false,
  };
}

/**
 * A later read (focus, pull). A failure holds the last good snapshot and
 * marks it, so the section goes `stale` instead of blanking.
 */
export async function refreshWatchPrices(
  mints: readonly string[],
  previous: MarketsPricesRead,
  deps: WatchPricesDeps = {},
): Promise<MarketsPricesRead> {
  const next = await readWatchPrices(mints, deps);
  if (
    next.phase === 'settled' &&
    next.snapshot == null &&
    previous.phase === 'settled' &&
    previous.snapshot != null
  ) {
    return { ...previous, refreshFailed: true };
  }
  return next;
}

export type WatchWhyDeps = { fetchWhyImpl?: typeof fetchWhy };

/**
 * The why lines for every watched mint, one `moving` read per ten. The
 * answers are joined as served: items keep the server's order and lines, and
 * nothing is filtered or ranked here. A failed batch drops only
 * its own mints' lines; `disabled` from any batch is the server flag, so the
 * whole read is that answer and no line draws.
 */
export async function readWatchWhy(
  mints: readonly string[],
  enabled: boolean,
  signal?: AbortSignal,
  deps: WatchWhyDeps = {},
): Promise<WhyResponse | null> {
  if (!enabled || mints.length === 0) return null;
  const fetchImpl = deps.fetchWhyImpl ?? fetchWhy;
  const parts = await Promise.all(
    batches(mints, WHY_CLIENT_MAX_MINTS.moving).map((batch) =>
      fetchImpl({ enabled, surface: 'moving', mints: batch, signal }).catch(
        () => null,
      ),
    ),
  );
  const read = parts.filter((part): part is WhyResponse => part != null);
  if (read.length === 0) return null;
  const ready: Extract<WhyResponse, { state: 'ready' }>[] = [];
  for (const part of read) {
    if (part.state !== 'ready') return part;
    ready.push(part);
  }
  return { ...ready[0]!, items: ready.flatMap((part) => part.items) };
}
