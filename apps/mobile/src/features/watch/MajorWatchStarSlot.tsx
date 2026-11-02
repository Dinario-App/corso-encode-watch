import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import { WatchStarButton } from '@/src/features/watchlist/WatchStarButton';
import { readWatchBuildFlag } from './watchEnv';

/**
 * The Watch star on the major face (SOL, cbBTC, ETH and the other
 * names `MajorDetailFace` draws). It is the long-tail page's own star and
 * writes the same on-device watchlist, so a major lands on Watch beside
 * anything starred elsewhere. No new words: `Watch` → `Watching`.
 *
 * Off (`EXPO_PUBLIC_FLAG_WATCH` unset or 0) it draws nothing and mounts no
 * store hook, so the face is unchanged. It sits in the face's top bar
 * between the title and the "…" menu, the same order as the long-tail page.
 */
export function MajorWatchStarSlot({
  mint,
  symbol,
  name,
}: {
  mint: string;
  symbol: string;
  name: string;
}) {
  if (!readWatchBuildFlag()) return null;
  return (
    <WatchStarButton
      mint={mint}
      symbol={symbol}
      name={name}
      labelWithheld={isModeratedTokenLabel({ name, symbol })}
      testID="major-detail-watch-star"
    />
  );
}
