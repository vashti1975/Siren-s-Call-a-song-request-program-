import {env} from 'cloudflare:workers';
import {currentShow,songKey} from './show';
import type {Song} from './songs';
import {catalog} from './catalog';
export const showLimitSeconds=3600;
export type ShowBudget={enabled:boolean;playedSeconds:number;queuedSeconds:number;totalSeconds:number;remainingSeconds:number;unknownPlayed:number;unknownQueued:number;knownSongs:number;pendingKeys:string[]};
export type RequestFit='ok'|'length-needed'|'full';
export const budgetRevisionCondition="COALESCE((SELECT revision FROM request_budget_revision WHERE id='current'),0)=?";
export async function currentBudgetRevision(){return (await env.DB!.prepare("SELECT revision FROM request_budget_revision WHERE id='current'").first<{revision:number}>())?.revision??0;}
export async function hourLimitEnabled(){return (await env.DB!.prepare("SELECT show_id AS value FROM show_state WHERE id='hour-limit'").first<{value:string}>())?.value==='on';}
export async function setHourLimit(enabled:boolean){await env.DB!.prepare("INSERT INTO show_state(id,show_id) VALUES ('hour-limit',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(enabled?'on':'off').run();}
export async function showBudget(songs:Song[],selectedShowId?:string):Promise<ShowBudget>{
 const showId=selectedShowId??await currentShow();
 const available=new Set(songs.map(s=>s.id));
 const byId=new Map((await catalog({includeRemoved:true})).map(s=>[s.id,s]));
 const {results:midi}=await env.DB!.prepare('SELECT song_id AS songId,created_at AS createdAt FROM midibard_events WHERE show_id=?').bind(showId).all<{songId:string|null;createdAt:number}>();
 const {results:manual}=await env.DB!.prepare('SELECT song_id AS songId,created_at AS createdAt FROM show_manual_plays WHERE show_id=?').bind(showId).all<{songId:string;createdAt:number}>();
 const {results:legacy}=await env.DB!.prepare('SELECT song_id AS songId,0 AS createdAt FROM show_plays WHERE show_id=? UNION SELECT song_id AS songId,played_at AS createdAt FROM listener_requests WHERE show_id=? AND played_at IS NOT NULL').bind(showId,showId).all<{songId:string;createdAt:number}>();
 const {results:waiting}=await env.DB!.prepare('SELECT song_id AS songId,created_at AS createdAt FROM listener_requests WHERE show_id=? AND played_at IS NULL').bind(showId).all<{songId:string;createdAt:number}>();
 let playedSeconds=0,queuedSeconds=0,unknownPlayed=0,unknownQueued=0;
 const counted=new Set<string>(),pending=new Map<string,Song|undefined>(),lastPlayed=new Map<string,number>();
 function countPlayed(id:string|null){const song=id?byId.get(id):undefined;if(song)counted.add(songKey(song));if(song?.durationSeconds)playedSeconds+=song.durationSeconds;else unknownPlayed++;}
 for(const row of [...midi,...manual]){countPlayed(row.songId);const song=row.songId?byId.get(row.songId):undefined;if(song)lastPlayed.set(songKey(song),Math.max(lastPlayed.get(songKey(song))??0,row.createdAt));}
 for(const row of legacy){const song=byId.get(row.songId),key=song?songKey(song):row.songId;if(row.createdAt)lastPlayed.set(key,Math.max(lastPlayed.get(key)??0,row.createdAt));if(counted.has(key))continue;countPlayed(row.songId);counted.add(key);}
 // Several listeners requesting the same arrangement reserve one performance.
 for(const row of waiting){if(!available.has(row.songId))continue;const song=byId.get(row.songId),key=song?songKey(song):row.songId;if((lastPlayed.get(key)??-1)>=row.createdAt)continue;pending.set(key,song);}
 for(const song of pending.values()){if(song?.durationSeconds)queuedSeconds+=song.durationSeconds;else unknownQueued++;}
 const totalSeconds=playedSeconds+queuedSeconds;
 return {enabled:await hourLimitEnabled(),playedSeconds,queuedSeconds,totalSeconds,remainingSeconds:Math.max(0,showLimitSeconds-totalSeconds),unknownPlayed,unknownQueued,knownSongs:songs.filter(s=>!!s.durationSeconds).length,pendingKeys:[...pending.keys()]};
}
export function requestFit(song:Song,budget:ShowBudget):RequestFit{
 if(!budget.enabled)return 'ok';
 if(budget.unknownPlayed||budget.unknownQueued||!song.durationSeconds)return 'length-needed';
 if(budget.totalSeconds>=showLimitSeconds)return 'full';
 return budget.pendingKeys.includes(songKey(song))||song.durationSeconds<=budget.remainingSeconds?'ok':'full';
}
export function publicBudget(songs:Song[],budget:ShowBudget){return {enabled:budget.enabled,remainingSeconds:budget.remainingSeconds,checkingLengths:!!(budget.unknownPlayed||budget.unknownQueued),fit:Object.fromEntries(songs.map(s=>[s.id,requestFit(s,budget)]))};}
export type PublicBudget=ReturnType<typeof publicBudget>;
