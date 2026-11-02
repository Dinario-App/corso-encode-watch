import { useCallback, useMemo } from 'react';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useOnReconnect,
  useReadFailState,
} from '@/src/features/connectivity/useConnectivity';
import { useReportedTokens } from '@/src/features/moderation/reportedTokenStore';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { WatchScreen } from '@/src/features/watch/WatchScreen';
import { readWatchBuildFlag } from '@/src/features/watch/watchEnv';
import { presentWatch } from '@/src/features/watch/watchPresentation';
import { useWatchAlerts } from '@/src/features/watch/useWatchAlerts';
import { useWatchReads } from '@/src/features/watch/useWatchReads';
import { useWatchlist } from '@/src/features/watchlist/watchlistStore';
import { usePullRefresh } from '@/src/ui/primitives/usePullRefresh';

/**
 * Corso Watch. The Home entry only draws with
 * `EXPO_PUBLIC_FLAG_WATCH` on; this file re-reads the flag because a route
 * FILE is reachable by deep link whether or not an entry points at it. Off,
 * the link lands on Home and nothing of this screen mounts, so no read is
 * sent.
 */
export default function WatchRoot() {
  if (!readWatchBuildFlag()) return <Redirect href="/(app)" />;
  return <WatchRoute />;
}

function WatchRoute() {
  const watchlist = useWatchlist();
  // Apple 1.2 (GAP-3), as the Watchlist does it: a pair the person reported
  // leaves the list; the star itself is untouched.
  const reported = useReportedTokens();
  const tokens = useMemo(
    () => watchlist.tokens.filter((token) => !reported.mints.has(token.mint)),
    [watchlist.tokens, reported.mints],
  );
  const mints = useMemo(() => tokens.map((token) => token.mint), [tokens]);
  const reads = useWatchReads(mints, true);
  const alerts = useWatchAlerts();

  const { refresh } = reads;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const pull = usePullRefresh(refresh);
  const failState = useReadFailState();
  useOnReconnect(() => {
    void refresh();
  });

  return (
    <>
      <StatusBar style="light" />
      <WatchScreen
        model={presentWatch({
          hydrated: watchlist.hydrated,
          tokens,
          prices: reads.prices,
          why: reads.why,
          nowMs: Date.now(),
          failState,
        })}
        onBack={() => goBackOr(BACK_FALLBACK.shell)}
        onOpenRow={(mint) => router.push(`/asset/${mint}`)}
        onPreset={alerts.available ? alerts.open : undefined}
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
      />
    </>
  );
}
