CREATE TABLE `visual_audio_book_v2_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `visual_audio_book_v2_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_book` (
	`id` text PRIMARY KEY NOT NULL,
	`gutenberg_id` text,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`cover_image_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` blob,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_character` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`name` text NOT NULL,
	`description` text,
	`attributes` blob,
	`first_appearance` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`book_id`) REFERENCES `visual_audio_book_v2_book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_sequence_character` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text,
	`character_id` text,
	`role` text,
	`context` blob,
	FOREIGN KEY (`sequence_id`) REFERENCES `visual_audio_book_v2_sequence`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `visual_audio_book_v2_character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_sequence_media` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text,
	`audio_url` text,
	`image_url` text,
	`audio_duration` integer,
	`image_metadata` blob,
	`generated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`sequence_id`) REFERENCES `visual_audio_book_v2_sequence`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_sequence_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text,
	`scene_description` blob,
	`camera_directions` blob,
	`mood` blob,
	`lighting` blob,
	`settings` blob,
	`ai_annotations` blob,
	FOREIGN KEY (`sequence_id`) REFERENCES `visual_audio_book_v2_sequence`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_sequence` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text,
	`sequence_number` integer NOT NULL,
	`content` text NOT NULL,
	`start_position` integer NOT NULL,
	`end_position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`book_id`) REFERENCES `visual_audio_book_v2_book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_session` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `visual_audio_book_v2_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_user_book_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`book_id` text,
	`last_sequence_number` integer DEFAULT 0 NOT NULL,
	`last_read_at` integer DEFAULT (unixepoch()),
	`total_time_spent` integer DEFAULT 0,
	`is_complete` integer DEFAULT 0,
	`reading_preferences` blob,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `visual_audio_book_v2_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `visual_audio_book_v2_book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_user_bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`book_id` text,
	`sequence_number` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `visual_audio_book_v2_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `visual_audio_book_v2_book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_user_sequence_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`sequence_id` text,
	`viewed_at` integer DEFAULT (unixepoch()),
	`time_spent` integer DEFAULT 0,
	`completed` integer DEFAULT 0,
	`preferences` blob,
	FOREIGN KEY (`user_id`) REFERENCES `visual_audio_book_v2_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sequence_id`) REFERENCES `visual_audio_book_v2_sequence`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `visual_audio_book_v2_verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE INDEX `provider_provider_account_id_idx` ON `visual_audio_book_v2_account` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `visual_audio_book_v2_account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `visual_audio_book_v2_book_gutenberg_id_unique` ON `visual_audio_book_v2_book` (`gutenberg_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `visual_audio_book_v2_session_session_token_unique` ON `visual_audio_book_v2_session` (`session_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `visual_audio_book_v2_user_email_unique` ON `visual_audio_book_v2_user` (`email`);