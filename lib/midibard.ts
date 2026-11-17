import { env } from 'cloudflare:workers';
import { catalog } from './catalog';
import { currentShow, songKey } from './show';
import type { Song } from './songs';
import { noteAwardStatement } from './listener';
export async function syncTables(){
 await env.DB!.batch([
  env.DB!.prepare('CREATE TABLE IF NOT EXISTS midibard_connection (id TEXT PRIMARY KEY, token_hash TEXT, last_seen INTEGER, last_file TEXT, last_match TEXT)'),
  env.DB!.prepare('CREATE TABLE IF NOT EXISTS midibard_aliases (file_key TEXT PRIMARY KEY, song_id TEXT NOT NULL)'),
  env.DB!.prepare('CREATE TABLE IF NOT EXISTS midibard_match_resets (file_key TEXT PRIMARY KEY)'),
  env.DB!.prepare('CREATE TABLE IF NOT EXISTS midibard_events (id TEXT PRIMARY KEY, show_id TEXT NOT NULL, file_name TEXT NOT NULL, song_id TEXT, created_at INTEGER NOT NULL)'),
 ]);
}
export const fileKey=(file:string)=>file.replace(/^.*[\\/]/,'').replace(/\.(mid|midi|mmsong|mml)$/i,'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function automaticMatchStatement(file:string,song:Song){
 const key=fileKey(file);
 // Never replace an owner's choice or recreate a match they explicitly reset.
 return env.DB!.prepare('INSERT INTO midibard_aliases (file_key,song_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM midibard_match_resets WHERE file_key=?) ON CONFLICT(file_key) DO NOTHING').bind(key,song.id,key);
}
export async function matchWasReset(file:string){
 return !!await env.DB!.prepare('SELECT file_key FROM midibard_match_resets WHERE file_key=?').bind(fileKey(file)).first();
}
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function authorized(request:Request){
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 await syncTables();
 return !!await env.DB!.prepare("SELECT id FROM midibard_connection WHERE id='owner' AND token_hash=?").bind(await hashToken(token)).first();
}
// Saved aliases keep the original fileKey; automatic matching strips only known
// filename decorations, then requires an exact title/source identity.
export function cleanMidiName(file:string){
 const filename=file.includes('\\')||file.startsWith('/')||/^[a-z]:\//i.test(file)?file.replace(/^.*[\\/]/,''):file;
 return filename.replace(/\.(mid|midi|mmsong|mml)$/i,'')
  .replace(/^\s*\((?:anime|disney|final\s*fantasy|ff|game|games|movies?|rock(?:\/metal)?|metal|pop(?:\/soft\s*rock)?|soft\s*rock|country|c|r|p|d|g)\)\s*/i,'')
  .replace(/(?:[\s\-–—♪♫♬]*)(?:(?:solo|duet|trio|quartet|quintet|sextet|septet|octet)\s+)?songbook\s*$/i,'')
  .replace(/[♪♫♬]/gu,' ').replace(/^[\s\-–—]+|[\s\-–—]+$/g,'').trim();
}
const identity=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function matchSong(file:string,songs:Song[],alias?:string|null){
 if(alias){const saved=songs.find(s=>s.id===alias);if(saved)return saved;}
 const key=identity(cleanMidiName(file));
 if(!key)return undefined;
 // Prefer the title AND artist/source, so different versions remain distinct.
 const credited=songs.filter(s=>[s.title+' '+s.artist,s.artist+' '+s.title,s.title+' from '+s.artist].some(n=>identity(n)===key));
 const candidates=credited.length?credited:songs.filter(s=>identity(s.title)===key);
 const groups=new Set(candidates.map(songKey));
 if(candidates.length)return groups.size===1?candidates[0]:undefined;
 // MIDI source credits are often shorthand, arranger labels, or cover artists.
 // An entire title separated from those credits can still identify a song.
 const clean=cleanMidiName(file);
 const parts=clean.split(/\s+[-–—]\s*|[-–—]\s+/).map(identity).filter(Boolean);
 const words=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’'`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const text=words(clean);
 const titleCandidates=songs.filter(s=>{
  if(parts.includes(identity(s.title)))return true;
  const title=words(s.title);
  // Longer titles may be followed by credits without a dash. Short titles
  // require an exact delimited segment to avoid matching artist names.
  return title.split(' ').length>=3&&(text.startsWith(title+' ')||text.endsWith(' '+title));
 });
 if(!titleCandidates.length)return undefined;
 const longest=Math.max(...titleCandidates.map(s=>identity(s.title).length));
 const strongest=titleCandidates.filter(s=>identity(s.title).length===longest);
 return new Set(strongest.map(songKey)).size===1?strongest[0]:undefined;
}
export async function playStatements(song:Song,showId:string,cutoff=Date.now(),eventId?:string){
 const ids=(await catalog()).filter(s=>songKey(s)===songKey(song)).map(s=>s.id);
 if(showId!==await currentShow())return [];
 const guard="EXISTS (SELECT 1 FROM show_state WHERE id='current' AND show_id=?)"+(eventId?" AND NOT EXISTS (SELECT 1 FROM midibard_events WHERE id=?)":"");
 const guards=eventId?[showId,eventId]:[showId];
 return ids.flatMap(id=>[
  noteAwardStatement('song_id=? AND show_id=? AND created_at<=? AND '+guard,[id,showId,cutoff,...guards],cutoff),
  env.DB!.prepare('INSERT OR IGNORE INTO show_plays (id,show_id,song_id) SELECT ?,?,? WHERE '+guard).bind(showId+':'+id,showId,id,...guards),
  env.DB!.prepare('UPDATE listener_requests SET played_at=? WHERE song_id=? AND show_id=? AND played_at IS NULL AND created_at<=? AND '+guard).bind(cutoff,id,showId,cutoff,...guards),
 ]);
}
export async function recordPlay(song:Song,showId:string){
 const statements=await playStatements(song,showId);if(statements.length)await env.DB!.batch(statements);
}
