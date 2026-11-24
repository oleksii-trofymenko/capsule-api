ALTER TABLE "style_profiles" ADD COLUMN "colour_temperature" text DEFAULT 'skip' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD COLUMN "colour_contrast" text DEFAULT 'skip' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD COLUMN "height" text DEFAULT 'skip' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD COLUMN "frame" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD COLUMN "play_up" text[] DEFAULT '{}' NOT NULL;