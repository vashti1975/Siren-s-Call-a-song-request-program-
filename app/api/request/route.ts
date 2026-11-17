import { z } from "zod";
import { env } from "cloudflare:workers";
import { catalog } from "../../../lib/catalog";
import { sameOrigin } from "../../../lib/owner";
import { currentShow } from "../../../lib/show";
import { areRequestsOpen, requestsOpenCondition } from "../../../lib/request-settings";
import { listenerUserId } from "../../../lib/listener";
import {budgetRevisionCondition,currentBudgetRevision,showBudget,requestFit} from "../../../lib/show-budget";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
 if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403});
 let raw;try {raw=await request.json();} catch {return Response.json({error:"Invalid request"},{status:400});}
 const parsed=z.object({id:z.string().uuid(),songId:z.string().min(1).max(100),requesterName:z.string().trim().max(80).optional(),embedded:z.boolean().optional()}).safeParse(raw);
 if(!parsed.success) return Response.json({error:"Invalid request. Ingame names can be up to 80 characters, or left blank."},{status:400});
 const body=parsed.data;
 if (!(await catalog()).some(s=>s.id===body.songId)) return Response.json({error:"This song is unavailable. Refresh and choose another."},{status:404});
 const cookie=request.headers.get("cookie")?.match(/(?:^|; )songbook_listener=([0-9a-f-]{36})(?:;|$)/)?.[1];
 const visitor=cookie || crypto.randomUUID();
 const userId=await listenerUserId();
 const showId=await currentShow();
 const now=Date.now();
 const ownRequest="id=? AND ((user_id=? AND ? IS NOT NULL) OR (user_id IS NULL AND visitor=? AND ? IS NULL))";
 const existing=await env.DB!.prepare("SELECT id FROM listener_requests WHERE "+ownRequest).bind(body.id,userId,userId,visitor,userId).first();
 if (!existing) {
 const closed=()=>Response.json({code:"REQUESTS_CLOSED",error:"Requests are closed right now. You can still browse the songbook."},{status:409,headers:{"Cache-Control":"no-store"}});
 if(!await areRequestsOpen())return closed();
 const count=await env.DB!.prepare("SELECT COUNT(*) AS n FROM listener_requests WHERE (visitor=? OR (user_id=? AND ? IS NOT NULL)) AND created_at>?").bind(visitor,userId,userId,now-300000).first<{n:number}>();
 if ((count?.n??0)>=10) return Response.json({error:"Please wait a few minutes before requesting more songs."},{status:429});
 // Check in the insert itself as well: an already-open listener page cannot
 // slip a request through after the owner closes requests.
 let accepted=false;
 for(let attempt=0;attempt<4&&!accepted;attempt++){
  const revision=await currentBudgetRevision();
  const latestShow=await currentShow(),songs=await catalog(),song=songs.find(s=>s.id===body.songId);
  if(!song)return Response.json({error:"This song is unavailable."},{status:404});
  const fit=requestFit(song,await showBudget(songs,latestShow));
  if(fit!=='ok')return Response.json({code:fit==='full'?"SHOW_TIME_FULL":"DURATION_REQUIRED",error:fit==='full'?"This song would exceed the one-hour show. Please choose a shorter song or enjoy the performance.":"Songbook needs to confirm song lengths before this request can fit the one-hour show."},{status:409,headers:{"Cache-Control":"no-store"}});
  await env.DB!.prepare("INSERT OR IGNORE INTO listener_requests (id,song_id,visitor,created_at,show_id,requester_name,user_id) SELECT ?,?,?,?,?,?,? WHERE "+requestsOpenCondition+" AND "+budgetRevisionCondition).bind(body.id,body.songId,visitor,now,latestShow,body.requesterName||null,userId,revision).run();
  accepted=!!await env.DB!.prepare("SELECT id FROM listener_requests WHERE "+ownRequest).bind(body.id,userId,userId,visitor,userId).first();
 }
 if(!accepted){
   if(!await areRequestsOpen())return closed();
   return Response.json({error:"Could not send this request. Please try again."},{status:409,headers:{"Cache-Control":"no-store"}});
 }
 }
 // Carrd embeds use a visitor cookie partitioned to their containing site.
 // This is a guest identifier only; account authentication remains platform-owned.
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":`songbook_listener=${visitor}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=${body.embedded?"None; Partitioned":"Lax"}`}});
}
