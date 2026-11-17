import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { authorized,fileKey,matchSong,playStatements,automaticMatchStatement,matchWasReset } from '../../../lib/midibard';
import { catalog } from '../../../lib/catalog';
import { currentShow } from '../../../lib/show';
import { includeRequesterNamesInSay } from '../../../lib/request-settings';
import { playbackState,livePlayback,waitingForSong,announcementText,sayAnnouncement } from '../../../lib/playback';
const headers={'Cache-Control':'no-store'};
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await authorized(request))return Response.json({error:'Invalid connection key'},{status:401,headers});
 await env.DB!.prepare("UPDATE midibard_connection SET last_seen=? WHERE id='owner'").bind(Date.now()).run();
 return Response.json({showId:await currentShow()},{headers});
}
export async function POST(request:Request){
 if(!await authorized(request))return Response.json({error:'Invalid connection key'},{status:401,headers});
 if(Number(request.headers.get('content-length')||0)>4096)return Response.json({error:'Too large'},{status:413,headers});
 let raw;try{raw=await request.json();}catch{return Response.json({error:'Invalid event'},{status:400,headers});}
 const parsed=z.object({action:z.enum(['start','state']).default('start'),eventId:z.string().uuid(),showId:z.string().min(1).max(100),file:z.string().trim().min(1).max(500).optional(),startedAt:z.number().int(),playing:z.boolean().optional()}).safeParse(raw);
 if(!parsed.success)return Response.json({error:'Invalid event'},{status:400,headers});
 const e=parsed.data,now=Date.now();
 if(Math.abs(now-e.startedAt)>60000||e.showId!==await currentShow())return Response.json({error:'Stale show or event'},{status:409,headers});
 if(e.action==='state'){
  if(typeof e.playing!=='boolean')return Response.json({error:'Playback state required'},{status:400,headers});
  const state=await playbackState();
  if(!state||state.eventId!==e.eventId||state.showId!==e.showId)return Response.json({error:'Playback has changed'},{status:409,headers});
  await env.DB!.batch([
   env.DB!.prepare("UPDATE midibard_playback SET playing=?,updated_at=? WHERE id='owner' AND event_id=? AND show_id=?").bind(e.playing?1:0,now,e.eventId,e.showId),
   env.DB!.prepare("UPDATE midibard_connection SET last_seen=? WHERE id='owner'").bind(now),
  ]);
  return Response.json({ok:true,matched:!!state.songId,announcement:e.playing?await sayAnnouncement(state):null},{headers});
 }
 if(!e.file)return Response.json({error:'Filename required'},{status:400,headers});
 const existing=await env.DB!.prepare('SELECT song_id AS songId FROM midibard_events WHERE id=?').bind(e.eventId).first<{songId:string|null}>();
 if(existing){
  const state=await playbackState();
  // A retry never completes newer requests or takes over a later song.
  return Response.json({ok:true,matched:!!existing.songId,announcement:state?.eventId===e.eventId&&livePlayback(state,e.showId)?await sayAnnouncement(state):null},{headers});
 }
 const songs=await catalog();
 const alias=await env.DB!.prepare('SELECT song_id AS songId FROM midibard_aliases WHERE file_key=?').bind(fileKey(e.file)).first<{songId:string}>();
 const song=await matchWasReset(e.file)?undefined:matchSong(e.file,songs,alias?.songId);
 const announcement=song?announcementText(song,await waitingForSong(song,songs,e.showId,now),await includeRequesterNamesInSay()):null;
 const statements=song?await playStatements(song,e.showId,now,e.eventId):[];
 await env.DB!.batch([
  env.DB!.prepare("INSERT INTO midibard_playback (id,show_id,event_id,song_id,file_name,announcement,playing,updated_at) SELECT 'owner',?,?,?,?,?,1,? WHERE NOT EXISTS (SELECT 1 FROM midibard_events WHERE id=?) AND EXISTS (SELECT 1 FROM show_state WHERE id='current' AND show_id=?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id,event_id=excluded.event_id,song_id=excluded.song_id,file_name=excluded.file_name,announcement=excluded.announcement,playing=1,updated_at=excluded.updated_at").bind(e.showId,e.eventId,song?.id||null,e.file,announcement,now,e.eventId,e.showId),
  ...(song?[automaticMatchStatement(e.file,song)]:[]),...statements,
  env.DB!.prepare("INSERT OR IGNORE INTO midibard_events (id,show_id,file_name,song_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM show_state WHERE id='current' AND show_id=?)").bind(e.eventId,e.showId,e.file,song?.id||null,now,e.showId),
  env.DB!.prepare("UPDATE midibard_connection SET last_seen=?, last_file=?, last_match=? WHERE id='owner' AND EXISTS (SELECT 1 FROM midibard_playback WHERE event_id=? AND show_id=?)").bind(now,e.file,song?.title||null,e.eventId,e.showId),
 ]);
 const saved=await playbackState();
 return Response.json({ok:true,matched:!!song,announcement:saved?.eventId===e.eventId&&livePlayback(saved,e.showId)?await sayAnnouncement(saved):null},{headers});
}
