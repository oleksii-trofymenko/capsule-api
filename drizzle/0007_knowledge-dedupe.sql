DROP INDEX "knowledge_passages_source_idx";--> statement-breakpoint
ALTER TABLE "knowledge_passages" ADD COLUMN "text_hash" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_passages_source_text_idx" ON "knowledge_passages" USING btree ("source_id","text_hash","published_on");--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_name_unique" UNIQUE("name");