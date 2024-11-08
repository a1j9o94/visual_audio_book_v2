ALTER TABLE "visual_audio_book_v2_session" DROP CONSTRAINT "visual_audio_book_v2_session_session_token_unique";--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_session" ADD PRIMARY KEY ("session_token");--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_session" DROP COLUMN IF EXISTS "id";