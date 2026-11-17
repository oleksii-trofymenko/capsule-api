CREATE TABLE "wardrobe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"photo_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"colour" text NOT NULL,
	"formality" text NOT NULL,
	"seasons" text[] NOT NULL,
	"size_system" text,
	"size_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wardrobe_items_user_idx" ON "wardrobe_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wardrobe_items_photo_idx" ON "wardrobe_items" USING btree ("photo_id");