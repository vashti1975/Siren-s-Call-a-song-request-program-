import { z } from "zod";
import { env } from "cloudflare:workers";
import { catalog } from "../../../lib/catalog";
import { isOwner, sameOrigin, privateHeaders } from "../../../lib/owner";
import { normalize, setNames } from "../../../lib/songs";
import { currentShow, showStatuses, songKey } from "../../../lib/show";
import {showBudget,setHourLimit} from "../../../lib/show-budget";
import { requestHistoryStart, requestTotalsCondition, resetRequestTotals } from "../../../lib/request-history";
import { playStatements } from "../../../lib/midibard";
import { areRequestsOpen, setRequestsOpen, includeRequesterNamesInSay, setRequesterNamesInSay } from "../../../lib/request-settings";
import { noteAwardStatement } from "../../../lib/listener";
export const dynamic = "force-dynamic";
export async function GET() {
 if (!await isOwner()) return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 const {results} = await env.DB!.prepare("SELECT song_id AS songId, COUNT(*) AS total, MAX(created_at) AS lastRequested FROM listener_requests WHERE "+requestTotalsCondition+" GROUP BY song_id").bind(await requestHistoryStart()).all();
 const songs=await catalog(),historySongs=await catalog({includeRemoved:true});
 const key=(s:{title:string;artist:string})=>normalize(s.title.trim()+"|"+s.artist.trim());
 const grouped=new Map<string,number>();let totalRequests=0;
 for(const row of results as {songId:string;total:number}[]) {const song=historySongs.find(s=>s.id===row.songId);totalRequests+=row.total;if(song)grouped.set(key(song),(grouped.get(key(song))||0)+row.total);}
 const counts=songs.map(s=>({songId:s.id,total:grouped.get(key(s))||0}));
 const {results:pending} = await env.DB!.prepare("SELECT id, song_id AS songId, created_at AS createdAt, requester_name AS requesterName FROM listener_requests WHERE played_at IS NULL AND show_id=? ORDER BY created_at ASC, id ASC").bind(await currentShow()).all<{id:string;songId:string;createdAt:number;requesterName:string|null}>();
 const queue=pending.filter(r=>songs.some(s=>s.id===r.songId)).map(r=>({...r,song:songs.find(s=>s.id===r.songId)}));
 return Response.json({songs,counts,totalRequests,queue,statuses:await showStatuses(songs),requestsOpen:await areRequestsOpen(),includeRequesterNames:await includeRequesterNamesInSay(),showBudget:await showBudget(songs)},{headers:privateHeaders});
}

export async function DELETE(request: Request) {
 if(!await isOwner())return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403,headers:privateHeaders});
 let raw;try{raw=await request.json();}catch{return Response.json({error:"Invalid request"},{status:400,headers:privateHeaders});}
 const parsed=z.object({id:z.string().min(1).max(100),confirmed:z.literal(true)}).safeParse(raw);
 if(!parsed.success)return Response.json({error:"Confirm the song you want to remove."},{status:400,headers:privateHeaders});
 const song=(await catalog({includeRemoved:true})).find(s=>s.id===parsed.data.id);
 if(!song)return Response.json({error:"Song not found"},{status:404,headers:privateHeaders});
 // Save a removal marker for original songs too, so a refresh cannot restore them.
 // Retain metadata and request/play records for totals, rewards and elapsed show time.
 await env.DB!.prepare('INSERT INTO song_edits(id,title,artist,song_set,note,updated_at,removed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET removed_at=COALESCE(song_edits.removed_at,excluded.removed_at)').bind(song.id,song.title,song.artist,song.set,song.note||"",Date.now(),Date.now()).run();
 return Response.json({ok:true,id:song.id},{headers:privateHeaders});
}
export async function POST(request: Request) {
 if (!await isOwner()) return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403});
 let raw; try {raw=await request.json();} catch {return Response.json({error:"Invalid song"},{status:400});}
 const parsed=z.object({id:z.string().optional(),title:z.string().trim().min(1).max(200),artist:z.string().trim().min(1).max(200),set:z.enum(setNames),note:z.string().max(500).default(""),durationSeconds:z.number().int().min(1).max(86400).nullable().optional()}).safeParse(raw);
 if(!parsed.success) return Response.json({error:"Enter a title, artist/source, valid set and notes under 500 characters."},{status:400});
 const {id,title,artist,set,note}=parsed.data;
 const all=await catalog();
 if (id && (typeof id!=="string" || !all.some(s=>s.id===id))) return Response.json({error:"Song not found"},{status:404});
 const songId=id || crypto.randomUUID();
 await env.DB!.prepare('INSERT INTO song_edits (id,title,artist,song_set,note,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,artist=excluded.artist,song_set=excluded.song_set,note=excluded.note,updated_at=excluded.updated_at').bind(songId,title.trim(),artist.trim(),set,note.trim(),Date.now()).run();
 if(parsed.data.durationSeconds!==undefined){
  const ids=[songId,...all.filter(s=>s.id!==songId&&songKey(s)===songKey({id:songId,title,artist,set})).map(s=>s.id)];
  await env.DB!.batch(ids.map(id=>parsed.data.durationSeconds===null?env.DB!.prepare('DELETE FROM song_durations WHERE song_id=?').bind(id):env.DB!.prepare('INSERT INTO song_durations(song_id,seconds,updated_at) VALUES(?,?,?) ON CONFLICT(song_id) DO UPDATE SET seconds=excluded.seconds,updated_at=excluded.updated_at').bind(id,parsed.data.durationSeconds!,Date.now())));
 }
 return Response.json({ok:true,id:songId},{headers:privateHeaders});
}

export async function PATCH(request: Request) {
 if (!await isOwner()) return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403,headers:privateHeaders});
 let raw;try {raw=await request.json();}catch{return Response.json({error:"Invalid request"},{status:400,headers:privateHeaders});}
 const totals=z.object({action:z.literal("reset-request-totals"),confirmed:z.literal(true),operationId:z.string().uuid()}).safeParse(raw);
 if(totals.success){await resetRequestTotals(totals.data.operationId);return Response.json({ok:true},{headers:privateHeaders});}
 const hour=z.object({action:z.literal("set-hour-limit"),enabled:z.boolean()}).safeParse(raw);
 if(hour.success){await setHourLimit(hour.data.enabled);return Response.json({ok:true,enabled:hour.data.enabled},{headers:privateHeaders});}
 const gate=z.object({action:z.literal("set-requests-open"),open:z.boolean()}).safeParse(raw);
 if(gate.success){
   await setRequestsOpen(gate.data.open);
   return Response.json({ok:true,requestsOpen:gate.data.open},{headers:privateHeaders});
 }
 const sayNames=z.object({action:z.literal("set-say-requester-names"),includeNames:z.boolean()}).safeParse(raw);
 if(sayNames.success){
   await setRequesterNamesInSay(sayNames.data.includeNames);
   return Response.json({ok:true,includeRequesterNames:sayNames.data.includeNames},{headers:privateHeaders});
 }
 const mark=z.object({action:z.literal("mark-song-played"),songId:z.string().min(1).max(100)}).safeParse(raw);
 if(mark.success){
   const song=(await catalog()).find(s=>s.id===mark.data.songId);
   if(!song)return Response.json({error:"Song not found"},{status:404,headers:privateHeaders});
   const showId=await currentShow();
   await env.DB!.batch([...await playStatements(song,showId),env.DB!.prepare('INSERT INTO show_manual_plays(id,show_id,song_id,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),showId,song.id,Date.now())]);
   return Response.json({ok:true},{headers:privateHeaders});
 }
 if(z.object({action:z.literal("reset-show")}).safeParse(raw).success) {
   const showId=crypto.randomUUID();
   await env.DB!.prepare("INSERT INTO show_state (id,show_id) VALUES ('current',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(showId).run();
   return Response.json({ok:true},{headers:privateHeaders});
 }
 const parsed=z.object({id:z.string().uuid(),undo:z.boolean().optional()}).safeParse(raw);
 if(!parsed.success)return Response.json({error:"Invalid request"},{status:400,headers:privateHeaders});
 const showId=await currentShow();
 const found=await env.DB!.prepare("SELECT id,song_id AS songId,created_at AS createdAt,played_at AS playedAt FROM listener_requests WHERE id=? AND show_id=?").bind(parsed.data.id,showId).first<{id:string;songId:string;createdAt:number;playedAt:number|null}>();
 if(!found)return Response.json({error:"Request not found"},{status:404,headers:privateHeaders});
 if(!(await catalog()).some(s=>s.id===found.songId))return Response.json({error:"This song has been removed."},{status:404,headers:privateHeaders});
 const completedAt=Date.now();
 const extra=[];
 if(parsed.data.undo)extra.push(env.DB!.prepare('DELETE FROM show_manual_plays WHERE id=?').bind('request:'+parsed.data.id));
 else if(found.playedAt===null){
  const songs=await catalog(),song=songs.find(s=>s.id===found.songId);
  const ids=song?songs.filter(s=>songKey(s)===songKey(song)).map(s=>s.id):[found.songId];
  const slots=ids.map(()=>'?').join(',');
  extra.push(env.DB!.prepare(`INSERT OR IGNORE INTO show_manual_plays(id,show_id,song_id,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM midibard_events WHERE show_id=? AND created_at>=? AND song_id IN (${slots})) AND NOT EXISTS(SELECT 1 FROM show_manual_plays WHERE show_id=? AND created_at>=? AND song_id IN (${slots}))`).bind('request:'+found.id,showId,found.songId,completedAt,showId,found.createdAt,...ids,showId,found.createdAt,...ids));
 }
 await env.DB!.batch([
  ...(!parsed.data.undo?[noteAwardStatement("id=? AND show_id=?",[parsed.data.id,showId],completedAt)]:[]),
  env.DB!.prepare("UPDATE listener_requests SET played_at=? WHERE id=?").bind(parsed.data.undo?null:completedAt,parsed.data.id),...extra
 ]);
 return Response.json({ok:true},{headers:privateHeaders});
}
