import {env} from "cloudflare:workers";
import {z} from "zod";
import {defaultAppearance, type Appearance} from "./appearance";
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const image = z.string().max(420000).refine(value => value === "" || /^\/(?!\/)[^\s]*$/.test(value) || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) || (() => {try {return new URL(value).protocol === "https:";} catch {return false;}})(), "Use a local asset path, HTTPS image URL or supported uploaded image.");
export const appearanceSchema = z.object({
  title:z.string().trim().min(1).max(60), subtitle:z.string().trim().max(120),
  accent:color, background:color, panel:color, text:color,
  logo:image, backgroundImage:image, chibi:image.refine(Boolean), animatedBackground:z.boolean(),
}).strict();
export async function readAppearance(): Promise<Appearance> {
  const row=await env.DB!.prepare("SELECT show_id AS value FROM show_state WHERE id='appearance'").first<{value:string}>();
  try {return row ? appearanceSchema.parse(JSON.parse(row.value)) : defaultAppearance;} catch {return defaultAppearance;}
}
export async function writeAppearance(value:Appearance) {
  await env.DB!.prepare("INSERT INTO show_state(id,show_id) VALUES('appearance',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(JSON.stringify(value)).run();
}
