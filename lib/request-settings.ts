import { env } from "cloudflare:workers";

// Kept separate from the current show so a list reset cannot reopen requests.
export const requestsOpenCondition = "COALESCE((SELECT show_id FROM show_state WHERE id='requests-open'),'open')='open'";

export async function areRequestsOpen(): Promise<boolean> {
  const row = await env.DB!.prepare("SELECT show_id AS value FROM show_state WHERE id='requests-open'").first<{value: string}>();
  return !row || row.value === "open";
}

export async function setRequestsOpen(open: boolean): Promise<void> {
  await env.DB!.prepare("INSERT INTO show_state (id,show_id) VALUES ('requests-open',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(open ? "open" : "closed").run();
}

// Independent of show resets and request acceptance.
export async function includeRequesterNamesInSay(): Promise<boolean> {
  const row = await env.DB!.prepare("SELECT show_id AS value FROM show_state WHERE id='say-requester-names'").first<{value: string}>();
  return !row || row.value !== "off";
}

export async function setRequesterNamesInSay(includeNames: boolean): Promise<void> {
  await env.DB!.prepare("INSERT INTO show_state (id,show_id) VALUES ('say-requester-names',?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(includeNames ? "on" : "off").run();
}
