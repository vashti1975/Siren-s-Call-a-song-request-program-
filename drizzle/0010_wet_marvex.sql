CREATE TABLE `request_budget_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `show_manual_plays` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`song_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_plays_show_idx` ON `show_manual_plays` (`show_id`);--> statement-breakpoint
CREATE TABLE `song_durations` (
	`song_id` text PRIMARY KEY NOT NULL,
	`seconds` integer NOT NULL,
	`updated_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER budget_listener_requests_insert AFTER INSERT ON listener_requests BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_listener_requests_update AFTER UPDATE ON listener_requests BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_listener_requests_delete AFTER DELETE ON listener_requests BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_plays_insert AFTER INSERT ON show_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_plays_update AFTER UPDATE ON show_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_plays_delete AFTER DELETE ON show_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_midibard_events_insert AFTER INSERT ON midibard_events BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_midibard_events_update AFTER UPDATE ON midibard_events BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_midibard_events_delete AFTER DELETE ON midibard_events BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_durations_insert AFTER INSERT ON song_durations BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_durations_update AFTER UPDATE ON song_durations BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_durations_delete AFTER DELETE ON song_durations BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_manual_plays_insert AFTER INSERT ON show_manual_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_manual_plays_update AFTER UPDATE ON show_manual_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_manual_plays_delete AFTER DELETE ON show_manual_plays BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_state_insert AFTER INSERT ON show_state BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_state_update AFTER UPDATE ON show_state BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_show_state_delete AFTER DELETE ON show_state BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_edits_insert AFTER INSERT ON song_edits BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_edits_update AFTER UPDATE ON song_edits BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;

--> statement-breakpoint
CREATE TRIGGER budget_song_edits_delete AFTER DELETE ON song_edits BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
