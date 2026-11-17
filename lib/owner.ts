import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
export async function isOwner() {
 const user = await getChatGPTUser();
 const owner = (env as unknown as { SONGBOOK_OWNER_EMAIL?: string }).SONGBOOK_OWNER_EMAIL;
 return !!owner && !!user && user.email.toLowerCase() === owner.toLowerCase();
}
export function sameOrigin(request: Request) {
 return request.headers.get("origin") === new URL(request.url).origin;
}
export const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, oai-authenticated-user-id, oai-authenticated-user-email" };
