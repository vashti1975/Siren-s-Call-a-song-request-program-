import { env } from "cloudflare:workers";
import { z } from "zod";
import type { LocationSettings, PlayingLocation } from "./playing-location";

const shortText = (length: number) => z.string().trim().max(length).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
export const playingLocationSchema = z.object({
  kind: z.enum(["city", "venue"]), name: shortText(100).refine(Boolean),
  dataCenter: shortText(60), world: shortText(60), zone: shortText(120).refine(Boolean),
  address: shortText(240), x: z.number().finite().min(0).max(100).nullable(), y: z.number().finite().min(0).max(100).nullable(),
}).refine(value => (value.x === null) === (value.y === null), {message: "Enter both X and Y coordinates."})
  .refine(value => value.kind !== "venue" || !!value.address, {message: "Enter the venue address."});

// Independent settings in the existing key/value store survive new-show resets.
export async function currentPlayingLocation(): Promise<PlayingLocation | null> {
  const row = await env.DB!.prepare("SELECT show_id AS value FROM show_state WHERE id='playing-location'").first<{value: string}>();
  if (!row) return null;
  try { return playingLocationSchema.parse(JSON.parse(row.value)); } catch { return null; }
}

export async function locationSettings(): Promise<LocationSettings> {
  const { results } = await env.DB!.prepare("SELECT id, show_id AS value FROM show_state WHERE id LIKE 'playing-venue:%' ORDER BY id").all<{id: string; value: string}>();
  const venues = results.flatMap(row => {
    try { return [{id: row.id.slice("playing-venue:".length), location: playingLocationSchema.parse(JSON.parse(row.value))}]; } catch { return []; }
  }).sort((a, b) => a.location.name.localeCompare(b.location.name));
  return {current: await currentPlayingLocation(), venues};
}

export async function setPlayingLocation(location: PlayingLocation | null) {
  await env.DB!.prepare("INSERT INTO show_state (id,show_id) VALUES ('playing-location',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(JSON.stringify(location)).run();
}

export async function saveVenue(id: string, location: PlayingLocation) {
  await env.DB!.prepare("INSERT INTO show_state (id,show_id) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind("playing-venue:" + id, JSON.stringify(location)).run();
}

export async function deleteVenue(id: string) {
  await env.DB!.prepare("DELETE FROM show_state WHERE id=?").bind("playing-venue:" + id).run();
}
