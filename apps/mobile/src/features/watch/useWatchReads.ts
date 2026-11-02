import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketsPricesRead } from '@/src/features/markets/marketsMovingPresentation';
import type { WhyRead } from '@/src/features/why/useWhy';
import {
  readWatchPrices,
  readWatchWhy,
  refreshWatchPrices,
} from './watchReads';

export type WatchReads = {
  prices: MarketsPricesRead;
  why: WhyRead;
  /** Re-reads prices (focus, pull). Settles when the read does. */
  refresh: () => Promise<void>;
};

/**
 * Watch's reads for the current mint set: prices on mount, on a new set and on
 * `refresh`; the why lines once per mint set (no polling, no cache: a line
 * that *was* true is not shown as one that is).
 */
export function useWatchReads(
  mints: readonly string[],
  whyEnabled: boolean,
): WatchReads {
  const key = mints.join(',');
  const [prices, setPrices] = useState<MarketsPricesRead>({ phase: 'pending' });
  const [why, setWhy] = useState<WhyRead>(whyEnabled ? 'loading' : 'off');
  const latest = useRef({ key, prices });
  latest.current = { key, prices };

  useEffect(() => {
    let live = true;
    const list = key.length === 0 ? [] : key.split(',');
    void readWatchPrices(list).then((next) => {
      if (live) setPrices(next);
    });
    if (!whyEnabled || list.length === 0) {
      setWhy('off');
      return () => {
        live = false;
      };
    }
    setWhy('loading');
    const controller = new AbortController();
    void readWatchWhy(list, whyEnabled, controller.signal).then((response) => {
      if (live) setWhy(response?.state === 'disabled' ? 'off' : response);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [key, whyEnabled]);

  const refresh = useCallback(async () => {
    const { key: at, prices: previous } = latest.current;
    if (previous.phase === 'pending') return;
    const next = await refreshWatchPrices(
      at.length === 0 ? [] : at.split(','),
      previous,
    );
    if (latest.current.key === at) setPrices(next);
  }, []);

  return { prices, why, refresh };
}
