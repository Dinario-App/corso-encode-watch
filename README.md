# Corso Watch

Encode x Solana Hackathon 2026, Best Consumer App on Solana.

Corso Watch puts the coins you follow on one screen. Each coin shows its price, its 24h move, a line on what the market data shows about that move, and plain risk facts read from Solana. From any row you can set a price alert 10% above or below the price.

**This repo holds only the Watch code built during the hackathon window (Oct 12 to Nov 8, 2026).** Corso itself is a private app. Watch plugs into it, so **this repo does not build or run on its own.** To try Watch, use the preview app and the demo video in our Encode submission.

## Try it

1. **Sign in** with an email code or Google. The app creates your account when you sign in.
2. **Follow a few coins.** Open a coin and tap **Watch**. SOL, cbBTC, ETH and the other majors have a Watch button too.
3. **Open Watch** from the Watch row on Home. Each coin shows its price and 24h move, the market line, and plain risk facts when there are any.
4. **Set an alert** from a coin's row: tap a preset 10% above or below the price, then confirm on the alert sheet. Cash coins (USDC, USDT, PYUSD) get no presets, since they hold near $1.

The preview build talks to our staging server with Watch switched on. It reads Solana mainnet. You don't need to trade or add funds to try Watch.

## What's in this repo

| Path | What it is |
|---|---|
| `apps/mobile/app/watch.tsx` | The `/watch` route. It shows nothing unless the Watch flag is on. |
| `apps/mobile/src/features/watch/WatchEntry.tsx` | The Watch row on Home |
| `apps/mobile/src/features/watch/WatchScreen.tsx` | The Watch screen: one row per watched coin, with the presets row |
| `apps/mobile/src/features/watch/watchPresentation.ts` | Turns prices, market lines and the watchlist into rows. Pure, no network. |
| `apps/mobile/src/features/watch/watchReads.ts`, `useWatchReads.ts` | Reads prices and market lines in batches of ten coins |
| `apps/mobile/src/features/watch/useWatchAlerts.ts` | Opens the app's existing alert sheet with a preset's side and price filled in |
| `apps/mobile/src/features/watch/MajorWatchStarSlot.tsx` | The Watch button on the major coins' pages |
| `apps/mobile/src/features/watch/watchEnv.ts` | The `EXPO_PUBLIC_FLAG_WATCH` build flag (off by default) |
| `apps/mobile/constants/copy/watch.ts` | The one new line of text Watch adds (its empty state) |
| `apps/api/src/watchDigest/` | Server side of the daily Watch digest: the 10% threshold, one push a day, the push text, and the route that stores a person's watched coins |
| `apps/api/src/db/watchDigestPostgres.ts` | Postgres store for the digest |
| `apps/api/drizzle/0045_watch_digest.sql` | The two digest tables |

The tests for these files live in the private app.

### Flags

Both flags are off by default, and both are off in production. The preview build used for the demo video was built with `EXPO_PUBLIC_FLAG_WATCH` on. `FLAG_WATCH_DIGEST` is off on the staging server that build talks to, so the digest route is off there too.

| Flag | Where | What it turns on |
|---|---|---|
| `EXPO_PUBLIC_FLAG_WATCH` | app | The Watch screen and its Home row |
| `FLAG_WATCH_DIGEST` (with `FLAG_PRICES`) | server | The digest route and its daily pass |

### The daily digest: what is and isn't wired

The server side is complete: once a day it counts how many of a person's watched coins moved more than 10% in 24 hours, and if any did, it sends one push, "3 of your watched tokens moved more than 10%", that opens Watch. **The app does not yet send its watched list to the digest route**, so the preview build does not get a digest push. That client step is still to do.

## Setup steps (reading the code)

```
git clone https://github.com/Dinario-App/corso-encode-watch
cd corso-encode-watch
```

There is no `package.json` here and nothing to install. The paths match the private app's layout, so imports like `@/src/...` refer to files in that app. The table below names every one of them.

## What lives in the private app

Watch calls into code that is not in this repo. We left it out on purpose: it covers sign-in, keys, trading and our servers' configuration.

| Call | Used by | What it does |
|---|---|---|
| `features/session/SessionContext` | `useWatchAlerts` | The signed-in session |
| `features/priceAlerts/pushRegistration`, `pushClient`, `waitEntry`, `alertCopy`, `alertModel` | `useWatchAlerts`, `WatchScreen`, `watchPresentation` | Push sign-up and the existing set-alert sheet, its wording and its alert rules |
| `lib/apiConfig` | `useWatchAlerts`, `watchReads` | Which server the app talks to |
| `features/balances/fetchPrices`, `usePriceQuotes`, `priceSnapshot`, `usdcConstants`, `majors` | `watchReads`, `watchPresentation` | Price reads (`GET /v1/prices`) and the list of major coins |
| `features/why/useWhy`, `whyClient`, `whyPresentation`, `@corso/why` | `watchReads`, `useWatchReads`, `watchPresentation` | The market line for each coin (`GET /v1/why?surface=moving`) |
| `features/markets/marketsMovingPresentation` | `watchReads`, `useWatchReads`, `watchPresentation` | The shared market-line reader |
| `features/connectivity/useConnectivity`, `connectivity` | `watch.tsx`, `watchPresentation` | Online state and the line shown when a read fails |
| `features/home/asOfPresentation` | `watchPresentation` | The "as of" time and move context shown with prices |
| `features/plainRisk/usePlainRisk`, `ui/risk/PlainRiskFacts` | `WatchScreen` | On-chain risk facts and how they're drawn |
| `features/watchlist/watchlistStore`, `watchlistEntry`, `WatchStarButton` | `watch.tsx`, `watchPresentation`, `MajorWatchStarSlot` | The on-phone watchlist and its Watch button |
| `features/moderation/reportedTokenStore`, `features/discovery/moderation` | `watch.tsx`, `watchPresentation`, `MajorWatchStarSlot` | Hides coins a person reported |
| `features/navigation/*`, `features/account/ui/AccountScreenHeader` | `watch.tsx`, `WatchScreen` | App navigation and header |
| `constants/copy`, `constants/theme.*`, `theme/CorsoText`, `ui/**` | screens | The design system and shared text |
| `env`, `prices/types` | `arming`, `routes`, `watchDigestPostgres` | Server config and price types |
| `app`, `index`, `db/schema`, `priceAlerts/expoPushClient` | none (they call the digest) | Mount the route, run the daily timer, hold the table schema and send the push |

Trading, signing, fees and sign-in are not in this repo.

## How Solana powers it

1. **Risk facts are read from the chain.** For each coin, the server reads the token's mint account on Solana: whether someone can still mint more, freeze balances or move tokens through a permanent delegate, and whether a Token-2022 coin carries a transfer fee or hook. It also reads the largest holder accounts. Watch shows these as plain facts under each coin.
2. **Prices come from Solana markets through Jupiter.** Spot prices come from the Jupiter Tokens API V2, and the 24h move rides on the same read. Price alerts are checked against those prices every minute.
3. **Alerts belong to your Solana account.** Creating or cancelling an alert needs a short signed message, which the server checks.
4. **The trade is a Solana transaction you approve.** From a coin's page, the trade screen shows the fee in dollars and the least you'll get. When you approve, the swap is signed and sent to Solana mainnet. Watch itself doesn't open a trade. Tapping a price alert opens the trade screen for that coin, and nothing is sent until you approve.

Points 2 to 4 describe parts of the app that existed before Oct 12. They're listed in the next section.

## Built during the hackathon vs. before

A public snapshot of the app as it was on Oct 12, 2026 is at https://github.com/Dinario-App/corso-clockin/tree/b719d428dfc093b9aef66e685445a9dce5c69775.

**Built during the window (Oct 12 to Nov 8), all in this repo:**

| Date | Change |
|---|---|
| Oct 24 | The Watch screen: your coins with price, 24h move, the market line and risk facts, plus alert presets 10% above and below each price, behind a build flag |
| Oct 24 | The major coins (SOL, cbBTC, ETH and others) can be watched; preset buttons read as prices; cash coins get no presets |
| Oct 24 | The server side of the daily Watch digest: the route, the store, the daily pass and the push text, behind a server flag |

**Existed before Oct 12 (in the private app, not in this repo):**

| Part | What it does |
|---|---|
| Sign-in | Email code or Google |
| Home | Cash and crypto balances |
| Coin pages | Price, key facts and plain risk reads |
| Watchlist | A Watch button that saves a coin to a list on the phone |
| Price alerts | Alerts with a push, tied to your Solana account by a signed message, checked every minute |
| Alert tap | Opens the trade screen on that coin |
| Market lines | A server switch, off by default, that writes a short line on how a coin moved |
| Trading | The trade Review and approval, through Jupiter |

## Licence

Apache-2.0. See `LICENSE`.
