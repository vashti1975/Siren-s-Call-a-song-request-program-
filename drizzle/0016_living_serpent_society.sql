CREATE TABLE `midibard_ignored_files` (
	`file_key` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER budget_midibard_ignored_insert AFTER INSERT ON midibard_ignored_files BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
--> statement-breakpoint
CREATE TRIGGER budget_midibard_ignored_delete AFTER DELETE ON midibard_ignored_files BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
