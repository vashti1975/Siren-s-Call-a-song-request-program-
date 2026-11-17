import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
export const songEdits = sqliteTable("song_edits", {
 id: text("id").primaryKey(), title: text("title").notNull(), artist: text("artist").notNull(), set: text("song_set").notNull(), note: text("note").notNull().default(""), updatedAt: integer("updated_at").notNull(), removedAt: integer("removed_at")
});
export const requests = sqliteTable("listener_requests", {
 id: text("id").primaryKey(), songId: text("song_id").notNull(), visitor: text("visitor").notNull(), createdAt: integer("created_at").notNull(), playedAt: integer("played_at"), requesterName: text("requester_name"), showId: text("show_id").notNull().default("initial"), userId: text("user_id")
}, t => [index("requests_song_idx").on(t.songId), index("requests_visitor_time_idx").on(t.visitor,t.createdAt), index("requests_user_time_idx").on(t.userId,t.createdAt)]);

export const listenerFeedback = sqliteTable("listener_feedback", {
 id: text("id").primaryKey(), visitor: text("visitor").notNull(), name: text("name"),
 message: text("message").notNull(), createdAt: integer("created_at").notNull(), archivedAt: integer("archived_at")
}, t => [index("feedback_visitor_time_idx").on(t.visitor,t.createdAt), index("feedback_archive_time_idx").on(t.archivedAt,t.createdAt)]);

export const listenerProfiles = sqliteTable("listener_profiles", {
 userId: text("user_id").primaryKey(), name: text("name").notNull().default("Music lover"),
 theme: text("theme").notNull().default("ocean"), featured: text("featured").notNull().default("[]"), placements: text("placements").notNull().default("[]"), stickerUnlockThrough: integer("sticker_unlock_through").notNull().default(0),
 createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull()
});
export const listenerFavorites = sqliteTable("listener_favorites", {
 userId: text("user_id").notNull(), songId: text("song_id").notNull(), createdAt: integer("created_at").notNull()
}, t => [primaryKey({columns:[t.userId,t.songId]})]);
export const listenerNotes = sqliteTable("listener_note_awards", {
 requestId: text("request_id").primaryKey(), userId: text("user_id").notNull(), songId: text("song_id").notNull(), earnedAt: integer("earned_at").notNull()
}, t => [index("listener_notes_user_idx").on(t.userId)]);

export const listenerRewardPurchases = sqliteTable("listener_reward_purchases", {
 userId:text("user_id").notNull(), rewardId:text("reward_id").notNull(),
 cost:integer("cost").notNull(), purchasedAt:integer("purchased_at").notNull()
},t=>[primaryKey({columns:[t.userId,t.rewardId]})]);

export const showState = sqliteTable("show_state", { id: text("id").primaryKey(), showId: text("show_id").notNull() });

export const showPlays = sqliteTable("show_plays", { id: text("id").primaryKey(), showId: text("show_id").notNull(), songId: text("song_id").notNull() });

export const songDurations = sqliteTable("song_durations", {songId:text("song_id").primaryKey(),seconds:integer("seconds").notNull(),updatedAt:integer("updated_at").notNull()});
export const manualPlays = sqliteTable("show_manual_plays", {id:text("id").primaryKey(),showId:text("show_id").notNull(),songId:text("song_id").notNull(),createdAt:integer("created_at").notNull()},t=>[index("manual_plays_show_idx").on(t.showId)]);
export const budgetRevision = sqliteTable("request_budget_revision", {id:text("id").primaryKey(),revision:integer("revision").notNull().default(0)});

export const midiPlayback = sqliteTable("midibard_playback", {
 id: text("id").primaryKey(), showId: text("show_id").notNull(), eventId: text("event_id").notNull(),
 songId: text("song_id"), fileName: text("file_name").notNull(), announcement: text("announcement"),
 playing: integer("playing").notNull().default(0), updatedAt: integer("updated_at").notNull(),
});
