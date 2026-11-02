/**
 * The Watch build flag.
 *
 * `EXPO_PUBLIC_FLAG_WATCH` is inlined by Expo at bundle time. It defaults OFF
 * and is declared through the exact `parseEnvFlag(input.X, '0')` shape the
 * private app's flag-default gate parses. No
 * profile sets it. Off: no Home entry, `/watch` goes back to Home, and nothing
 * of the Watch screen mounts, so no read is sent.
 */

export type WatchEnvInput = {
  EXPO_PUBLIC_FLAG_WATCH?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1')
    throw new Error('watch flag must be "0" or "1"');
  return raw === '1';
}

export function parseWatchEnv(input: WatchEnvInput = {}) {
  const on = parseEnvFlag(input.EXPO_PUBLIC_FLAG_WATCH, '0');
  return Object.freeze({ FLAG_WATCH: on });
}

/** A malformed value throws in tests; in a shipped bundle it reads off. */
export function readWatchBuildFlag(): boolean {
  try {
    return parseWatchEnv({
      EXPO_PUBLIC_FLAG_WATCH: process.env.EXPO_PUBLIC_FLAG_WATCH,
    }).FLAG_WATCH;
  } catch {
    return false;
  }
}
