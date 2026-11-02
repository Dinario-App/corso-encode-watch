import type { Context } from 'hono';
import { z } from 'zod';
import { isValidPriceMint } from '../prices/types.js';
import { WATCH_DIGEST_MAX_WATCHES } from './copy.js';
import type { WatchDigestDeviceLookup, WatchDigestStore } from './store.js';

/**
 * PUT /v1/watch-digest/watches
 *
 * The body is `{ id, receipt, mints }`. `id` and `receipt` are the existing
 * confirmed price-alert device. This route does not call the ownership
 * proof signer. A match replaces that wallet's watched mints. An empty list
 * clears them. The response is `{ ok: true, count }` and does not echo the
 * wallet.
 */
const Body = z
  .object({
    id: z.string().uuid(),
    receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    mints: z.array(z.string()).max(WATCH_DIGEST_MAX_WATCHES),
  })
  .strict();

export type WatchDigestRouteDependencies = {
  store: WatchDigestStore;
  devices: WatchDigestDeviceLookup;
};

function reply(c: Context, status: 200 | 400 | 401 | 413 | 503, body: unknown) {
  c.header('Cache-Control', 'private, no-store');
  return c.json(body, status);
}

export function createWatchDigestHandlers(
  deps: WatchDigestRouteDependencies | undefined,
) {
  return {
    tooLarge(c: Context) {
      return reply(c, 413, { error: 'invalid_request' });
    },
    async replace(c: Context) {
      if (!deps?.store || !deps.devices) {
        return reply(c, 503, { error: 'watch_digest_unavailable' });
      }
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return reply(c, 400, { error: 'invalid_request' });
      }
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return reply(c, 400, { error: 'invalid_request' });
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const mint of parsed.data.mints) {
        if (seen.has(mint)) continue;
        if (!isValidPriceMint(mint, 'mainnet-beta')) {
          return reply(c, 400, { error: 'invalid_request' });
        }
        seen.add(mint);
        unique.push(mint);
      }
      let wallet: string | null;
      try {
        wallet = await deps.devices.confirmedWallet(
          parsed.data.id,
          parsed.data.receipt,
        );
      } catch {
        return reply(c, 503, { error: 'watch_digest_unavailable' });
      }
      if (!wallet) return reply(c, 401, { error: 'unauthorized' });
      let stored = false;
      try {
        stored = await deps.store.replaceWatches(wallet, unique);
      } catch {
        stored = false;
      }
      if (!stored) return reply(c, 503, { error: 'watch_digest_unavailable' });
      return reply(c, 200, { ok: true, count: unique.length });
    },
  };
}
