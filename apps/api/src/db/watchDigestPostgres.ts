import postgres from 'postgres';
import { isValidPriceMint } from '../prices/types.js';
import { WATCH_DIGEST_MAX_WATCHES } from '../watchDigest/copy.js';
import { WATCH_DIGEST_PASS_LIMIT } from '../watchDigest/sweep.js';
import type { WatchDigestStore } from '../watchDigest/store.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  return new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day;
}

function isWallet(wallet: string): boolean {
  return isValidPriceMint(wallet, 'mainnet-beta');
}

/**
 * Collapse duplicates and refuse an invalid mint or a list over the cap.
 * Empty is a clear, not a refusal.
 */
function canonicalMints(mints: readonly string[]): string[] | null {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const mint of mints) {
    if (seen.has(mint)) continue;
    if (!isValidPriceMint(mint, 'mainnet-beta')) return null;
    seen.add(mint);
    unique.push(mint);
    if (unique.length > WATCH_DIGEST_MAX_WATCHES) return null;
  }
  return unique;
}

export function createWatchDigestPostgres(databaseUrl: string): WatchDigestStore & {
  close(): Promise<void>;
} {
  const client = postgres(databaseUrl, { prepare: false });
  return {
    async listPendingWallets(day, limit, after) {
      if (!isDay(day) || !Number.isInteger(limit) || limit < 1) return [];
      const cap = Math.min(limit, WATCH_DIGEST_PASS_LIMIT);
      const cursor = typeof after === 'string' && after.length > 0 ? after : null;
      if (cursor && !isWallet(cursor)) return [];
      // COLLATE "C" is byte order, the same order JavaScript uses for these
      // ASCII wallet strings. A database locale such as en_US would put "ax"
      // before "Bx" and disagree with a JavaScript cursor check.
      const rows = cursor
        ? await client<{ wallet_address: string }[]>`
            select wallet_address
            from (
              select distinct w.wallet_address
              from watch_digest_watches w
              where not exists (
                select 1 from watch_digest_sends s
                where s.wallet_address = w.wallet_address
                  and s.day = ${day}::date
              )
              and exists (
                select 1 from price_alert_devices d
                where d.wallet_address = w.wallet_address
                  and d.confirmed_at is not null
              )
              and (w.wallet_address collate "C") > (${cursor} collate "C")
            ) pending
            order by wallet_address collate "C"
            limit ${cap}
          `
        : await client<{ wallet_address: string }[]>`
            select wallet_address
            from (
              select distinct w.wallet_address
              from watch_digest_watches w
              where not exists (
                select 1 from watch_digest_sends s
                where s.wallet_address = w.wallet_address
                  and s.day = ${day}::date
              )
              and exists (
                select 1 from price_alert_devices d
                where d.wallet_address = w.wallet_address
                  and d.confirmed_at is not null
              )
            ) pending
            order by wallet_address collate "C"
            limit ${cap}
          `;
      return rows.map((row) => row.wallet_address);
    },
    async mintsFor(wallet) {
      if (!isWallet(wallet)) return [];
      const rows = await client<{ mint: string }[]>`
        select mint from watch_digest_watches
        where wallet_address = ${wallet}
        order by mint
      `;
      return rows.map((row) => row.mint);
    },
    async confirmedTokens(wallet) {
      if (!isWallet(wallet)) return [];
      const rows = await client<{ token: string }[]>`
        select token from price_alert_devices
        where wallet_address = ${wallet}
          and confirmed_at is not null
        order by token
      `;
      return rows.map((row) => row.token);
    },
    async claim(wallet, day, moved) {
      if (!isWallet(wallet) || !isDay(day)) return false;
      if (
        !Number.isInteger(moved) ||
        moved < 1 ||
        moved > WATCH_DIGEST_MAX_WATCHES
      ) {
        return false;
      }
      const rows = await client<{ wallet_address: string }[]>`
        insert into watch_digest_sends (wallet_address, day, moved_count)
        values (${wallet}, ${day}::date, ${moved})
        on conflict (wallet_address, day) do nothing
        returning wallet_address
      `;
      return rows.length === 1;
    },
    async replaceWatches(wallet, mints) {
      if (!isWallet(wallet)) return false;
      const unique = canonicalMints(mints);
      if (!unique) return false;
      await client.begin(async (sql) => {
        await sql`
          delete from watch_digest_watches where wallet_address = ${wallet}
        `;
        for (const mint of unique) {
          await sql`
            insert into watch_digest_watches (wallet_address, mint)
            values (${wallet}, ${mint})
          `;
        }
      });
      return true;
    },
    close: () => client.end({ timeout: 5 }),
  };
}
