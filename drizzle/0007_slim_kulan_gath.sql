CREATE TABLE `midibard_playback` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`event_id` text NOT NULL,
	`song_id` text,
	`file_name` text NOT NULL,
	`announcement` text,
	`playing` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
