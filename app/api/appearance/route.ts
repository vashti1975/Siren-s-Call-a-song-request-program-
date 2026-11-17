import {isOwner,sameOrigin,privateHeaders} from "../../../lib/owner";
import {appearanceSchema,readAppearance,writeAppearance} from "../../../lib/appearance-store";
export const dynamic="force-dynamic";
export async function GET() {return Response.json(await readAppearance(),{headers:{"Cache-Control":"no-store"}});}
export async function PUT(request:Request) {
  if(!await isOwner())return Response.json({error:"Owner access required"},{status:403,headers:privateHeaders});
  if(!sameOrigin(request))return Response.json({error:"Invalid origin"},{status:403,headers:privateHeaders});
  let raw;try {const text=await request.text();if(text.length>1400000)throw new Error();raw=JSON.parse(text);}catch {return Response.json({error:"Invalid or oversized appearance settings"},{status:400,headers:privateHeaders});}
  const parsed=appearanceSchema.safeParse(raw);
  if(!parsed.success)return Response.json({error:"Check the title, colors and image fields. Images must be PNG, JPEG, WebP or GIF (300 KB per upload)."},{status:400,headers:privateHeaders});
  await writeAppearance(parsed.data);
  return Response.json(parsed.data,{headers:privateHeaders});
}
