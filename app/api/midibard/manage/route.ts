import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { syncTables,hashToken,fileKey,recordPlay,matchSong,automaticMatchStatement } from '../../../../lib/midibard';
import { catalog } from '../../../../lib/catalog';
import { matchCurrentPlayback } from '../../../../lib/playback';
import { currentShow,songKey } from '../../../../lib/show';
import { isOwner,sameOrigin,privateHeaders as headers } from '../../../../lib/owner';
export const dynamic='force-dynamic';
export async function GET(){
 if(!await isOwner())return Response.json({error:'Owner required'},{status:403,headers});
 await syncTables();
 const showId=await currentShow();
 const {results:unmatchedEvents}=await env.DB!.prepare('SELECT id,file_name AS file FROM midibard_events WHERE song_id IS NULL AND show_id=? ORDER BY created_at DESC LIMIT 30').bind(showId).all<{id:string;file:string}>();
 const songs=await catalog();
 const readAliases=async()=>(await env.DB!.prepare('SELECT file_key AS fileKey,song_id AS songId FROM midibard_aliases ORDER BY file_key').all<{fileKey:string;songId:string}>()).results;
 let aliases=await readAliases();
 const {results:files}=await env.DB!.prepare('SELECT DISTINCT file_name AS file FROM midibard_events').all<{file:string}>();
 const {results:resets}=await env.DB!.prepare('SELECT file_key AS fileKey FROM midibard_match_resets').all<{fileKey:string}>();
 const resetKeys=new Set(resets.map(r=>r.fileKey));
 const knownKeys=new Set([...aliases.map(a=>a.fileKey),...resetKeys]);
 const recovered=[];
 // Recover clear historical filenames without changing played labels or owner choices.
 for(const event of files){
  const key=fileKey(event.file);
  if(knownKeys.has(key))continue;
  const song=matchSong(event.file,songs);
  if(song){recovered.push(automaticMatchStatement(event.file,song));knownKeys.add(key);}
 }
 for(let i=0;i<recovered.length;i+=50)await env.DB!.batch(recovered.slice(i,i+50));
 if(recovered.length)aliases=await readAliases();
 const savedByFile=new Map(aliases.map(a=>[a.fileKey,a.songId]));
 const stillUnmatched=[];
 for(const event of unmatchedEvents){
  const key=fileKey(event.file);
  const song=resetKeys.has(key)?undefined:matchSong(event.file,songs,savedByFile.get(key));
  if(song){
   await matchCurrentPlayback(song,songs,event.id,showId);
   await recordPlay(song,showId);
   await env.DB!.prepare('UPDATE midibard_events SET song_id=? WHERE id=? AND show_id=?').bind(song.id,event.id,showId).run();
   await env.DB!.prepare("UPDATE midibard_connection SET last_match=? WHERE id='owner' AND last_file=?").bind(song.title,event.file).run();
  }else stillUnmatched.push(event);
 }
 const unmatched=[...new Map(stillUnmatched.map(e=>[fileKey(e.file),e])).values()];
 const matches=aliases.map(a=>({...a,file:files.find(e=>fileKey(e.file)===a.fileKey)?.file||a.fileKey}));
 const matchedKeys=new Set(aliases.flatMap(a=>{const song=songs.find(s=>s.id===a.songId);return song?[songKey(song)]:[];}));
 const matchedSongCount=songs.filter(s=>matchedKeys.has(songKey(s))).length;
 const connection=await env.DB!.prepare("SELECT token_hash IS NOT NULL AS paired,last_seen AS lastSeen,last_file AS lastFile,last_match AS lastMatch FROM midibard_connection WHERE id='owner'").first();
 return Response.json({connection,unmatched,matches,matchedSongCount},{headers});
}
export async function POST(request:Request){
 if(!await isOwner()||!sameOrigin(request))return Response.json({error:'Owner required'},{status:403,headers});
 await syncTables();
 let raw;try{raw=await request.json();}catch{return Response.json({error:'Invalid request'},{status:400,headers});}
 if(z.object({action:z.literal('pair')}).safeParse(raw).success){
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
  await env.DB!.prepare("INSERT INTO midibard_connection (id,token_hash) VALUES ('owner',?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,last_seen=NULL,last_file=NULL,last_match=NULL").bind(await hashToken(token)).run();
  return Response.json({token},{headers});
 }
 if(z.object({action:z.literal('disconnect')}).safeParse(raw).success){
  await env.DB!.batch([env.DB!.prepare("UPDATE midibard_connection SET token_hash=NULL WHERE id='owner'"),env.DB!.prepare("UPDATE midibard_playback SET playing=0 WHERE id='owner'")]);
  return Response.json({ok:true},{headers});
 }
 const reset=z.object({action:z.literal('reset-match'),fileKey:z.string().min(1).max(1000)}).safeParse(raw);
 if(reset.success){
  const mapping=await env.DB!.prepare('SELECT song_id AS songId FROM midibard_aliases WHERE file_key=?').bind(reset.data.fileKey).first<{songId:string}>();
  if(!mapping)return Response.json({error:'Saved match not found'},{status:404,headers});
  const showId=await currentShow();
  const {results:events}=await env.DB!.prepare('SELECT id,file_name AS file FROM midibard_events WHERE song_id=? AND show_id=?').bind(mapping.songId,showId).all<{id:string;file:string}>();
  const affected=events.filter(e=>fileKey(e.file)===reset.data.fileKey);
  await env.DB!.batch([
   env.DB!.prepare('INSERT OR IGNORE INTO midibard_match_resets (file_key) VALUES (?)').bind(reset.data.fileKey),
   env.DB!.prepare('DELETE FROM midibard_aliases WHERE file_key=?').bind(reset.data.fileKey),
   ...affected.map(e=>env.DB!.prepare('UPDATE midibard_events SET song_id=NULL WHERE id=?').bind(e.id)),
  ]);
  return Response.json({ok:true},{headers});
 }
 const parsed=z.object({action:z.literal('match'),id:z.string().uuid(),songId:z.string().max(100)}).safeParse(raw);
 if(!parsed.success)return Response.json({error:'Invalid request'},{status:400,headers});
 const event=await env.DB!.prepare('SELECT file_name AS file,show_id AS showId FROM midibard_events WHERE id=? AND show_id=?').bind(parsed.data.id,await currentShow()).first<{file:string;showId:string}>();
 const song=(await catalog()).find(s=>s.id===parsed.data.songId);
 if(!song||!event)return Response.json({error:'Song or event not found'},{status:404,headers});
 const {results:pending}=await env.DB!.prepare('SELECT id,file_name AS file FROM midibard_events WHERE show_id=? AND song_id IS NULL').bind(event.showId).all<{id:string;file:string}>();
 const matchingIds=new Set([parsed.data.id,...pending.filter(e=>fileKey(e.file)===fileKey(event.file)).map(e=>e.id)]);
 await env.DB!.batch([
  env.DB!.prepare('DELETE FROM midibard_match_resets WHERE file_key=?').bind(fileKey(event.file)),
  env.DB!.prepare('INSERT INTO midibard_aliases (file_key,song_id) VALUES (?,?) ON CONFLICT(file_key) DO UPDATE SET song_id=excluded.song_id').bind(fileKey(event.file),song.id),
  ...Array.from(matchingIds,id=>env.DB!.prepare('UPDATE midibard_events SET song_id=? WHERE id=?').bind(song.id,id)),
 ]);
 await matchCurrentPlayback(song,await catalog(),parsed.data.id,event.showId);
 await recordPlay(song,event.showId);
 return Response.json({ok:true},{headers});
}
