import { z } from "zod";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { sameOrigin,privateHeaders } from "../../../lib/owner";
import { listenerData,listenerUserId } from "../../../lib/listener";
import { listenerThemes } from "../../../lib/listener-rewards";
import { catalog } from "../../../lib/catalog";
import {stickerAnchors} from '../../../lib/listener-stickers';
import {specialReward} from '../../../lib/special-rewards';
export const dynamic="force-dynamic";
export async function GET(){return Response.json(await listenerData(),{headers:privateHeaders});}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403,headers:privateHeaders});
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"Sign in to use your listener profile."},{status:401,headers:privateHeaders});
 let raw;try{raw=await request.json();}catch{return Response.json({error:"Invalid profile update"},{status:400,headers:privateHeaders});}
 const parsed=z.discriminatedUnion("action",[
  z.object({action:z.literal("create")}),
  z.object({action:z.literal("redeem"),rewardId:z.string().min(1).max(100)}),
  z.object({action:z.literal("favorite"),songId:z.string().min(1).max(100),favorite:z.boolean()}),
  z.object({action:z.literal("profile"),name:z.string().trim().min(1).max(80).refine(s=>!/[\p{C}]/u.test(s)),theme:z.enum(listenerThemes),featured:z.array(z.string().max(100)).max(1000)}),
  z.object({action:z.literal("stickers"),placements:z.array(z.object({id:z.string().min(1).max(100),anchor:z.enum(stickerAnchors),x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)})).max(1000)})
 ]).safeParse(raw);
 if(!parsed.success)return Response.json({error:"Check your profile name, theme and decorations."},{status:400,headers:privateHeaders});
 const body=parsed.data,now=Date.now();
 if(body.action==="create"){
  await env.DB!.prepare("INSERT OR IGNORE INTO listener_profiles (user_id,name,theme,featured,created_at,updated_at) VALUES (?,'Music lover','ocean','[]',?,?)").bind(user.userId,now,now).run();
 }else{
  if(!await listenerUserId())return Response.json({error:"Create your optional listener profile first."},{status:403,headers:privateHeaders});
  if(body.action==="redeem"){
   const reward=specialReward(body.rewardId);
   if(!reward)return Response.json({error:"That special reward is not available."},{status:404,headers:privateHeaders});
   // One atomic statement checks the latest balance and buys once. Concurrent
   // exchanges cannot overspend, and retries never charge for an owned reward.
   await env.DB!.prepare("INSERT OR IGNORE INTO listener_reward_purchases (user_id,reward_id,cost,purchased_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM listener_note_awards WHERE user_id=?)-(SELECT COALESCE(SUM(cost),0) FROM listener_reward_purchases WHERE user_id=?)>=?").bind(user.userId,reward.id,reward.cost,now,user.userId,user.userId,reward.cost).run();
   const result=await listenerData();
   if(!result.ownedSpecialRewards?.includes(reward.id))return Response.json({error:`You need ${reward.cost} music notes for this chibi. Your balance is ${result.noteCount}.`},{status:409,headers:privateHeaders});
   return Response.json(result,{headers:privateHeaders});
  }else if(body.action==="favorite"){
   if(!(await catalog()).some(s=>s.id===body.songId))return Response.json({error:"Song not found"},{status:404,headers:privateHeaders});
   if(body.favorite)await env.DB!.prepare("INSERT OR IGNORE INTO listener_favorites (user_id,song_id,created_at) VALUES (?,?,?)").bind(user.userId,body.songId,now).run();
   else await env.DB!.prepare("DELETE FROM listener_favorites WHERE user_id=? AND song_id=?").bind(user.userId,body.songId).run();
  }else{
   const own=await listenerData();
   const allowed=new Set(own.awards.map(a=>a.id));
   const ids=body.action==='stickers'?body.placements.map(p=>p.id):body.featured;
   if(ids.includes('music-notes'))return Response.json({error:"Music notes are a fixed reward balance and cannot be placed as a sticker."},{status:400,headers:privateHeaders});
   if(ids.some(id=>!allowed.has(id)))return Response.json({error:"Only awards you have earned can be placed on your page."},{status:400,headers:privateHeaders});
   if(body.action==='stickers'){
    if(new Set(ids).size!==ids.length)return Response.json({error:"Place each sticker once on your page."},{status:400,headers:privateHeaders});
    await env.DB!.prepare("UPDATE listener_profiles SET featured=?,placements=?,updated_at=? WHERE user_id=?").bind(JSON.stringify(ids),JSON.stringify(body.placements),now,user.userId).run();
   }else await env.DB!.prepare("UPDATE listener_profiles SET name=?,theme=?,featured=?,updated_at=? WHERE user_id=?").bind(body.name,body.theme,JSON.stringify([...new Set(body.featured)]),now,user.userId).run();
  }
 }
 return Response.json(await listenerData(),{headers:privateHeaders});
}
