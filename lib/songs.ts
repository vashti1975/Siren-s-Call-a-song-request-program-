export const setNames = ["Anime", "Disney", "Final Fantasy", "Game", "Movies", "Rock/Metal", "Pop/Soft Rock", "Country"] as const;
export type SongSet = typeof setNames[number];
export type Song = { id: string; title: string; artist: string; set: SongSet; note?: string; durationSeconds?: number|null };

// This reusable GitHub version intentionally starts without a song list.
// Add songs through the owner page; catalog() reads them from the database.
export const songs: Song[] = [];
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").toLowerCase();
export const compare = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
export type SortField = "title" | "artist" | "set";
export function findSongs({ query = "", set = "All", artist = "All", favoritesOnly = false, favorites = [], sort = "title", direction = "asc" }: {
  query?: string; set?: string; artist?: string; favoritesOnly?: boolean; favorites?: string[]; sort?: SortField; direction?: "asc" | "desc";
}, catalog: Song[] = songs) {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  return catalog.filter(song => (set === "All" || song.set === set) && (artist === "All" || song.artist === artist) && (!favoritesOnly || favorites.includes(song.id)) && tokens.every(token => normalize(`${song.title} ${song.artist} ${song.set} ${song.note ?? ""}`).includes(token)))
    .sort((a, b) => ((compare(a[sort], b[sort]) || compare(a.title, b.title) || compare(a.set, b.set)) * (direction === "asc" ? 1 : -1)));
}
