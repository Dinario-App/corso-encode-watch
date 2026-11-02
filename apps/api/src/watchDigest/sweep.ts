import {
  WATCH_DIGEST_PUSH_BODY,
  watchDigestPushTitle,
} from './copy.js';
import { watchDigestDay } from './day.js';
import { watchDigestDecision } from './decision.js';
import type { WatchDigestStore } from './store.js';
import { countMovedWatches } from './threshold.js';

/** One pass every fifteen minutes. The claim, not the interval, is the daily cap. */
export const WATCH_DIGEST_LOOP_MS = 15 * 60 * 1000;
export const WATCH_DIGEST_PASS_LIMIT = 50;

export type WatchDigestPush = {
  send(message: {
    token: string;
    title: string;
    body: string;
  }): Promise<{ ok: boolean }>;
};

export type WatchChangeLookup = ReadonlyMap<
  string,
  { changePct24h?: number | null }
> | null;

/**
 * `null` from the price source is an upstream failure: the caller must not
 * claim the day. A mint the vendor omitted is a null change, which does not
 * count as a move.
 */
export function watchDigestChangesFromLookup(
  found: WatchChangeLookup,
  mints: readonly string[],
): ReadonlyMap<string, number | null> | null {
  if (found === null) return null;
  const changes = new Map<string, number | null>();
  for (const mint of mints) {
    const change = found.get(mint)?.changePct24h;
    changes.set(
      mint,
      typeof change === 'number' && Number.isFinite(change) ? change : null,
    );
  }
  return changes;
}

function logPassFailed(): void {
  console.warn(JSON.stringify({ event: 'watch_digest_pass_failed' }));
}

function logPushFailed(): void {
  console.warn(JSON.stringify({ event: 'watch_digest_push_failed' }));
}

/**
 * One pass. A wallet is claimed only after a confirmed device and a non-zero
 * mover count. The claim is written before the push, so a crash or a provider
 * failure still consumes the UTC day. A price-source failure stops the pass
 * and claims nothing for the wallet in hand or the ones after it.
 *
 * Pages walk `wallet_address` with an exclusive cursor. A wallet that is
 * skipped (no device, or nothing moved) is not claimed, so the next page
 * must start after it. Re-reading the same first page would starve every
 * wallet that sorts later. The stop check is identity, not JavaScript
 * string order: Postgres may collate "ax" before "Bx".
 */
export async function runWatchDigestPass(input: {
  armed: boolean;
  now: Date;
  store: WatchDigestStore;
  readChanges: (
    mints: readonly string[],
  ) => Promise<ReadonlyMap<string, number | null> | null>;
  push: WatchDigestPush;
  limit?: number;
}): Promise<void> {
  if (!input.armed) return;
  const day = watchDigestDay(input.now);
  const pageSize = Math.min(
    input.limit ?? WATCH_DIGEST_PASS_LIMIT,
    WATCH_DIGEST_PASS_LIMIT,
  );
  let after: string | null = null;
  for (;;) {
    let wallets: string[];
    try {
      wallets = await input.store.listPendingWallets(day, pageSize, after);
    } catch {
      logPassFailed();
      return;
    }
    if (wallets.length === 0) return;
    const tail = wallets[wallets.length - 1];
    if (!tail || tail === after) return;
    for (const wallet of wallets) {
      try {
        const tokens = await input.store.confirmedTokens(wallet);
        if (tokens.length < 1) continue;
        const mints = await input.store.mintsFor(wallet);
        const changes = await input.readChanges(mints);
        if (changes === null) return;
        const moved = countMovedWatches(mints, changes);
        if (
          watchDigestDecision({
            armed: true,
            moved,
            alreadySent: false,
            deviceCount: tokens.length,
          }) !== 'send'
        ) {
          continue;
        }
        const claimed = await input.store.claim(wallet, day, moved);
        if (!claimed) continue;
        const title = watchDigestPushTitle(moved);
        if (!title) continue;
        for (const token of tokens) {
          try {
            const result = await input.push.send({
              token,
              title,
              body: WATCH_DIGEST_PUSH_BODY,
            });
            if (!result.ok) logPushFailed();
          } catch {
            logPushFailed();
          }
        }
      } catch {
        logPassFailed();
      }
    }
    after = tail;
    if (wallets.length < pageSize) return;
  }
}

/** Starts the timer only when armed. Flag off is zero ticks. */
export function startWatchDigestLoop(input: {
  armed: boolean;
  intervalMs?: number;
  run: () => Promise<void>;
}): { stop(): void } {
  if (!input.armed) return { stop() {} };
  const intervalMs = input.intervalMs ?? WATCH_DIGEST_LOOP_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    void input
      .run()
      .catch(() => {
        logPassFailed();
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, intervalMs);
      });
  };
  timer = setTimeout(tick, intervalMs);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
