import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { catalog } from "./catalog";
import { songKey } from "./show";
import { requestAwards, nextRequestMilestone, listenerThemes, stickerCollectionThrough, type ListenerProfileData } from "./listener-rewards";
import {readStickerPlacements} from './listener-stickers';
import {specialRewards} from './special-rewards';

export async function listenerUserId(){
 const user=await getChatGPTUser();
 if(!user?.userId)return null;
 const profile=await env.DB!.prepare("SELECT user_id FROM listener_profiles WHERE user_id=?").bind(user.userId).first();
 return profile?user.userId:null;
}
export async function listenerData():Promise<ListenerProfileData>{
 const user=await getChatGPTUser();
 const empty:ListenerProfileData={signedIn:!!user,enabled:false,favorites:[],totalRequests:0,noteCount:0,nextMilestone:1,songCounts:[],awards:[]};
 if(!user)return empty;
 const profile=await env.DB!.prepare("SELECT name,theme,featured,placements,sticker_unlock_through AS stickerUnlockThrough FROM listener_profiles WHERE user_id=?").bind(user.userId).first<{name:string;theme:string;featured:string;placements:string;stickerUnlockThrough:number}>();
 if(!profile)return empty;
 const [counts,favorites,notes,songs,purchases]=await Promise.all([
  env.DB!.prepare("SELECT song_id AS songId,COUNT(*) AS requests FROM listener_requests WHERE user_id=? GROUP BY song_id").bind(user.userId).all<{songId:string;requests:number}>(),
  env.DB!.prepare("SELECT song_id AS songId FROM listener_favorites WHERE user_id=? ORDER BY created_at DESC").bind(user.userId).all<{songId:string}>(),
  env.DB!.prepare("SELECT song_id AS songId,COUNT(*) AS played FROM listener_note_awards WHERE user_id=? GROUP BY song_id").bind(user.userId).all<{songId:string;played:number}>(),catalog({includeRemoved:true}),
  env.DB!.prepare("SELECT reward_id AS rewardId,cost FROM listener_reward_purchases WHERE user_id=?").bind(user.userId).all<{rewardId:string;cost:number}>()
 ]);
 const totalRequests=counts.results.reduce((n,r)=>n+r.requests,0);
 const noteCount=Math.max(0,notes.results.reduce((n,r)=>n+r.played,0)-purchases.results.reduce((n,r)=>n+r.cost,0));
 const ownedSpecialRewards=purchases.results.map(row=>row.rewardId);
 const awards=[...requestAwards(Math.max(totalRequests,profile.stickerUnlockThrough)),...specialRewards.filter(reward=>ownedSpecialRewards.includes(reward.id)).map(reward=>({id:reward.id,title:reward.title,milestone:0,kind:"chibi" as const,artwork:reward.artwork,noteCost:reward.cost}))];
 const allowed=new Set(awards.map(a=>a.id));
 let featured:string[]=[];try{const value=JSON.parse(profile.featured);if(Array.isArray(value))featured=value.filter((s):s is string=>typeof s==="string"&&allowed.has(s));}catch{}
 const grouped=new Map<string,{songId:string;title:string;artist:string;requests:number;played:number}>();
 for(const row of counts.results){const song=songs.find(s=>s.id===row.songId);const key=song?songKey(song):row.songId;const current=grouped.get(key)||{songId:row.songId,title:song?.title||"Unavailable song",artist:song?.artist||"",requests:0,played:0};current.requests+=row.requests;current.played+=notes.results.find(n=>n.songId===row.songId)?.played||0;grouped.set(key,current);}
 return {...empty,enabled:true,profile:{name:profile.name,theme:listenerThemes.includes(profile.theme as typeof listenerThemes[number])?profile.theme as typeof listenerThemes[number]:"ocean",featured,placements:readStickerPlacements(profile.placements,featured)},favorites:favorites.results.map(s=>s.songId),totalRequests,noteCount,nextMilestone:nextRequestMilestone(totalRequests),awards,ownedSpecialRewards,collectionUnlocked:profile.stickerUnlockThrough>=stickerCollectionThrough,songCounts:[...grouped.values()].sort((a,b)=>b.requests-a.requests||a.title.localeCompare(b.title))};
}

// This statement runs before marking requests played in the same D1 batch.
// One row per fulfilled request makes retries, duplicate events and Undo safe.
export function noteAwardStatement(where:string,args:(string|number)[],earnedAt:number){
 return env.DB!.prepare("INSERT OR IGNORE INTO listener_note_awards (request_id,user_id,song_id,earned_at) SELECT id,user_id,song_id,? FROM listener_requests WHERE user_id IS NOT NULL AND played_at IS NULL AND "+where).bind(earnedAt,...args);
}
