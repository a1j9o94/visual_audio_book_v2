ALTER TABLE "visual_audio_book_v2_sequence_metadata" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_sequence_metadata" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "visual_audio_book_v2_sequence" ADD COLUMN "updated_at" timestamp DEFAULT now();