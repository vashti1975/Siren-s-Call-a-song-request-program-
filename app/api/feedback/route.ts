import { z } from "zod";
import { env } from "cloudflare:workers";
import { isOwner, sameOrigin, privateHeaders } from "../../../lib/owner";
import type { ListenerFeedback } from "../../../lib/feedback";
export const dynamic = "force-dynamic";

export async function GET() {
 if(!await isOwner())return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 const {results:comments}=await env.DB!.prepare("SELECT id,name,message,created_at AS createdAt FROM listener_feedback WHERE archived_at IS NULL ORDER BY created_at ASC,id ASC").all<ListenerFeedback>();
 return Response.json({comments},{headers:privateHeaders});
}

export async function POST(request:Request) {
 const headers={"Cache-Control":"no-store"};
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403,headers});
 let raw;try{raw=await request.json();}catch{return Response.json({error:"Invalid feedback"},{status:400,headers});}
 const parsed=z.object({id:z.string().uuid(),name:z.string().trim().max(80).optional(),message:z.string().trim().min(1).max(1000),embedded:z.boolean().optional()}).safeParse(raw);
 if(!parsed.success)return Response.json({error:"Enter a comment of up to 1,000 characters. Your optional name can be up to 80 characters."},{status:400,headers});
 const body=parsed.data,now=Date.now();
 const visitor=request.headers.get("cookie")?.match(/(?:^|; )songbook_listener=([0-9a-f-]{36})(?:;|$)/)?.[1]||crypto.randomUUID();
 const existing=await env.DB!.prepare("SELECT id,visitor FROM listener_feedback WHERE id=?").bind(body.id).first<{id:string;visitor:string}>();
 if(existing&&existing.visitor!==visitor)return Response.json({error:"Please refresh and try again."},{status:409,headers});
 if(!existing){
  // The limit is checked in the insert so parallel sends cannot skip it.
  await env.DB!.prepare("INSERT OR IGNORE INTO listener_feedback (id,visitor,name,message,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM listener_feedback WHERE visitor=? AND created_at>?)<5").bind(body.id,visitor,body.name||null,body.message,now,visitor,now-300000).run();
  const accepted=await env.DB!.prepare("SELECT id FROM listener_feedback WHERE id=? AND visitor=?").bind(body.id,visitor).first();
  if(!accepted)return Response.json({error:"Please wait a few minutes before sending more feedback."},{status:429,headers});
 }
 return Response.json({ok:true},{headers:{...headers,"Set-Cookie":`songbook_listener=${visitor}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=${body.embedded?"None; Partitioned":"Lax"}`}});
}

export async function PATCH(request:Request) {
 if(!await isOwner())return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
 if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403,headers:privateHeaders});
 let raw;try{raw=await request.json();}catch{return Response.json({error:"Invalid feedback"},{status:400,headers:privateHeaders});}
 const parsed=z.object({id:z.string().uuid(),undo:z.boolean().optional()}).safeParse(raw);
 if(!parsed.success)return Response.json({error:"Invalid feedback"},{status:400,headers:privateHeaders});
 const found=await env.DB!.prepare("SELECT id FROM listener_feedback WHERE id=?").bind(parsed.data.id).first();
 if(!found)return Response.json({error:"Feedback not found"},{status:404,headers:privateHeaders});
 await env.DB!.prepare("UPDATE listener_feedback SET archived_at=? WHERE id=?").bind(parsed.data.undo?null:Date.now(),parsed.data.id).run();
 return Response.json({ok:true},{headers:privateHeaders});
}
