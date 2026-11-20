import { env } from 'cloudflare:workers';
import { songKey } from './show';
import { catalog } from './catalog';
import { includeRequesterNamesInSay } from './request-settings';
import type { Song } from './songs';
export const playbackLeaseMs=20000;
export type Playback={showId:string;eventId:string;songId:string|null;fileName:string;announcement:string|null;playing:number;updatedAt:number};
export async function playbackState(){
 return env.DB!.prepare("SELECT show_id AS showId,event_id AS eventId,song_id AS songId,file_name AS fileName,announcement,playing,updated_at AS updatedAt FROM midibard_playback WHERE id='owner'").first<Playback>();
}
// A refresh may rebuild only the latest recorded event in the current show.
// Reuse its identity without recording another play or completing later requests.
export async function restorePlaybackForRefresh(eventId:string,showId:string,playing:boolean,requestedAt:number,now:number){
 const event=await env.DB!.prepare('SELECT id,file_name AS file,song_id AS songId FROM midibard_events WHERE show_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(showId).first<{id:string;file:string;songId:string|null}>();
 if(event?.id!==eventId)return null;
 const state=await playbackState();
 const song=(await catalog()).find(s=>s.id===event.songId);
 const announcement=state?.eventId===eventId&&state.showId===showId?state.announcement:null;
 await env.DB!.prepare("INSERT INTO midibard_playback (id,show_id,event_id,song_id,file_name,announcement,playing,updated_at) SELECT 'owner',?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM midibard_connection_refresh WHERE id='owner' AND requested_at=? AND confirmed_at IS NULL) AND EXISTS (SELECT 1 FROM show_state WHERE id='current' AND show_id=?) AND ?=(SELECT id FROM midibard_events WHERE show_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id,event_id=excluded.event_id,song_id=excluded.song_id,file_name=excluded.file_name,announcement=excluded.announcement,playing=excluded.playing,updated_at=excluded.updated_at").bind(showId,eventId,song?.id||null,event.file,announcement,playing?1:0,now,requestedAt,showId,eventId,showId).run();
 const saved=await playbackState();
 return saved?.eventId===eventId&&saved.showId===showId?saved:null;
}
export function livePlayback(state:Playback|null,showId:string,now=Date.now()){
 return !!state&&state.showId===showId&&!!state.playing&&state.updatedAt>=now-playbackLeaseMs;
}
function clean(value:string){return value.replace(/[\p{C}]/gu,' ').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();}
function shorten(value:string,max:number){
 const text=clean(value),encoder=new TextEncoder();if(encoder.encode(text).length<=max)return text;
 let out='';for(const point of text){if(encoder.encode(out+point+'…').length>max)break;out+=point;}return out+'…';
}
export function announcementText(song:Song,requests:{requesterName:string|null}[],includeNames=true){
 const names=includeNames?[...new Map(requests.flatMap(r=>{const name=clean(r.requesterName||'');return name?[[name.toLocaleLowerCase(),name] as const]:[];})).values()]:[];
 const prefix=requests.length?'By Request'+(names.length?' by '+shorten(names.join(' & '),140):'')+' ':'';
 return `${prefix}♪ ${shorten(song.title,140)} — ${shorten(song.artist,100)} ♪`;
}
export async function waitingForSong(song:Song,songs:Song[],showId:string,cutoff:number){
 const ids=songs.filter(s=>songKey(s)===songKey(song)).map(s=>s.id);
 return (await env.DB!.prepare(`SELECT requester_name AS requesterName FROM listener_requests WHERE show_id=? AND played_at IS NULL AND created_at<=? AND song_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at,id`).bind(showId,cutoff,...ids).all<{requesterName:string|null}>()).results;
}
export async function matchCurrentPlayback(song:Song,songs:Song[],eventId:string,showId:string){
 const state=await playbackState();if(!state||state.eventId!==eventId||state.showId!==showId)return;
 const announcement=state.announcement||announcementText(song,await waitingForSong(song,songs,showId,Date.now()),await includeRequesterNamesInSay());
 await env.DB!.prepare("UPDATE midibard_playback SET song_id=?,announcement=? WHERE id='owner' AND event_id=? AND show_id=?").bind(song.id,announcement,eventId,showId).run();
}

// Enforce the latest switch even for an already prepared event or a retry.
export async function sayAnnouncement(state:Playback|null):Promise<string|null>{
 if(!state?.announcement)return null;
 if(await includeRequesterNamesInSay()||!state.announcement.startsWith('By Request'))return state.announcement;
 const song=(await catalog()).find(s=>s.id===state.songId);
 return song?announcementText(song,[{requesterName:null}],false):null;
}
