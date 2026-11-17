ALTER TABLE "photos" ADD COLUMN "tag_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tag_model" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "tagged_at" timestamp with time zone;