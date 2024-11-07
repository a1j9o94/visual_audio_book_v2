CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gutenberg_id" text,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"cover_image_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "visual_audio_book_v2_book_gutenberg_id_unique" UNIQUE("gutenberg_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_character" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"attributes" jsonb,
	"first_appearance" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_sequence_character" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid,
	"character_id" uuid,
	"role" text,
	"context" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_sequence_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid,
	"audio_url" text,
	"image_url" text,
	"audio_duration" integer,
	"image_metadata" jsonb,
	"generated_at" timestamp DEFAULT now(),
	CONSTRAINT "visual_audio_book_v2_sequence_media_sequence_id_unique" UNIQUE("sequence_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_sequence_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid,
	"scene_description" jsonb,
	"camera_directions" jsonb,
	"mood" jsonb,
	"lighting" jsonb,
	"settings" jsonb,
	"ai_annotations" jsonb,
	CONSTRAINT "visual_audio_book_v2_sequence_metadata_sequence_id_unique" UNIQUE("sequence_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid,
	"sequence_number" integer NOT NULL,
	"content" text NOT NULL,
	"start_position" integer NOT NULL,
	"end_position" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "visual_audio_book_v2_session_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_user_book_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"book_id" uuid,
	"last_sequence_number" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp DEFAULT now(),
	"total_time_spent" integer DEFAULT 0,
	"is_complete" boolean DEFAULT false,
	"reading_preferences" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_user_bookmark" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"book_id" uuid,
	"sequence_number" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_user_sequence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"sequence_id" uuid,
	"viewed_at" timestamp DEFAULT now(),
	"time_spent" integer DEFAULT 0,
	"completed" boolean DEFAULT false,
	"preferences" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "visual_audio_book_v2_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_audio_book_v2_verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "visual_audio_book_v2_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_account" ADD CONSTRAINT "visual_audio_book_v2_account_user_id_visual_audio_book_v2_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."visual_audio_book_v2_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_character" ADD CONSTRAINT "visual_audio_book_v2_character_book_id_visual_audio_book_v2_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."visual_audio_book_v2_book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_sequence_character" ADD CONSTRAINT "visual_audio_book_v2_sequence_character_sequence_id_visual_audio_book_v2_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."visual_audio_book_v2_sequence"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_sequence_character" ADD CONSTRAINT "visual_audio_book_v2_sequence_character_character_id_visual_audio_book_v2_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."visual_audio_book_v2_character"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_sequence_media" ADD CONSTRAINT "visual_audio_book_v2_sequence_media_sequence_id_visual_audio_book_v2_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."visual_audio_book_v2_sequence"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_sequence_metadata" ADD CONSTRAINT "visual_audio_book_v2_sequence_metadata_sequence_id_visual_audio_book_v2_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."visual_audio_book_v2_sequence"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_sequence" ADD CONSTRAINT "visual_audio_book_v2_sequence_book_id_visual_audio_book_v2_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."visual_audio_book_v2_book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_session" ADD CONSTRAINT "visual_audio_book_v2_session_user_id_visual_audio_book_v2_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."visual_audio_book_v2_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_book_progress" ADD CONSTRAINT "visual_audio_book_v2_user_book_progress_user_id_visual_audio_book_v2_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."visual_audio_book_v2_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_book_progress" ADD CONSTRAINT "visual_audio_book_v2_user_book_progress_book_id_visual_audio_book_v2_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."visual_audio_book_v2_book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_bookmark" ADD CONSTRAINT "visual_audio_book_v2_user_bookmark_user_id_visual_audio_book_v2_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."visual_audio_book_v2_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_bookmark" ADD CONSTRAINT "visual_audio_book_v2_user_bookmark_book_id_visual_audio_book_v2_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."visual_audio_book_v2_book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_sequence_history" ADD CONSTRAINT "visual_audio_book_v2_user_sequence_history_user_id_visual_audio_book_v2_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."visual_audio_book_v2_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_audio_book_v2_user_sequence_history" ADD CONSTRAINT "visual_audio_book_v2_user_sequence_history_sequence_id_visual_audio_book_v2_sequence_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."visual_audio_book_v2_sequence"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_provider_account_id_idx" ON "visual_audio_book_v2_account" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "visual_audio_book_v2_account" USING btree ("user_id");