CREATE TABLE "watch_digest_sends" (
	"wallet_address" text NOT NULL,
	"day" date NOT NULL,
	"moved_count" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_digest_sends_wallet_address_day_pk" PRIMARY KEY("wallet_address","day"),
	CONSTRAINT "watch_digest_sends_wallet_check" CHECK (char_length("watch_digest_sends"."wallet_address") between 32 and 44),
	CONSTRAINT "watch_digest_sends_count_check" CHECK ("watch_digest_sends"."moved_count" between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "watch_digest_watches" (
	"wallet_address" text NOT NULL,
	"mint" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_digest_watches_wallet_address_mint_pk" PRIMARY KEY("wallet_address","mint"),
	CONSTRAINT "watch_digest_watches_wallet_check" CHECK (char_length("watch_digest_watches"."wallet_address") between 32 and 44),
	CONSTRAINT "watch_digest_watches_mint_check" CHECK (char_length("watch_digest_watches"."mint") between 32 and 44)
);
--> statement-breakpoint
CREATE INDEX "watch_digest_watches_wallet_idx" ON "watch_digest_watches" USING btree ("wallet_address");