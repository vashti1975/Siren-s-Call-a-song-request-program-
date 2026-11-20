import {fixtureSongsSource,songFixtures} from "./fixtures/catalog.mjs";
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
function statement(text,args=[]){return {bind(...v){return statement(text,v)},async run(){return sql.prepare(text).run(...args)},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}}};}
globalThis.TEST_ENV={SONGBOOK_OWNER_EMAIL:'owner@example.test',DB:{prepare:statement,async batch(items){const r=[];for(const i of items)r.push(await i.run());return r}}};
globalThis.TEST_USER=null;
const dir=mkdtempSync(join(tmpdir(),'songbook-test-'));
await build({stdin:{contents:"export * from './app/api/midibard/route.ts'; export * as manage from './app/api/midibard/manage/route.ts'; export * as ownerManage from './app/api/manage/route.ts'; export {catalog} from './lib/catalog.ts'; export {fileKey,hashToken,matchSong,syncTables} from './lib/midibard.ts'; export {songs} from './lib/songs.ts'; export {showStatuses} from './lib/show.ts'; export {announcementText} from './lib/playback.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'env',setup(b){b.onLoad({filter:/songs\.ts$/},args=>({contents:fixtureSongsSource(readFileSync(args.path,"utf8")),loader:"ts"}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.TEST_ENV'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'auth-mock'}));b.onLoad({filter:/.*/,namespace:'auth-mock'},()=>({contents:'export const getChatGPTUser=async()=>globalThis.TEST_USER'}));}}]});
const {GET,POST,manage,ownerManage,catalog,fileKey,hashToken,matchSong,syncTables,songs,showStatuses,announcementText}=await import(join(dir,'test.mjs'));
assert.equal((await GET(new Request('https://test/api/midibard'))).status,401);
await syncTables();
const token='a'.repeat(64);
await statement("INSERT INTO midibard_connection (id,token_hash) VALUES ('owner',?)").bind(await hashToken(token)).run();
const song=songs[0];
assert.equal(fileKey('C:\\Music\\A Song.mid'),'asong');
assert.equal(matchSong(song.title+'.mid',songs)?.title,song.title);
assert.equal(matchSong('same.mid',[{...song,id:'a',title:'same',artist:'one'},{...song,id:'b',title:'same',artist:'two'}]),undefined);
// Real decorated filenames plus all catalogue titles/sources.
for(const entry of songs){
 const filename=`(${entry.set})♪♪  ${entry.title} -${entry.artist} ♪♪ Octet Songbook.mid`;
 const matched=matchSong(filename,songs);
 assert.equal(matched?.title,entry.title,filename);
 assert.equal(matched?.artist,entry.artist,filename);
}
assert.equal(matchSong("Completely unknown tune.mid",songs),undefined);
const versions=[{...song,id:'a',title:'same',artist:'one'},{...song,id:'b',title:'same',artist:'two'}];
assert.equal(matchSong('(Game)♪♪ same ♪♪ Octet Songbook.mid',versions),undefined);
assert.equal(matchSong('(Game)♪♪ same -two ♪♪ Octet Songbook.mid',versions)?.id,'b');
assert.equal(matchSong('(Game) same -unknown source - Octet Songbook.mid',versions),undefined);
assert.equal(matchSong('SoloFactory - Unknown Tune.mid',[{...song,title:'Solo',id:'solo'}]),undefined);
assert.equal(matchSong('Solo Suite - different source.mid',[{...song,title:'Solo',id:'solo'},{...song,title:'Solo Suite',id:'angel'}])?.id,'angel');
const request=(body)=>new Request('https://test/api/midibard',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
const initialShow=(await (await GET(new Request('https://test/api/midibard',{headers:{Authorization:'Bearer '+token}}))).json()).showId;
const event={file:song.title+'.mid',eventId:crypto.randomUUID(),showId:initialShow,startedAt:Date.now()};
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id) VALUES ('r',?,'v',?,?)").bind(song.id,Date.now(),initialShow).run();
assert.equal((await GET(new Request('https://test/api/midibard',{headers:{Authorization:'Bearer '+token}}))).status,200);
assert.deepEqual(await (await POST(request(event))).json(),{ok:true,matched:true,announcement:`By Request ♪ ${song.title} — ${song.artist} ♪`});
assert.equal((await statement('SELECT song_id FROM midibard_aliases WHERE file_key=?').bind(fileKey(event.file)).first()).song_id,song.id);
assert.ok((await statement("SELECT played_at FROM listener_requests WHERE id='r'").first()).played_at);
assert.equal((await statement('SELECT COUNT(*) AS n FROM show_plays').first()).n,1);
await POST(request(event));
assert.equal((await statement('SELECT COUNT(*) AS n FROM midibard_events').first()).n,1);
const unknown={...event,eventId:crypto.randomUUID(),file:'Custom arrangement.mid'};
assert.equal((await (await POST(request(unknown))).json()).matched,false);
assert.equal((await statement('SELECT COUNT(*) AS n FROM show_plays').first()).n,1);
await statement('INSERT INTO midibard_aliases (file_key,song_id) VALUES (?,?)').bind(fileKey(unknown.file),song.id).run();
assert.equal((await (await POST(request({...unknown,eventId:crypto.randomUUID()}))).json()).matched,true);
// Historical automatic matches must appear in the saved list, without replaying old shows.
assert.equal((await manage.GET()).status,403);
globalThis.TEST_USER={email:'owner@example.test'};
const entries=await catalog();
assert.equal(entries.length,songFixtures.length);
const playsBefore=(await statement('SELECT COUNT(*) AS n FROM show_plays').first()).n;
for(const entry of entries){
 const file=`(${entry.set})♪♪ ${entry.title} -${entry.artist} ♪♪ Octet Songbook.mid`;
 await statement('INSERT INTO midibard_events (id,show_id,file_name,song_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'previous-show',file,entry.id,1).run();
}
const manualFile=entries[1].title+'.mid';
await statement('INSERT INTO midibard_aliases (file_key,song_id) VALUES (?,?)').bind(fileKey(manualFile),song.id).run();
await statement('INSERT INTO midibard_events (id,show_id,file_name,song_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'previous-show',manualFile,song.id,1).run();
let saved=await (await manage.GET()).json();
assert.equal(saved.matchedSongCount,songFixtures.length);
assert(saved.matches.length>saved.matchedSongCount,'filename variants must not inflate the matched song count');
assert.equal(saved.matches.find(m=>m.fileKey===fileKey(manualFile)).songId,song.id,'owner choices survive recovery');
assert.equal((await statement('SELECT COUNT(*) AS n FROM show_plays').first()).n,playsBefore,'history recovery must not mark songs played in this show');
const savedCount=saved.matches.length;
saved=await (await manage.GET()).json();
assert.equal(saved.matches.length,savedCount,'repeated recovery must not duplicate matches');
const action=body=>new Request('https://test/api/midibard/manage',{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await manage.POST(action({action:'reset-match',fileKey:fileKey(event.file)}))).status,200);
saved=await (await manage.GET()).json();
assert(!saved.matches.some(m=>m.fileKey===fileKey(event.file)),'reset must survive historical recovery');
assert(saved.unmatched.some(m=>m.id===event.eventId));
assert.equal((await (await POST(request({...event,eventId:crypto.randomUUID()}))).json()).matched,false,'reset stays pending for an owner choice');
assert.equal((await manage.POST(action({action:'match',id:event.eventId,songId:song.id}))).status,200);
saved=await (await manage.GET()).json();
assert(saved.matches.some(m=>m.fileKey===fileKey(event.file)&&m.songId===song.id));
assert.equal((await (await POST(request({...event,eventId:crypto.randomUUID()}))).json()).matched,true);
assert(!saved.matches.some(m=>m.fileKey===fileKey('Completely unknown tune.mid')));
console.log('Passed: automatic match persistence, fixture-catalog history recovery, separate filename/song counts, owner choice preservation, repeat safety, reset and rematching.');
await statement("INSERT INTO show_state (id,show_id) VALUES ('current','new-show') ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id").run();
assert.equal((await POST(request({...event,eventId:crypto.randomUUID()}))).status,409);
assert.equal((await statement("SELECT COUNT(*) AS n FROM show_plays WHERE show_id='new-show'").first()).n,0);
assert.equal((await POST(request({...event,showId:'new-show',startedAt:Date.now()-120000,eventId:crypto.randomUUID()}))).status,409);
console.log('Passed: authentication, exact and ambiguous matching, queue clearing, played labels, idempotency, aliases, stale events and show reset.');

// Live playback and announcements use only the waiting requests at song start.
const liveShow='new-show';
const firstSong=entries[0],secondSong=entries.find(s=>s.id!==firstSong.id&&s.title!==firstSong.title);
const liveEvent={file:firstSong.title+'.mid',eventId:crypto.randomUUID(),showId:liveShow,startedAt:Date.now()};
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id,requester_name) VALUES ('live-one',?,'v',?,?,'Example Bard'),('live-two',?,'v',?,?,'Another Bard'),('live-three',?,'v',?,?,'Example Bard')").bind(firstSong.id,Date.now(),liveShow,firstSong.id,Date.now(),liveShow,firstSong.id,Date.now(),liveShow).run();
let liveResult=await (await POST(request(liveEvent))).json();
assert.equal(liveResult.announcement,`By Request by Example Bard & Another Bard ♪ ${firstSong.title} — ${firstSong.artist} ♪`);
let liveStatuses=await showStatuses(entries);assert.equal(liveStatuses[firstSong.id].playing,true);assert.equal(liveStatuses[secondSong.id].playing,false);
// A later request stays pending through heartbeats and event retries.
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id) VALUES ('later',?,'v',?,?)").bind(firstSong.id,Date.now()+1,liveShow).run();
const state=(playing,id=liveEvent.eventId)=>({action:'state',playing,eventId:id,showId:liveShow,startedAt:Date.now()});
assert.equal((await POST(request(state(true)))).status,200);
assert.equal((await (await POST(request(liveEvent))).json()).announcement,liveResult.announcement);
assert.equal((await statement("SELECT played_at FROM listener_requests WHERE id='later'").first()).played_at,null);
await POST(request(state(false)));assert.equal((await showStatuses(entries))[firstSong.id].playing,false);
await POST(request(state(true)));assert.equal((await showStatuses(entries))[firstSong.id].playing,true);
const nextEvent={file:secondSong.title+' - '+secondSong.artist+'.mid',eventId:crypto.randomUUID(),showId:liveShow,startedAt:Date.now()};
const normal=await (await POST(request(nextEvent))).json();assert.equal(normal.announcement,`♪ ${secondSong.title} — ${secondSong.artist} ♪`);
assert.equal((await POST(request(state(false)))).status,409,'old stop cannot clear the new song');
assert.equal((await (await POST(request(liveEvent))).json()).announcement,null,'old retry cannot announce an earlier song');
liveStatuses=await showStatuses(entries);assert.equal(liveStatuses[firstSong.id].playing,false);assert.equal(liveStatuses[secondSong.id].playing,true);
await statement("UPDATE midibard_playback SET updated_at=?").bind(Date.now()-21000).run();assert.equal((await showStatuses(entries))[secondSong.id].playing,false,'disconnect expires the live label');
assert(!JSON.stringify(liveStatuses).includes('Example Bard'));assert(!JSON.stringify(liveStatuses).includes('announcement'));
assert.equal(announcementText(firstSong,[{requesterName:null}]),`By Request ♪ ${firstSong.title} — ${firstSong.artist} ♪`);
const safe=announcementText({...firstSong,title:'曲'.repeat(200),artist:'演'.repeat(200)},[{requesterName:'Name\n/s <pos> '+ '字'.repeat(80)}]);
assert(!/[<>\n\r\x00-\x1f]/.test(safe));assert(new TextEncoder().encode(safe).length<450);assert(safe.endsWith(' ♪'));
console.log('Passed: requested/named/ordinary announcement formats, artist credits, unique requester names, UTF-8 and chat sanitization, one live song, pause/resume/stop, heartbeat, no repeated queue clearing, stale event isolation, disconnect expiry and public status privacy.');

const lateMatch={file:'New custom live arrangement.mid',eventId:crypto.randomUUID(),showId:liveShow,startedAt:Date.now()};
assert.equal((await (await POST(request(lateMatch))).json()).matched,false);
await POST(request({action:'state',playing:false,eventId:lateMatch.eventId,showId:liveShow,startedAt:Date.now()}));
assert.equal((await manage.POST(action({action:'match',id:lateMatch.eventId,songId:secondSong.id}))).status,200);
assert.equal((await showStatuses(entries))[secondSong.id].playing,false,'matching a paused song must not start it');
const resumedMatch=await (await POST(request({action:'state',playing:true,eventId:lateMatch.eventId,showId:liveShow,startedAt:Date.now()}))).json();
assert.equal(resumedMatch.matched,true);assert(resumedMatch.announcement.includes(secondSong.artist));assert.equal((await showStatuses(entries))[secondSong.id].playing,true);
console.log('Passed: matching the current paused song updates its identity without reactivating playback, and the label/artist announcement follow resume.');

// Switching names off also filters cached event responses and later retries.
const switchNames=includeNames=>ownerManage.PATCH(new Request('https://test/api/manage',{method:'PATCH',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify({action:'set-say-requester-names',includeNames})}));
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id,requester_name) VALUES ('name-switch-one',?,'v',?,?,'Hidden Player')").bind(secondSong.id,Date.now(),liveShow).run();
const namedStart={file:secondSong.title+' - '+secondSong.artist+'.mid',showId:liveShow,eventId:crypto.randomUUID(),startedAt:Date.now()};
assert((await (await POST(request(namedStart))).json()).announcement.includes('Hidden Player'));
await switchNames(false);
const noNamesRetry=await (await POST(request(namedStart))).json();assert.equal(noNamesRetry.announcement,`By Request ♪ ${secondSong.title} — ${secondSong.artist} ♪`);
const noNamesHeartbeat=await (await POST(request({action:'state',playing:true,showId:liveShow,eventId:namedStart.eventId,startedAt:Date.now()}))).json();assert.equal(noNamesHeartbeat.announcement,noNamesRetry.announcement);
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id,requester_name) VALUES ('name-switch-two',?,'v',?,?,'Still Visible To Owner')").bind(secondSong.id,Date.now(),liveShow).run();
const privateQueue=await (await ownerManage.GET()).json();assert(privateQueue.queue.some(r=>r.requesterName==='Still Visible To Owner'));
const hiddenStart={...namedStart,eventId:crypto.randomUUID(),startedAt:Date.now()};assert.equal((await (await POST(request(hiddenStart))).json()).announcement,`By Request ♪ ${secondSong.title} — ${secondSong.artist} ♪`);
assert.equal((await (await POST(request({...hiddenStart,eventId:crypto.randomUUID()}))).json()).announcement,`♪ ${secondSong.title} — ${secondSong.artist} ♪`);
await switchNames(true);
await statement("INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id,requester_name) VALUES ('name-switch-three',?,'v',?,?,'Names Back On')").bind(secondSong.id,Date.now(),liveShow).run();
assert((await (await POST(request({...hiddenStart,eventId:crypto.randomUUID()}))).json()).announcement.includes('Names Back On'));
console.log('Passed: names on/off in real companion responses, existing event retry/heartbeat filtering, no-name request format keeps title/artist, ordinary songs unchanged, owner names remain available, and re-enabling restores future named announcements.');

// Ignoring is a persistent filename choice, isolated from request-book songs.
const soloFile='Fixture Solo Artist - Solo Version 7.mid';
const solo={file:soloFile,eventId:crypto.randomUUID(),showId:liveShow,startedAt:Date.now()};
assert.equal((await (await POST(request(solo))).json()).matched,false);
globalThis.TEST_USER=null;
assert.equal((await manage.POST(action({action:'ignore',id:solo.eventId}))).status,403);
globalThis.TEST_USER={email:'owner@example.test'};
assert.equal((await manage.POST(new Request('https://test/api/midibard/manage',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({action:'ignore',id:solo.eventId})}))).status,403);
assert.equal((await manage.POST(action({action:'ignore',id:crypto.randomUUID()}))).status,404);
assert.equal((await manage.POST(action({action:'ignore',id:solo.eventId}))).status,200);
saved=await (await manage.GET()).json();
assert(saved.ignored.some(e=>e.fileKey===fileKey(soloFile)));
assert(!saved.unmatched.some(e=>e.file===soloFile));
assert.equal(saved.connection.lastIgnored,true);
assert.equal((await manage.POST(action({action:'ignore',id:solo.eventId}))).status,200,'repeated ignore is safe');
assert.equal((await (await manage.GET()).json()).ignored.filter(e=>e.fileKey===fileKey(soloFile)).length,1);

// Even a recognizable filename and a stale alias cannot override the ignore.
await statement('INSERT INTO song_edits (id,title,artist,song_set,note,updated_at) VALUES (?,?,?,?,?,?)').bind('test-solo','Solo Version 7','Fixture Solo Artist','Pop/Soft Rock','',Date.now()).run();
await statement('INSERT INTO midibard_aliases(file_key,song_id) VALUES (?,?)').bind(fileKey(soloFile),secondSong.id).run();
await statement("INSERT INTO listener_requests(id,song_id,visitor,created_at,show_id) VALUES('solo-must-not-complete',?,'v',?,?)").bind(secondSong.id,Date.now(),liveShow).run();
const soloReplay={...solo,file:'C:\\Solos\\Fixture Solo Artist - Solo Version 7.MID',eventId:crypto.randomUUID(),startedAt:Date.now()};
assert.deepEqual(await (await POST(request(soloReplay))).json(),{ok:true,matched:false,announcement:null});
assert.equal((await statement("SELECT played_at FROM listener_requests WHERE id='solo-must-not-complete'").first()).played_at,null);
assert(!(await showStatuses(await catalog()))[secondSong.id].playing);
const soloHeartbeat={action:'state',playing:true,eventId:soloReplay.eventId,showId:liveShow,startedAt:Date.now()};
assert.deepEqual(await (await POST(request(soloHeartbeat))).json(),{ok:true,matched:false,announcement:null});
await statement('DELETE FROM midibard_aliases WHERE file_key=?').bind(fileKey(soloFile)).run();
saved=await (await manage.GET()).json();assert(!saved.matches.some(e=>e.fileKey===fileKey(soloFile)),'history recovery respects ignored filenames');
assert.equal((await (await POST(request({...solo,file:'Fixture Solo Artist - Solo Version 6.mid',eventId:crypto.randomUUID(),startedAt:Date.now()}))).json()).matched,false);
assert((await (await manage.GET()).json()).unmatched.some(e=>e.file==='Fixture Solo Artist - Solo Version 6.mid'),'ignoring one arrangement leaves other files available');

// New shows keep ignores, and restoring leaves a choice for the owner.
await statement("UPDATE show_state SET show_id='solo-next-show' WHERE id='current'").run();
const nextSolo={...solo,showId:'solo-next-show',eventId:crypto.randomUUID(),startedAt:Date.now()};
assert.deepEqual(await (await POST(request(nextSolo))).json(),{ok:true,matched:false,announcement:null});
assert.equal((await manage.POST(action({action:'restore-ignored',fileKey:fileKey(soloFile)}))).status,200);
saved=await (await manage.GET()).json();
assert(!saved.ignored.some(e=>e.fileKey===fileKey(soloFile)));
assert(saved.unmatched.some(e=>e.file===soloFile),'restore must not automatically select a catalog match');
assert.equal((await manage.POST(action({action:'match',id:nextSolo.eventId,songId:secondSong.id}))).status,200);
assert.equal((await (await POST(request({...nextSolo,eventId:crypto.randomUUID(),startedAt:Date.now()}))).json()).matched,true);
// More than 30 ignored events cannot hide a song that still needs a choice.
const pending={file:'Still needs a choice.mid',showId:'solo-next-show',eventId:crypto.randomUUID(),startedAt:Date.now()};
await POST(request(pending));
await statement('INSERT INTO midibard_ignored_files(file_key,file_name) VALUES (?,?)').bind(fileKey(soloFile),soloFile).run();
for(let i=0;i<35;i++)await statement('INSERT INTO midibard_events(id,show_id,file_name,song_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'solo-next-show',soloFile,null,Date.now()+i+1).run();
assert((await (await manage.GET()).json()).unmatched.some(e=>e.id===pending.eventId));
console.log('Passed: owner/origin protection, persistent ignore, repeated plays and path variants, no request completion/live label/announcement, automatic-recovery protection, separate arrangements, new shows, restore/manual rematch and ignored-event pagination.');

// Refreshing keeps the actual pairing key and waits for real companion contact.
await statement("UPDATE show_state SET show_id='refresh-show' WHERE id='current'").run();
const refreshShow='refresh-show';
const currentEvent={file:secondSong.title+' - '+secondSong.artist+'.mid',eventId:crypto.randomUUID(),showId:refreshShow,startedAt:Date.now()};
await POST(request(currentEvent));
await statement("INSERT INTO listener_requests(id,song_id,visitor,created_at,show_id) VALUES('refresh-later-request',?,'v',?,?)").bind(secondSong.id,Date.now()+1000,refreshShow).run();
const preserved=()=>JSON.stringify({
 token:sql.prepare("SELECT token_hash FROM midibard_connection WHERE id='owner'").get(),
 events:sql.prepare('SELECT * FROM midibard_events ORDER BY id').all(),
 plays:sql.prepare('SELECT * FROM show_plays ORDER BY id').all(),
 requests:sql.prepare('SELECT * FROM listener_requests ORDER BY id').all(),
 awards:sql.prepare('SELECT * FROM listener_note_awards ORDER BY request_id').all(),
 matches:sql.prepare('SELECT * FROM midibard_aliases ORDER BY file_key').all(),
 ignored:sql.prepare('SELECT * FROM midibard_ignored_files ORDER BY file_key').all(),
});
const beforeRefresh=preserved();
globalThis.TEST_USER=null;assert.equal((await manage.POST(action({action:'refresh'}))).status,403);
globalThis.TEST_USER={email:'owner@example.test'};
assert.equal((await manage.POST(new Request('https://test/api/midibard/manage',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({action:'refresh'})}))).status,403);
const refreshResponse=await manage.POST(action({action:'refresh'}));assert.equal(refreshResponse.status,200);
assert.equal((await refreshResponse.json()).token,undefined,'refresh must not generate or return a key');
let connection=(await (await manage.GET()).json()).connection;
assert.equal(connection.refresh.confirmedAt,null,'a button click alone is not a successful reconnect');
assert.equal((await showStatuses(await catalog()))[secondSong.id].playing,false,'stale live label clears while waiting');
await GET(new Request('https://test/api/midibard',{headers:{Authorization:'Bearer '+token}}));
assert.equal((await (await manage.GET()).json()).connection.refresh.confirmedAt,null,'a handshake alone must not claim playback recovery');
const refreshHeartbeat={action:'state',playing:true,eventId:currentEvent.eventId,showId:refreshShow,startedAt:Date.now()};
const refreshed=await POST(request(refreshHeartbeat));assert.equal(refreshed.status,200);
connection=(await (await manage.GET()).json()).connection;assert(connection.refresh.confirmedAt);
assert.equal((await showStatuses(await catalog()))[secondSong.id].playing,true);
assert.equal(preserved(),beforeRefresh,'refresh and heartbeat preserve the key, requests, plays, awards, matches and ignored songs');

// Rebuild a lost row using the existing event, with no repeated play or announcement.
await manage.POST(action({action:'refresh'}));await statement("DELETE FROM midibard_playback WHERE id='owner'").run();
assert.deepEqual(await (await POST(request({...refreshHeartbeat,startedAt:Date.now()}))).json(),{ok:true,matched:true,announcement:null});
assert.equal(preserved(),beforeRefresh);
assert((await (await manage.GET()).json()).connection.refresh.confirmedAt);

// An old event cannot take over the latest event, even during recovery.
const nextRefreshEvent={...currentEvent,eventId:crypto.randomUUID(),startedAt:Date.now()};await POST(request(nextRefreshEvent));
const beforeSecondRefresh=preserved();
await manage.POST(action({action:'refresh'}));await statement("DELETE FROM midibard_playback WHERE id='owner'").run();
assert.equal((await POST(request({...refreshHeartbeat,startedAt:Date.now()}))).status,409);
assert.equal((await (await manage.GET()).json()).connection.refresh.confirmedAt,null);
assert.equal((await (await POST(request({...currentEvent,startedAt:Date.now()}))).json()).announcement,null);
assert.equal((await (await manage.GET()).json()).connection.refresh.confirmedAt,null);
const pausedRecovery={...refreshHeartbeat,eventId:nextRefreshEvent.eventId,playing:false,startedAt:Date.now()};
assert.equal((await POST(request(pausedRecovery))).status,200);
assert.equal((await showStatuses(await catalog()))[secondSong.id].playing,false,'recovering paused playback must keep it paused');
assert.equal(preserved(),beforeSecondRefresh);

// An existing start retry can recover the same session without charging it again.
await manage.POST(action({action:'refresh'}));await statement("DELETE FROM midibard_playback WHERE id='owner'").run();
assert.equal((await POST(request({...nextRefreshEvent,startedAt:Date.now()}))).status,200);
assert((await (await manage.GET()).json()).connection.refresh.confirmedAt);
assert.equal(preserved(),beforeSecondRefresh);
assert.equal((await showStatuses(await catalog()))[secondSong.id].playing,true);

// A new start also completes a pending refresh. Stale and invalid events do not.
await manage.POST(action({action:'refresh'}));
assert.equal((await POST(request({...refreshHeartbeat,eventId:nextRefreshEvent.eventId,startedAt:Date.now()-120000}))).status,409);
assert.equal((await POST(new Request('https://test/api/midibard',{method:'POST',headers:{Authorization:'Bearer '+'b'.repeat(64),'Content-Type':'application/json'},body:JSON.stringify({...refreshHeartbeat,eventId:nextRefreshEvent.eventId,startedAt:Date.now()})}))).status,401);
assert.equal((await (await manage.GET()).json()).connection.refresh.confirmedAt,null);
assert.equal((await POST(request({...nextRefreshEvent,eventId:crypto.randomUUID(),startedAt:Date.now()}))).status,200);
assert((await (await manage.GET()).json()).connection.refresh.confirmedAt);
assert.equal((await statement("SELECT token_hash FROM midibard_connection WHERE id='owner'").first()).token_hash,await hashToken(token));
await manage.POST(action({action:'refresh'}));
await statement("UPDATE show_state SET show_id='after-refresh-show' WHERE id='current'").run();
assert.equal((await POST(request({...refreshHeartbeat,eventId:nextRefreshEvent.eventId,startedAt:Date.now()}))).status,409,'refresh does not admit an old show');
assert.equal((await POST(request({...nextRefreshEvent,showId:'after-refresh-show',eventId:crypto.randomUUID(),startedAt:Date.now()}))).status,200);
assert((await (await manage.GET()).json()).connection.refresh.confirmedAt);
await manage.POST(action({action:'disconnect'}));
assert.equal((await manage.POST(action({action:'refresh'}))).status,409,'a revoked key cannot be refreshed');
console.log('Passed: same-key refresh, owner/origin validation, honest pending/confirmed status, healthy/missing/paused session recovery, existing-start retries, no duplicate requests/plays/awards, latest-event protection, stale/invalid event rejection, show changes and disconnected-key handling.');
