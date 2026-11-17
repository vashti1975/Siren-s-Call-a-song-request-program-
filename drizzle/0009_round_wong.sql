CREATE TABLE `listener_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`name` text,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE INDEX `feedback_visitor_time_idx` ON `listener_feedback` (`visitor`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_archive_time_idx` ON `listener_feedback` (`archived_at`,`created_at`);