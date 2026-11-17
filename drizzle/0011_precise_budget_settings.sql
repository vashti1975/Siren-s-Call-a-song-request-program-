DROP TRIGGER budget_show_state_insert;
--> statement-breakpoint
CREATE TRIGGER budget_show_state_insert AFTER INSERT ON show_state WHEN NEW.id IN ('current','hour-limit','requests-open') BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
--> statement-breakpoint
DROP TRIGGER budget_show_state_update;
--> statement-breakpoint
CREATE TRIGGER budget_show_state_update AFTER UPDATE ON show_state WHEN NEW.id IN ('current','hour-limit','requests-open') BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
--> statement-breakpoint
DROP TRIGGER budget_show_state_delete;
--> statement-breakpoint
CREATE TRIGGER budget_show_state_delete AFTER DELETE ON show_state WHEN OLD.id IN ('current','hour-limit','requests-open') BEGIN INSERT INTO request_budget_revision(id,revision) VALUES ('current',1) ON CONFLICT(id) DO UPDATE SET revision=revision+1; END;
