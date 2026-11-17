CREATE TABLE `listener_favorites` (
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `song_id`)
);
--> statement-breakpoint
CREATE TABLE `listener_note_awards` (
	`request_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`earned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listener_notes_user_idx` ON `listener_note_awards` (`user_id`);--> statement-breakpoint
CREATE TABLE `listener_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Music lover' NOT NULL,
	`theme` text DEFAULT 'ocean' NOT NULL,
	`featured` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `listener_requests` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `requests_user_time_idx` ON `listener_requests` (`user_id`,`created_at`);