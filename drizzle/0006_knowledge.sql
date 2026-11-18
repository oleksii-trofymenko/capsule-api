CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "knowledge_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"text" text NOT NULL,
	"published_on" date NOT NULL,
	"seasons" text[] DEFAULT '{}' NOT NULL,
	"embedding" vector(768) NOT NULL,
	"embedding_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"licence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_passages" ADD CONSTRAINT "knowledge_passages_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_passages_source_idx" ON "knowledge_passages" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "knowledge_passages_embedding_idx" ON "knowledge_passages" USING hnsw ("embedding" vector_cosine_ops);