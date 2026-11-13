ALTER TYPE "public"."buffer_status" ADD VALUE 'needs_approval';--> statement-breakpoint
ALTER TYPE "public"."buffer_status" ADD VALUE 'sending';--> statement-breakpoint
ALTER TYPE "public"."buffer_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TYPE "public"."usage_kind" ADD VALUE 'buffer_write';--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "channels_cache" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "channels_cached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_channel_required" CHECK ("posts"."is_sample" OR "posts"."channel_id" IS NOT NULL);