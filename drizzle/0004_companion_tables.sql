-- Schema only; no personal matching data.
CREATE TABLE IF NOT EXISTS midibard_connection (id TEXT PRIMARY KEY, token_hash TEXT, last_seen INTEGER, last_file TEXT, last_match TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS midibard_aliases (file_key TEXT PRIMARY KEY, song_id TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS midibard_events (id TEXT PRIMARY KEY, show_id TEXT NOT NULL, file_name TEXT NOT NULL, song_id TEXT, created_at INTEGER NOT NULL);
