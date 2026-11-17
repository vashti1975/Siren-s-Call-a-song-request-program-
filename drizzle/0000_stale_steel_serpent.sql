CREATE TABLE `listener_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`visitor` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_song_idx` ON `listener_requests` (`song_id`);--> statement-breakpoint
CREATE INDEX `requests_visitor_time_idx` ON `listener_requests` (`visitor`,`created_at`);--> statement-breakpoint
CREATE TABLE `song_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`song_set` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
