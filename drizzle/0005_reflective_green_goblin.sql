ALTER TABLE "visual_audio_book_v2_sequence_media" RENAME COLUMN "generated_at" TO "updated_at";--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_sequence_media" RENAME COLUMN "audio_data" TO "audio_url";--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_sequence_media" RENAME COLUMN "image_data" TO "image_url";