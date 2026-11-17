import { env } from "cloudflare:workers";
import { songs, type Song } from "./songs";
export async function catalog({includeRemoved=false}: {includeRemoved?:boolean} = {}): Promise<Song[]> {
 const { results } = await env.DB!.prepare('SELECT id,title,artist,song_set AS "set",note,removed_at AS removedAt FROM song_edits').all<Song & {removedAt:number|null}>();
 const merged = new Map(songs.map(s => [s.id,s]));
 for (const {removedAt,...song} of results) {
  if(removedAt!==null&&!includeRemoved)merged.delete(song.id);
  else merged.set(song.id,song);
 }
 const {results:timings}=await env.DB!.prepare('SELECT song_id AS songId,seconds FROM song_durations').all<{songId:string;seconds:number}>();
 const lengths=new Map(timings.map(t=>[t.songId,t.seconds]));
 return [...merged.values()].map(song=>({...song,durationSeconds:lengths.get(song.id)??null}));
}
