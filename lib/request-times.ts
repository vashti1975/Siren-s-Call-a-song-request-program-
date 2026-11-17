import { normalize, type Song } from "./songs";

export function pendingRequestTimes(songs: Song[], queue: {songId: string; createdAt: number}[]): Record<string, number[]> {
  const key = (song: Song) => normalize(song.title.trim() + "|" + song.artist.trim());
  const byId = new Map(songs.map(song => [song.id, song]));
  const grouped = new Map<string, number[]>();
  for (const request of queue) {
    const song = byId.get(request.songId);
    if (!song) continue;
    const identity = key(song);
    const times = grouped.get(identity) || [];
    times.push(request.createdAt);
    grouped.set(identity, times);
  }
  for (const times of grouped.values()) times.sort((a, b) => a - b);
  return Object.fromEntries(songs.map(song => [song.id, grouped.get(key(song)) || []]));
}
