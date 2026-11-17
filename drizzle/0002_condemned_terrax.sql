CREATE TABLE `show_state` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `listener_requests` ADD `show_id` text DEFAULT 'initial' NOT NULL;