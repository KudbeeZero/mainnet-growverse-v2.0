CREATE TABLE "plant_grows" (
	"grow_id" varchar(36) PRIMARY KEY NOT NULL,
	"seed_id" text NOT NULL,
	"owner_player_id" text NOT NULL,
	"stage" varchar(20) DEFAULT 'planted' NOT NULL,
	"started_at" bigint NOT NULL,
	"stage_at" bigint NOT NULL,
	"stage_events" jsonb DEFAULT '[]'::jsonb,
	"tend_actions" integer DEFAULT 0,
	"clone_cut" boolean DEFAULT false,
	"harvest_nft_id" text,
	"rarity_tier" varchar(16),
	"parent_plot_id" integer
);
--> statement-breakpoint
CREATE TABLE "plant_seeds" (
	"seed_id" varchar(36) PRIMARY KEY NOT NULL,
	"asa_id" bigint,
	"owner_address" text NOT NULL,
	"owner_player_id" text,
	"traits" jsonb NOT NULL,
	"mint_tx_id" text,
	"minted_at" bigint,
	"parent_seed_id" text,
	"generation_num" integer DEFAULT 0,
	"nonce" text NOT NULL,
	"block_hash" text
);
--> statement-breakpoint
CREATE TABLE "story_events" (
	"event_id" varchar(36) PRIMARY KEY NOT NULL,
	"grow_id" text NOT NULL,
	"event_type" text NOT NULL,
	"choice_made" text,
	"outcome" jsonb,
	"created_at" bigint NOT NULL
);
