export type WatchDigestStore = {
  /**
   * Wallets with a watch, a confirmed device, and no send row for `day`.
   * Stable wallet order. `after` is an exclusive cursor so a pass can leave
   * a page of non-movers behind instead of reading that page again.
   */
  listPendingWallets(
    day: string,
    limit: number,
    after?: string | null,
  ): Promise<string[]>;
  mintsFor(wallet: string): Promise<string[]>;
  /** Confirmed Expo tokens for this wallet. Empty when none are live. */
  confirmedTokens(wallet: string): Promise<string[]>;
  /**
   * Insert the day row. False when that wallet already has one.
   * A true result is the once-per-day claim: the caller sends after it,
   * and a crash before the provider accepts still consumes the day.
   */
  claim(wallet: string, day: string, moved: number): Promise<boolean>;
  /** Replace the wallet's watched mints. Empty clears them. False when refused. */
  replaceWatches(wallet: string, mints: readonly string[]): Promise<boolean>;
  close?(): Promise<void>;
};

export type WatchDigestDeviceLookup = {
  /** Wallet for a confirmed device, or null when the receipt does not match. */
  confirmedWallet(id: string, receipt: string): Promise<string | null>;
};
