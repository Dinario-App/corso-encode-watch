import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { readWatchBuildFlag } from './watchEnv';

export const WATCH_HREF = '/watch' as Href;

/**
 * The one way in to Watch: a ground-tray row under Home's book.
 * Off (`EXPO_PUBLIC_FLAG_WATCH` unset or 0) it draws nothing and reads
 * nothing, so Home is unchanged. It imports only its flag module and drawing
 * primitives: no store, no session, no read.
 */
export function WatchEntry() {
  if (!readWatchBuildFlag()) return null;
  // Home's own door shape (`HomeBook` tray entries): a 44 dp row on a ground
  // tray, the label in primary ink and a tertiary chevron.
  return (
    <View style={{ marginBottom: 14 }}>
      <Pressable
        testID="home-watch-entry"
        accessibilityRole="button"
        accessibilityLabel={copy.watchlist.watch}
        onPress={() => router.push(WATCH_HREF)}
      >
        <EthenaTray
          testID="home-watch-entry-tray"
          style={{
            marginHorizontal: ethenaGeometry.gutter,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
            }}
          >
            <CorsoText
              style={{
                ...ETHENA_TYPE.rowName,
                flex: 1,
                color: ethena.ink.primary,
              }}
            >
              {copy.watchlist.watch}
            </CorsoText>
            <CorsoIcon
              name="chevron-right"
              size={16}
              color={ethena.ink.tertiary}
            />
          </View>
        </EthenaTray>
      </Pressable>
    </View>
  );
}
