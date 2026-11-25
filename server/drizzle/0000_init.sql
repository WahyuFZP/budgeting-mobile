CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "budgets" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"category_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"limit_amount" bigint NOT NULL,
	CONSTRAINT "budgets_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "budget_limit_positive" CHECK ("budgets"."limit_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "category_kind" CHECK ("categories"."kind" in ('income','expense'))
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"template" text NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	CONSTRAINT "recurring_rules_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"wallet_id" text NOT NULL,
	"to_wallet_id" text,
	"category_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	"recurring_rule_id" text,
	CONSTRAINT "transactions_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "tx_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "tx_type" CHECK ("transactions"."type" in ('income','expense','transfer')),
	CONSTRAINT "tx_shape" CHECK (("transactions"."type" = 'transfer' and "transactions"."to_wallet_id" is not null and "transactions"."to_wallet_id" <> "transactions"."wallet_id" and "transactions"."category_id" is null)
       or ("transactions"."type" <> 'transfer' and "transactions"."to_wallet_id" is null and "transactions"."category_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"initial_balance" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wallets_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "wallet_type" CHECK ("wallets"."type" in ('cash','bank','ewallet'))
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_wallet_id_wallets_user_id_id_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_to_wallet_id_wallets_user_id_id_fk" FOREIGN KEY ("user_id","to_wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_category_id_categories_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_user_period_idx" ON "budgets" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "budget_seq_idx" ON "budgets" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "categories_seq_idx" ON "categories" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "recurring_seq_idx" ON "recurring_rules" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "tx_user_occurred_idx" ON "transactions" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "tx_seq_idx" ON "transactions" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "wallets_seq_idx" ON "wallets" USING btree ("user_id","seq");