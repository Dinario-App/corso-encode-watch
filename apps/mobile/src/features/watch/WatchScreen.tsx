import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { ALERT_COPY } from '@/src/features/priceAlerts/alertCopy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  EthenaDirection,
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { PlainRiskFacts } from '@/src/ui/risk/PlainRiskFacts';
import type {
  WatchAlertPreset,
  WatchModel,
  WatchRow,
} from './watchPresentation';

/**
 * Corso Watch, flag-on only.
 *
 * One tray, one row per watched token: the name, price and 24h on the first
 * line; under it the server's why line, the plain-risk facts, and the alert
 * presets row. Read-only: a row opens `/asset/[mint]`, a preset opens the
 * existing set-alert sheet. ⛔ Nothing here quotes, sizes, signs or opens
 * Swap. `reviewABuySlot` is an empty mount point for a later Review action;
 * nothing fills it in this code.
 *
 * Glass law: content is solid. The tray is `EthenaTray` (ground), the presets
 * are ground pills (never glass), and the only
 * glass on the way here is the shell's.
 *
 * ⛔ Every first line is `WATCH_ROW_HEIGHT` tall, skeleton included, so
 * loading → loaded moves nothing.
 */
export const WATCH_ROW_HEIGHT = 44;
/** Three placeholder rows, keyed by their own number. */
const SKELETON_ROWS = [0, 1, 2] as const;

export type WatchScreenProps = {
  model: WatchModel;
  onBack: () => void;
  onOpenRow: (mint: string) => void;
  /**
   * Opens the set-alert sheet for a row, with a preset's side and price
   * filled in. Absent (alerts off, signed out, not mainnet): no presets row.
   */
  onPreset?: (row: WatchRow, preset: WatchAlertPreset) => void;
  /**
   * An optional slot under a row's presets. Mounted only when it returns a
   * node. Nothing passes it today: the Review entry lives in the private app.
   */
  reviewABuySlot?: (row: WatchRow) => ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function WatchScreen({
  model,
  onBack,
  onOpenRow,
  onPreset,
  reviewABuySlot,
  refreshing = false,
  onRefresh,
}: WatchScreenProps) {
  const scrollFade = useScrollLinkedFadeTop();
  return (
    <EthenaGround>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={copy.watchlist.watch}
          onBack={onBack}
          backAccessibilityLabel={copy.v1.back}
          testID="watch-header"
        />
        {/* The box the fade pins to carries no padding (spec §2.9). */}
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            {...scrollFade.scroller}
            testID="watch"
            contentContainerStyle={{ paddingBottom: 64 }}
            contentInsetAdjustmentBehavior="never"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={ethena.ink.primary}
                  colors={[ethena.ink.primary]}
                  progressBackgroundColor={ethena.crest}
                />
              ) : undefined
            }
          >
            <WatchBody
              model={model}
              onOpenRow={onOpenRow}
              onPreset={onPreset}
              reviewABuySlot={reviewABuySlot}
            />
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
            testID="watch-fade-top"
          />
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

function WatchBody({
  model,
  onOpenRow,
  onPreset,
  reviewABuySlot,
}: Pick<
  WatchScreenProps,
  'model' | 'onOpenRow' | 'onPreset' | 'reviewABuySlot'
>) {
  if (model.kind === 'empty') {
    return (
      <View
        testID="watch-empty"
        style={{
          paddingHorizontal: ethenaGeometry.gutter,
          paddingTop: 32,
          rowGap: 8,
        }}
      >
        <CorsoText
          accessibilityRole="header"
          style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
        >
          {model.title}
        </CorsoText>
        <CorsoText style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}>
          {model.body}
        </CorsoText>
      </View>
    );
  }

  const header = (asOf: string | null) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: 8,
        flexWrap: 'wrap',
        paddingHorizontal: ethenaGeometry.gutter,
        paddingTop: 18,
        paddingBottom: 8,
      }}
    >
      <CorsoText
        testID="watch-label"
        accessibilityRole="header"
        style={{ ...ETHENA_TYPE.section, color: ethena.ink.secondary }}
      >
        {model.label}
      </CorsoText>
      {asOf ? (
        <CorsoText
          testID="watch-as-of"
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {asOf}
        </CorsoText>
      ) : null}
    </View>
  );

  if (model.kind === 'loading') {
    return (
      <>
        {header(null)}
        <EthenaTray
          testID="watch-tray"
          style={{ marginHorizontal: ethenaGeometry.gutter }}
        >
          {SKELETON_ROWS.map((index) => (
            <View
              key={index}
              testID={`watch-skeleton-${index}`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ height: WATCH_ROW_HEIGHT, justifyContent: 'center' }}
            >
              <View
                style={{
                  height: WATCH_ROW_HEIGHT - 14,
                  borderRadius: 6,
                  backgroundColor: ethena.crest,
                }}
              />
            </View>
          ))}
        </EthenaTray>
      </>
    );
  }

  const stale = model.kind === 'stale';
  return (
    <>
      {header(model.asOf)}
      {model.notice ? (
        <CorsoText
          testID="watch-notice"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            paddingHorizontal: ethenaGeometry.gutter,
            paddingBottom: 8,
          }}
        >
          {model.notice}
        </CorsoText>
      ) : null}
      <EthenaTray
        testID="watch-tray"
        style={{ marginHorizontal: ethenaGeometry.gutter }}
      >
        {model.rows.map((row, index) => (
          <WatchRowView
            key={row.key}
            row={row}
            stale={stale}
            last={index === model.rows.length - 1}
            onOpenRow={onOpenRow}
            onPreset={onPreset}
            reviewABuySlot={reviewABuySlot}
          />
        ))}
      </EthenaTray>
    </>
  );
}

function WatchRowView({
  row,
  stale,
  last,
  onOpenRow,
  onPreset,
  reviewABuySlot,
}: {
  row: WatchRow;
  stale: boolean;
  last: boolean;
  onOpenRow: (mint: string) => void;
  onPreset?: WatchScreenProps['onPreset'];
  reviewABuySlot?: WatchScreenProps['reviewABuySlot'];
}) {
  const figure = stale ? ethena.ink.tertiary : ethena.ink.primary;
  // The one shared reader, so Watch reads what Markets reads.
  const risk = usePlainRisk(row.mint);
  // The spoken change carries its sign: the direction glyph is not read.
  const spokenChange = row.change
    ? `${row.change.direction === 'down' ? '-' : row.change.direction === 'up' ? '+' : ''}${row.change.text}`
    : null;
  const a11y =
    row.price == null
      ? [row.symbol, copy.watchlist.priceUnknownA11y].join(', ')
      : spokenChange
        ? copy.moving.rowLabel(row.symbol, row.price, spokenChange)
        : [row.symbol, row.price].join(', ');
  const presets = onPreset ? row.presets : [];
  const slot = reviewABuySlot?.(row) ?? null;
  return (
    <View
      testID={`watch-row-${row.key}`}
      style={{
        paddingBottom: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: ethena.hair,
      }}
    >
      <Pressable
        testID={`watch-row-${row.key}-open`}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => onOpenRow(row.mint)}
        style={{
          minHeight: WATCH_ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 12,
        }}
      >
        <CorsoText
          numberOfLines={1}
          style={{ ...ETHENA_TYPE.rowName, color: figure, flexShrink: 1 }}
        >
          {row.symbol}
        </CorsoText>
        <View style={{ flex: 1 }} />
        {row.price != null ? (
          <CorsoText
            testID={`watch-row-${row.key}-price`}
            style={{ ...ETHENA_TYPE.rowValue, color: figure }}
          >
            {row.price}
          </CorsoText>
        ) : null}
        {/* A fixed column so a price-only row lines up with its neighbours.
            ⛔ Empty when there is no 24h: no dash, no `0.0%`. */}
        <View
          style={{
            minWidth: 58,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
          }}
        >
          {row.change ? (
            <>
              {row.change.direction ? (
                <EthenaDirection
                  testID={`watch-row-${row.key}-direction`}
                  direction={row.change.direction}
                />
              ) : null}
              <CorsoText
                testID={`watch-row-${row.key}-change`}
                style={{
                  ...ETHENA_TYPE.rowDelta,
                  color: stale
                    ? ethena.ink.tertiary
                    : resolveDeltaInk(row.change.direction),
                }}
              >
                {row.change.text}
              </CorsoText>
            </>
          ) : null}
        </View>
      </Pressable>
      {/* The server's first why line, as served: no line, no row. */}
      {row.why ? (
        <CorsoText
          testID={`watch-row-${row.key}-why`}
          style={{
            ...ETHENA_TYPE.rowSub,
            color: stale ? ethena.ink.tertiary : ethena.ink.secondary,
            paddingBottom: 6,
          }}
        >
          {row.why.text}
        </CorsoText>
      ) : null}
      {/* Plain facts only: no level, no badge, nothing on a clean token. */}
      <PlainRiskFacts
        read={risk}
        style={{ paddingBottom: 6 }}
        testID={`watch-row-${row.key}-facts`}
      />
      {presets.length > 0 ? (
        <View
          testID={`watch-row-${row.key}-presets`}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 6,
          }}
        >
          {presets.map((preset) => (
            <EthenaPill
              key={preset.direction}
              testID={`watch-row-${row.key}-preset-${preset.direction}`}
              label={preset.label}
              plane="ground"
              accessibilityHint={ALERT_COPY.title}
              onPress={() => onPreset?.(row, preset)}
            />
          ))}
        </View>
      ) : null}
      {slot ? (
        <View
          testID={`watch-row-${row.key}-review-slot`}
          style={{ paddingTop: 8 }}
        >
          {slot}
        </View>
      ) : null}
    </View>
  );
}
