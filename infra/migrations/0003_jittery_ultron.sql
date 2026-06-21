DO $$ BEGIN
 CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploading', 'done', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "upload_status" "upload_status" DEFAULT 'done' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "bull_job_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "ai_tags" text[];