import { env } from "cloudflare:workers";
import { normalize, type Song } from "./songs";
import { requestHistoryStart } from "./request-history";
import { playbackState,livePlayback } from "./playback";
export async function currentShow() {
 await requestHistoryStart();
 const row=await env.DB!.prepare("SELECT show_id AS showId FROM show_state WHERE id='current'").first<{showId:string}>();
 return row?.showId || "initial";
}
export const songKey=(song:Song)=>normalize(song.title.trim()+"|"+song.artist.trim());
export async function showStatuses(songs:Song[],selectedShowId?:string) {
 const showId=selectedShowId??await currentShow();
 const {results}=await env.DB!.prepare("SELECT song_id AS songId, MAX(CASE WHEN played_at IS NOT NULL THEN 1 ELSE 0 END) AS played FROM listener_requests WHERE show_id=? GROUP BY song_id").bind(showId).all<{songId:string;played:number}>();
 const grouped=new Map<string,{requested:boolean;played:boolean}>();
 for(const row of results){const song=songs.find(s=>s.id===row.songId);if(song){const key=songKey(song);grouped.set(key,{requested:true,played:!!row.played||!!grouped.get(key)?.played});}}
 const {results:plays}=await env.DB!.prepare("SELECT song_id AS songId FROM show_plays WHERE show_id=?").bind(showId).all<{songId:string}>();
 for(const row of plays){const song=songs.find(s=>s.id===row.songId);if(song){const key=songKey(song);grouped.set(key,{requested:!!grouped.get(key)?.requested,played:true});}}
 const playback=await playbackState();
 const playingSong=livePlayback(playback,showId)?songs.find(s=>s.id===playback?.songId):undefined;
 return Object.fromEntries(songs.map(song=>[song.id,{...(grouped.get(songKey(song))||{requested:false,played:false}),playing:!!playingSong&&songKey(song)===songKey(playingSong)}]));
}

// Return only the song identity; request names, times and the queue stay private.
export async function playingNextSongId(songs:Song[],statuses:Record<string,{playing?:boolean}>,selectedShowId?:string) {
 const showId=selectedShowId??await currentShow();
 const {results}=await env.DB!.prepare("SELECT song_id AS songId FROM listener_requests WHERE played_at IS NULL AND show_id=? ORDER BY created_at ASC, id ASC").bind(showId).all<{songId:string}>();
 const available=new Set(songs.map(song=>song.id));
 return results.find(row=>available.has(row.songId)&&!statuses[row.songId]?.playing)?.songId??null;
}
