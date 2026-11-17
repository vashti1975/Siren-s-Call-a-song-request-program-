import { env } from "cloudflare:workers";

// One-time reset requested by the owner on November 11, 2026.
// Retain older records, but start request totals and the active show afresh.
const resetId = "request-history-reset-2026-11-11";
// Reset owner totals only; preserve the current show's requests and labels.
const totalsResetId = "request-totals-reset-2026-11-14";
let reset: Promise<number> | undefined;

// A row boundary makes manual resets precise even when a new request arrives
// in the same millisecond. Older records remain available to the current show.
export const requestTotalsCondition="created_at>=? AND rowid>COALESCE((SELECT CAST(show_id AS INTEGER) FROM show_state WHERE id='request-totals-rowid-cutoff'),0)";
export async function resetRequestTotals(operationId:string){
 await requestHistoryStart();
 const operationKey='request-totals-operation:'+operationId;
 await env.DB!.batch([
  env.DB!.prepare("INSERT INTO show_state(id,show_id) SELECT 'request-totals-rowid-cutoff',CAST((SELECT COALESCE(MAX(rowid),0) FROM listener_requests) AS TEXT) WHERE NOT EXISTS(SELECT 1 FROM show_state WHERE id=?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(operationKey),
  env.DB!.prepare("INSERT OR IGNORE INTO show_state(id,show_id) VALUES(?,?)").bind(operationKey,String(Date.now()))
 ]);
}

export function requestHistoryStart(): Promise<number> {
 if (!reset) reset = applyReset().then(applyTotalsReset).catch(error => { reset = undefined; throw error; });
 return reset;
}

async function applyTotalsReset(historyStart: number): Promise<number> {
 await env.DB!.prepare("INSERT OR IGNORE INTO show_state (id,show_id) VALUES (?,?)").bind(totalsResetId,String(Date.now())).run();
 const applied = await env.DB!.prepare("SELECT show_id FROM show_state WHERE id=?").bind(totalsResetId).first<{show_id:string}>();
 const cutoff = Number(applied?.show_id);
 if (!Number.isFinite(cutoff)) throw new Error("Request totals reset did not complete");
 return Math.max(historyStart,cutoff);
}

async function applyReset(): Promise<number> {
 const existing = await env.DB!.prepare("SELECT show_id FROM show_state WHERE id=?").bind(resetId).first<{show_id:string}>();
 if (existing) return Number(existing.show_id);
 const startedAt = Date.now();
 const showId = crypto.randomUUID();
 await env.DB!.batch([
  env.DB!.prepare("INSERT INTO show_state (id,show_id) SELECT 'current',? WHERE NOT EXISTS (SELECT 1 FROM show_state WHERE id=?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").bind(showId,resetId),
  env.DB!.prepare("INSERT OR IGNORE INTO show_state (id,show_id) VALUES (?,?)").bind(resetId,String(startedAt)),
 ]);
 const applied = await env.DB!.prepare("SELECT show_id FROM show_state WHERE id=?").bind(resetId).first<{show_id:string}>();
 if (!applied) throw new Error("Request history reset did not complete");
 return Number(applied.show_id);
}
