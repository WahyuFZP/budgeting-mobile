ALTER TABLE "wallets" ADD COLUMN "target_amount" bigint;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "target_date" timestamp with time zone;