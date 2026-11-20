import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {isOwner,sameOrigin,privateHeaders as headers} from '../../../lib/owner';
import {catalog} from '../../../lib/catalog';
import {fileKey,matchSong,syncTables} from '../../../lib/midibard';
import {songKey} from '../../../lib/show';
export async function POST(request:Request){
 if(!await isOwner()||!sameOrigin(request))return Response.json({error:'Owner access required'},{status:403,headers});
 let raw;try{raw=await request.json();}catch{return Response.json({error:'Invalid timings'},{status:400,headers});}
 const parsed=z.object({files:z.array(z.object({file:z.string().min(1).max(500),seconds:z.number().int().min(1).max(86400)})).min(1).max(50)}).safeParse(raw);
 if(!parsed.success)return Response.json({error:'Choose valid MIDI files, up to 50 per batch.'},{status:400,headers});
 await syncTables();
 const songs=await catalog();
 const {results:aliases}=await env.DB!.prepare('SELECT file_key AS fileKey,song_id AS songId FROM midibard_aliases').all<{fileKey:string;songId:string}>();
 const {results:resets}=await env.DB!.prepare('SELECT file_key AS fileKey FROM midibard_match_resets').all<{fileKey:string}>();
 const {results:ignored}=await env.DB!.prepare('SELECT file_key AS fileKey FROM midibard_ignored_files').all<{fileKey:string}>();
 const saved=new Map(aliases.map(a=>[a.fileKey,a.songId])),blocked=new Set([...resets,...ignored].map(r=>r.fileKey));
 const lengths=new Map<string,number>(),unmatched:string[]=[],conflicts:string[]=[];
 for(const entry of parsed.data.files){const key=fileKey(entry.file),song=blocked.has(key)?undefined:matchSong(entry.file,songs,saved.get(key));if(!song){unmatched.push(entry.file);continue;}const group=songKey(song),old=lengths.get(group);if(old&&old!==entry.seconds)conflicts.push(entry.file);lengths.set(group,Math.max(old||0,entry.seconds));}
 // Keep the longest imported version, including files in earlier batches.
 for(const song of songs){const key=songKey(song);if(lengths.has(key)&&song.durationSeconds)lengths.set(key,Math.max(lengths.get(key)!,song.durationSeconds));}
 const updates=songs.filter(s=>lengths.has(songKey(s))).map(song=>env.DB!.prepare('INSERT INTO song_durations(song_id,seconds,updated_at) VALUES(?,?,?) ON CONFLICT(song_id) DO UPDATE SET seconds=excluded.seconds,updated_at=excluded.updated_at').bind(song.id,lengths.get(songKey(song))!,Date.now()));
 if(updates.length)await env.DB!.batch(updates);
 return Response.json({matched:lengths.size,unmatched,conflicts},{headers});
}
