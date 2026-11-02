import { useCallback, useEffect, useRef, useState } from 'react';
import { readPushFlags } from '@/src/features/priceAlerts/pushClient';
import { pushArmed } from '@/src/features/priceAlerts/pushRegistration';
import { openWaitAlert } from '@/src/features/priceAlerts/waitEntry';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolvePricesConfig } from '@/src/lib/apiConfig';
import type { WatchAlertPreset, WatchRow } from './watchPresentation';

export type WatchAlerts = {
  /** False hides every presets row: alerts off, not mainnet, signed out or locked. */
  available: boolean;
  open: (row: WatchRow, preset: WatchAlertPreset) => void;
};

/**
 * The presets row's door into the EXISTING set-alert route.
 *
 * ⛔ No new alert, proof or signer code. A preset hands the route the same
 * entry Wait does (`openWaitAlert`), with `preset: null` (Watch has no Review,
 * so no swap preset is saved) and the preset's side and price to fill in.
 * The route keeps every check it already makes: the session is the entry's
 * owner, the wallet is unlocked, alerts are armed, and the person taps Set
 * alert in the sheet, which signs the existing ownership proof.
 *
 * The row is hidden, not refused, when alerts can't be set here: the same
 * two reads `openWaitAlert` makes (`/v1/config` push flags, mainnet), once
 * per mount.
 */
export function useWatchAlerts(): WatchAlerts {
  const { session, locked, liveSessionCell, lockStateCell } = useCorsoSession();
  const [armed, setArmed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void Promise.all([
      readPushFlags().catch(() => ({})),
      resolvePricesConfig().catch(() => null),
    ]).then(([flags, config]) => {
      if (!mounted.current) return;
      setArmed(
        pushArmed(flags) &&
          config?.network.state === 'known' &&
          config.network.cluster === 'mainnet-beta',
      );
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const open = useCallback(
    (row: WatchRow, preset: WatchAlertPreset) => {
      if (!session || locked || !armed || row.alertSymbol == null) return;
      void openWaitAlert(
        {
          owner: session,
          mint: row.mint,
          symbol: row.alertSymbol,
          cluster: 'mainnet-beta',
          preset: null,
          start: {
            direction: preset.direction,
            thresholdPrice: preset.thresholdPrice,
          },
        },
        () =>
          mounted.current &&
          liveSessionCell.current === session &&
          !lockStateCell.current,
      ).catch(() => {});
    },
    [session, locked, armed, liveSessionCell, lockStateCell],
  );

  return { available: armed && !!session && !locked, open };
}
