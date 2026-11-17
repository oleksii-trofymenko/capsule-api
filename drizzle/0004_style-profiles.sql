CREATE TABLE "style_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sizes" jsonb NOT NULL,
	"fit" text NOT NULL,
	"directions" text[] NOT NULL,
	"favourite_colours" text[] NOT NULL,
	"avoid_colours" text[] NOT NULL,
	"lifestyle" text NOT NULL,
	"never_wear" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;