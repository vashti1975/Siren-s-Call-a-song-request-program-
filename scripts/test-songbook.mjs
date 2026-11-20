import {fixtureSongsSource,songFixtures} from "./fixtures/catalog.mjs";
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { z } from 'zod';
const sql=new DatabaseSync(':memory:');
for(const migration of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+migration,'utf8'));
let beforeRequestInsert;
const DB={async batch(items){sql.exec("BEGIN");try{const results=[];for(const item of items)results.push(await item.run());sql.exec("COMMIT");return results;}catch(error){sql.exec("ROLLBACK");throw error;}},prepare(query){let args=[];return {bind(...a){args=a;return this;},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){if(beforeRequestInsert&&query.startsWith("INSERT OR IGNORE INTO listener_requests")){const action=beforeRequestInsert;beforeRequestInsert=undefined;action();}return sql.prepare(query).run(...args)}}}};
let user=null;const env={DB,SONGBOOK_OWNER_EMAIL:'owner@example.test'};
const ctx=vm.createContext({Response,Request,URL,crypto,console,Date,Map,Set});const modules=new Map();
function synthetic(name,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v)},{context:ctx,identifier:name});modules.set(name,m);return m;}
synthetic('cloudflare:workers',{env});synthetic('zod',{z});synthetic('auth',{getChatGPTUser:async()=>user});
async function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const code=ts.transpileModule(fixtureSongsSource(fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(code,{context:ctx,identifier:file});modules.set(file,m);return m;}
async function linker(s,ref){if(modules.has(s))return modules.get(s);if(s.endsWith('chatgpt-auth'))return modules.get('auth');return load(path.resolve(path.dirname(ref.identifier),s+'.ts'));}
async function evaluated(file){const m=await load(file);if(m.status==='unlinked')await m.link(linker);if(m.status!=='evaluated')await m.evaluate();return m;}
const manage=await evaluated('app/api/manage/route.ts');const request=await evaluated('app/api/request/route.ts');const cat=await evaluated('app/api/catalog/route.ts');
const origin='https://songbook.example';const req=(route,body,originValue=origin)=>new Request(origin+route,{method:'POST',headers:{Origin:originValue,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await manage.namespace.GET()).status,403);
assert.equal((await manage.namespace.POST(req('/api/manage',{}))).status,403);
let data=await (await cat.namespace.GET()).json();assert.equal(data.songs.length,songFixtures.length);assert(!JSON.stringify(data).includes('total'));const original=data.songs[0];
user={userId:'other',email:'other@example.test'};assert.equal((await manage.namespace.GET()).status,403);
user={userId:'owner',email:'owner@example.test'};
assert.equal((await manage.namespace.POST(req('/api/manage',{...original,note:'Edited note'}))).status,200);
data=await (await cat.namespace.GET()).json();assert.equal(data.songs.find(s=>s.id===original.id).note,'Edited note');
const added=await (await manage.namespace.POST(req('/api/manage',{title:'New arrangement',artist:'Songbook',set:'Anime',note:''}))).json();assert(added.id);assert.equal((await (await cat.namespace.GET()).json()).songs.length,songFixtures.length+1);
assert.equal((await manage.namespace.POST(req('/api/manage',{title:'',artist:'Artist',set:'Anime'}))).status,400);
assert.equal((await manage.namespace.POST(req('/api/manage',original,'https://elsewhere.example'))).status,403);
assert.equal((await manage.namespace.POST(req('/api/manage',{...original,id:'missing'}))).status,404);
const id=crypto.randomUUID();let r=await request.namespace.POST(req('/api/request',{id,songId:original.id}));assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
const repeated=req('/api/request',{id,songId:original.id});repeated.headers.set('Cookie',cookie);assert.equal((await request.namespace.POST(repeated)).status,200);
data=await (await manage.namespace.GET()).json();assert.equal(data.counts.find(c=>c.songId===original.id).total,1);
for(let i=0;i<9;i++){const r=req('/api/request',{id:crypto.randomUUID(),songId:original.id});r.headers.set('Cookie',cookie);assert.equal((await request.namespace.POST(r)).status,200);}
const limited=req('/api/request',{id:crypto.randomUUID(),songId:original.id});limited.headers.set('Cookie',cookie);assert.equal((await request.namespace.POST(limited)).status,429);
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:'missing'}))).status,404);
assert.equal((await request.namespace.POST(req('/api/request',null))).status,400);
data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,10);assert.equal(data.queue[0].song.title,original.title);
const patch=(body,originValue=origin)=>new Request(origin+'/api/manage',{method:'PATCH',headers:{Origin:originValue,'Content-Type':'application/json'},body:JSON.stringify(body)});
user=null;assert.equal((await manage.namespace.PATCH(patch({id}))).status,403);
user={userId:'other',email:'other@example.test'};assert.equal((await manage.namespace.PATCH(patch({id}))).status,403);
user={userId:'owner',email:'owner@example.test'};
assert.equal((await manage.namespace.PATCH(patch({id},'https://elsewhere.example'))).status,403);
assert.equal((await manage.namespace.PATCH(patch({id:'bad'}))).status,400);
assert.equal((await manage.namespace.PATCH(patch({id:crypto.randomUUID()}))).status,404);
assert.equal((await manage.namespace.PATCH(patch({id}))).status,200);
data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,9);assert(!data.queue.some(r=>r.id===id));assert.equal(data.totalRequests,10);
assert.equal((await manage.namespace.PATCH(patch({id}))).status,200);assert.equal((await (await manage.namespace.GET()).json()).queue.length,9);
assert.equal((await manage.namespace.PATCH(patch({id,undo:true}))).status,200);data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,10);assert.equal(data.totalRequests,10);
let statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[original.id].requested,true);assert.equal(statusData.statuses[original.id].played,false);
await manage.namespace.PATCH(patch({id}));statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[original.id].played,true);
const duplicate=statusData.songs.find(s=>s.id!==original.id&&s.title===original.title&&s.artist===original.artist);if(duplicate)assert.equal(statusData.statuses[duplicate.id].played,true);
user=null;assert.equal((await manage.namespace.PATCH(patch({action:'reset-show'}))).status,403);
user={userId:'owner',email:'owner@example.test'};
assert.equal((await manage.namespace.PATCH(patch({action:'reset-show'},'https://elsewhere.example'))).status,403);
assert.equal((await manage.namespace.PATCH(patch({action:'reset-show'}))).status,200);
data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,0);assert.equal(data.totalRequests,10);
statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[original.id].requested,false);assert.equal(statusData.statuses[original.id].played,false);
assert.equal((await manage.namespace.PATCH(patch({id,undo:true}))).status,404);
const nextId=crypto.randomUUID();assert.equal((await request.namespace.POST(req('/api/request',{id:nextId,songId:original.id}))).status,200);
data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,1);assert.equal(data.queue[0].id,nextId);assert.equal(data.totalRequests,11);
statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[original.id].requested,true);assert.equal(statusData.statuses[original.id].played,false);
assert(!JSON.stringify(statusData).includes('visitor'));assert(!JSON.stringify(statusData).includes('createdAt'));assert(!('counts' in statusData));
console.log('PASS: public current-show requested/played labels, reset authorization, reset clears labels and queue while preserving totals, old-show undo blocked, new-show requests tracked.');
const unrequested=statusData.songs.find(s=>s.id!==original.id);
assert.equal((await manage.namespace.PATCH(patch({action:'mark-song-played',songId:unrequested.id}))).status,200);
statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[unrequested.id].played,true);assert.equal(statusData.statuses[unrequested.id].requested,false);
user=null;assert.equal((await manage.namespace.PATCH(patch({action:'mark-song-played',songId:unrequested.id}))).status,403);
user={userId:'owner',email:'owner@example.test'};await manage.namespace.PATCH(patch({action:'reset-show'}));
statusData=await (await cat.namespace.GET()).json();assert.equal(statusData.statuses[unrequested.id].played,false);
console.log('PASS: owner marks unrequested songs played, listener distinguishes played from requested, show reset clears manual plays.');
const publicData=await (await cat.namespace.GET()).json();assert(!('queue' in publicData));
user=null;assert.equal((await manage.namespace.GET()).status,403);
console.log('PASS: queue persistence, private queue and completion authorization, origin validation, mark played, retry safety, undo, lifetime totals retained, public catalog excludes queue.');
console.log('PASS: baseline catalog, private read/write authorization, non-owner denied, edit persistence, add song, validation, missing song, same-origin protection, idempotent request totals, rate limiting, public response excludes totals.');

// Pending times follow current owner queue entries, including matching sets.
user={userId:'owner',email:'owner@example.test'};
await manage.namespace.PATCH(patch({action:'reset-show'}));
const timeModule=await evaluated('lib/request-times.ts');
const pendingTimes=timeModule.namespace.pendingRequestTimes;
const midiModule=await evaluated('lib/midibard.ts');
const showModule=await evaluated('lib/show.ts');
data=await (await manage.namespace.GET()).json();
const pair=data.songs.filter(s=>s.title==='Fixture Duo'&&s.artist==='Fixture Duo Artist');assert.equal(pair.length,2);
const requestIds=[crypto.randomUUID(),crypto.randomUUID()];
for(let i=0;i<2;i++)assert.equal((await request.namespace.POST(req('/api/request',{id:requestIds[i],songId:pair[i].id}))).status,200);
data=await (await manage.namespace.GET()).json();
let times=pendingTimes(data.songs,data.queue);assert.equal(times[pair[0].id].length,2);assert.deepEqual(Array.from(times[pair[0].id]),Array.from(times[pair[1].id]));assert.equal(times[pair[0].id][0],Math.min(...data.queue.map(r=>r.createdAt)));
assert(data.queue.every(r=>Number.isFinite(r.createdAt)));
let publicTimes=await (await cat.namespace.GET()).json();assert(!('queue' in publicTimes));assert(!JSON.stringify(publicTimes).includes('createdAt'));assert(!JSON.stringify(publicTimes).includes('requestTimes'));
const beforePlayTotal=data.totalRequests;
assert.equal((await manage.namespace.PATCH(patch({action:'mark-song-played',songId:pair[0].id}))).status,200);
data=await (await manage.namespace.GET()).json();times=pendingTimes(data.songs,data.queue);assert.equal(data.queue.length,0);assert.equal(times[pair[0].id].length,0);assert.equal(times[pair[1].id].length,0);assert.equal(data.totalRequests,beforePlayTotal);
// A fresh request for a played song gets a fresh pending timestamp.
const replayId=crypto.randomUUID();await request.namespace.POST(req('/api/request',{id:replayId,songId:pair[1].id}));
data=await (await manage.namespace.GET()).json();assert.equal(pendingTimes(data.songs,data.queue)[pair[0].id].length,1);
await midiModule.namespace.recordPlay(pair[0],await showModule.namespace.currentShow());
data=await (await manage.namespace.GET()).json();assert.equal(pendingTimes(data.songs,data.queue)[pair[0].id].length,0);
// Per-request completion clears its time; Undo restores the original time.
const queueId=crypto.randomUUID();await request.namespace.POST(req('/api/request',{id:queueId,songId:original.id}));
data=await (await manage.namespace.GET()).json();const requestedAt=data.queue[0].createdAt;
await manage.namespace.PATCH(patch({id:queueId}));data=await (await manage.namespace.GET()).json();assert.equal(pendingTimes(data.songs,data.queue)[original.id].length,0);
await manage.namespace.PATCH(patch({id:queueId,undo:true}));data=await (await manage.namespace.GET()).json();assert.equal(pendingTimes(data.songs,data.queue)[original.id][0],requestedAt);
const beforeResetTotal=data.totalRequests;await manage.namespace.PATCH(patch({action:'reset-show'}));
data=await (await manage.namespace.GET()).json();assert.equal(data.queue.length,0);assert.equal(data.totalRequests,beforeResetTotal);assert(Object.values(pendingTimes(data.songs,data.queue)).every(t=>t.length===0));
console.log('PASS: owner-only pending request times, grouped sets, manual and MidiBard playback clear times and queue, new repeat requests show times, completion/undo and list reset preserve totals.');

// Closing requests is owner-only, durable, and enforced at acceptance time.
user={userId:'owner',email:'owner@example.test'};
assert.equal((await (await manage.namespace.GET()).json()).requestsOpen,true);
assert.equal((await (await cat.namespace.GET()).json()).requestsOpen,true);
user=null;assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:false}))).status,403);
user={userId:'other',email:'other@example.test'};assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:false}))).status,403);
user={userId:'owner',email:'owner@example.test'};
assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:false},'https://elsewhere.example'))).status,403);
assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:'false'}))).status,400);
const waitingId=crypto.randomUUID();const waitingResponse=await request.namespace.POST(req('/api/request',{id:waitingId,songId:original.id}));assert.equal(waitingResponse.status,200);
const waitingCookie=waitingResponse.headers.get('set-cookie').split(';')[0];
const beforeClose=await (await manage.namespace.GET()).json();
let gateResponse=await manage.namespace.PATCH(patch({action:'set-requests-open',open:false}));assert.equal(gateResponse.status,200);assert.equal((await gateResponse.json()).requestsOpen,false);
data=await (await manage.namespace.GET()).json();assert.equal(data.requestsOpen,false);assert.equal(data.queue.length,beforeClose.queue.length);assert.equal(data.totalRequests,beforeClose.totalRequests);assert.equal(data.queue.find(r=>r.id===waitingId).createdAt,beforeClose.queue.find(r=>r.id===waitingId).createdAt);
assert.equal((await (await cat.namespace.GET()).json()).requestsOpen,false);
const blockedId=crypto.randomUUID();const blocked=await request.namespace.POST(req('/api/request',{id:blockedId,songId:original.id}));assert.equal(blocked.status,409);assert.equal((await blocked.json()).code,'REQUESTS_CLOSED');assert(!sql.prepare('SELECT id FROM listener_requests WHERE id=?').get(blockedId));
// Retrying a request already accepted before closure cannot add another request.
const acceptedRetry=req('/api/request',{id:waitingId,songId:original.id});acceptedRetry.headers.set('Cookie',waitingCookie);assert.equal((await request.namespace.POST(acceptedRetry)).status,200);assert.equal((await (await manage.namespace.GET()).json()).totalRequests,beforeClose.totalRequests);
assert.equal((await manage.namespace.PATCH(patch({action:'mark-song-played',songId:original.id}))).status,200);assert.equal((await (await manage.namespace.GET()).json()).queue.length,0);
assert.equal((await manage.namespace.PATCH(patch({action:'reset-show'}))).status,200);assert.equal((await (await manage.namespace.GET()).json()).requestsOpen,false);
assert.equal(sql.prepare("SELECT show_id FROM show_state WHERE id='requests-open'").get().show_id,'closed');
assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:true}))).status,200);
const reopenedId=crypto.randomUUID();assert.equal((await request.namespace.POST(req('/api/request',{id:reopenedId,songId:original.id}))).status,200);
// Simulate the owner closing between the initial check and the request insert.
beforeRequestInsert=()=>sql.prepare("UPDATE show_state SET show_id='closed' WHERE id='requests-open'").run();
const lateId=crypto.randomUUID();const lateResponse=await request.namespace.POST(req('/api/request',{id:lateId,songId:original.id}));assert.equal(lateResponse.status,409);assert.equal((await lateResponse.json()).code,'REQUESTS_CLOSED');assert(!sql.prepare('SELECT id FROM listener_requests WHERE id=?').get(lateId));
assert.equal((await manage.namespace.PATCH(patch({action:'set-requests-open',open:true}))).status,200);
const gatePublic=await (await cat.namespace.GET()).json();assert.equal(gatePublic.requestsOpen,true);assert(!('queue' in gatePublic));assert(!('counts' in gatePublic));assert(!JSON.stringify(gatePublic).includes('createdAt'));
console.log('PASS: close/reopen authorization, validation, persistent state, old listener pages blocked, atomic closing during submission, accepted retries, queue/timestamps/totals retained, reset cannot reopen requests.');


// Optional ingame names persist per request and are visible only to the owner.
user={userId:'owner',email:'owner@example.test'};
await manage.namespace.PATCH(patch({action:'reset-show'}));
const namedId=crypto.randomUUID();
const namedResponse=await request.namespace.POST(req('/api/request',{id:namedId,songId:original.id,requesterName:'  Example Bard  '}));
assert.equal(namedResponse.status,200);
const namedCookie=namedResponse.headers.get('set-cookie').split(';')[0];
const secondId=crypto.randomUUID();
assert.equal((await request.namespace.POST(req('/api/request',{id:secondId,songId:original.id,requesterName:'Another Bard'}))).status,200);
const blankId=crypto.randomUUID(),omittedId=crypto.randomUUID();
assert.equal((await request.namespace.POST(req('/api/request',{id:blankId,songId:original.id,requesterName:'   '}))).status,200);
assert.equal((await request.namespace.POST(req('/api/request',{id:omittedId,songId:original.id}))).status,200);
data=await (await manage.namespace.GET()).json();
assert.equal(data.queue.length,4);assert.equal(data.queue.find(r=>r.id===namedId).requesterName,'Example Bard');assert.equal(data.queue.find(r=>r.id===secondId).requesterName,'Another Bard');
assert.equal(data.queue.find(r=>r.id===blankId).requesterName,null);assert.equal(data.queue.find(r=>r.id===omittedId).requesterName,null);
const nameRetry=req('/api/request',{id:namedId,songId:original.id,requesterName:'Replacement'});nameRetry.headers.set('Cookie',namedCookie);
assert.equal((await request.namespace.POST(nameRetry)).status,200);
assert.equal((await (await manage.namespace.GET()).json()).queue.length,4);
assert.equal(sql.prepare('SELECT requester_name FROM listener_requests WHERE id=?').get(namedId).requester_name,'Example Bard');
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id,requesterName:'x'.repeat(81)}))).status,400);
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id,requesterName:42}))).status,400);
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id,requesterName:'x'.repeat(80)}))).status,200);
await manage.namespace.PATCH(patch({id:namedId}));data=await (await manage.namespace.GET()).json();assert(!data.queue.some(r=>r.id===namedId));assert.equal(data.queue.find(r=>r.id===secondId).requesterName,'Another Bard');
await manage.namespace.PATCH(patch({id:namedId,undo:true}));data=await (await manage.namespace.GET()).json();assert.equal(data.queue.find(r=>r.id===namedId).requesterName,'Example Bard');
const namedPublic=await (await cat.namespace.GET()).json();assert(!JSON.stringify(namedPublic).includes('requesterName'));assert(!JSON.stringify(namedPublic).includes('Example Bard'));assert(!JSON.stringify(namedPublic).includes('Another Bard'));
user=null;assert.equal((await manage.namespace.GET()).status,403);
console.log('PASS: optional names, blank/omitted names, trim and length validation, per-request identity for duplicate songs, retries preserve names/counts, played/Undo preserves names, names excluded from public catalog and protected by owner access.');


// The say-name preference is private, durable and does not edit requester data.
user={userId:'owner',email:'owner@example.test'};
assert.equal((await (await manage.namespace.GET()).json()).includeRequesterNames,true);
const nameAction={action:'set-say-requester-names',includeNames:false};
user=null;assert.equal((await manage.namespace.PATCH(patch(nameAction))).status,403);
user={userId:'other',email:'other@example.test'};assert.equal((await manage.namespace.PATCH(patch(nameAction))).status,403);
user={userId:'owner',email:'owner@example.test'};
assert.equal((await manage.namespace.PATCH(patch(nameAction,'https://elsewhere.example'))).status,403);
assert.equal((await manage.namespace.PATCH(patch({...nameAction,includeNames:'false'}))).status,400);
const beforeNameSwitch=await (await manage.namespace.GET()).json();
assert.equal((await manage.namespace.PATCH(patch(nameAction))).status,200);
const afterNameSwitch=await (await manage.namespace.GET()).json();
assert.equal(afterNameSwitch.includeRequesterNames,false);assert.equal(afterNameSwitch.totalRequests,beforeNameSwitch.totalRequests);
assert.deepEqual(afterNameSwitch.queue,beforeNameSwitch.queue);assert(afterNameSwitch.queue.some(r=>r.requesterName==='Example Bard'));
assert.equal((await manage.namespace.PATCH(patch({action:'reset-show'}))).status,200);
assert.equal((await (await manage.namespace.GET()).json()).includeRequesterNames,false);
assert.equal((await manage.namespace.PATCH(patch({...nameAction,includeNames:true}))).status,200);
assert.equal((await (await manage.namespace.GET()).json()).includeRequesterNames,true);
assert(!('includeRequesterNames' in await (await cat.namespace.GET()).json()));
console.log('PASS: name-announcement switch authorization, boolean validation, persistence across reset, names/queue/totals retained, and private setting excluded from public catalog.');

// Embedded guest requests retain their own visitor identity and retry safety.
user={userId:'owner',email:'owner@example.test'};
await manage.namespace.PATCH(patch({action:'set-requests-open',open:true}));
await manage.namespace.PATCH(patch({action:'reset-show'}));
user=null;
const embedRequestId=crypto.randomUUID();
const embedResponse=await request.namespace.POST(req('/api/request',{id:embedRequestId,songId:original.id,requesterName:'Carrd Listener',embedded:true}));
assert.equal(embedResponse.status,200);
const embedSetCookie=embedResponse.headers.get('set-cookie');
assert.match(embedSetCookie,/SameSite=None; Partitioned/);assert.match(embedSetCookie,/HttpOnly/);assert.match(embedSetCookie,/Secure/);
const embedRetry=req('/api/request',{id:embedRequestId,songId:original.id,requesterName:'Carrd Listener',embedded:true});
embedRetry.headers.set('Cookie',embedSetCookie.split(';')[0]);
assert.equal((await request.namespace.POST(embedRetry)).status,200);
user={userId:'owner',email:'owner@example.test'};
const embedQueue=await (await manage.namespace.GET()).json();
assert.equal(embedQueue.queue.length,1);assert.equal(embedQueue.queue[0].requesterName,'Carrd Listener');
user=null;
const standaloneResponse=await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id}));
assert.match(standaloneResponse.headers.get('set-cookie'),/SameSite=Lax/);assert(!standaloneResponse.headers.get('set-cookie').includes('Partitioned'));
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id,embedded:true},'https://songbook.carrd.co'))).status,403,'embed does not bypass same-origin write checks');
assert.equal((await request.namespace.POST(req('/api/request',{id:crypto.randomUUID(),songId:original.id,embedded:'true'}))).status,400);
console.log('PASS: embedded guest cookie partitioning, secure/HttpOnly flags, idempotent retries, names visible to owner, standalone cookie behavior, embed origin protection and validation.');

// Playing Next follows the current waiting queue, independent of catalog order.
user={userId:'owner',email:'owner@example.test'};
await manage.namespace.PATCH(patch({action:'reset-show'}));
const nextShow=await showModule.namespace.currentShow();
const laterSong=data.songs.find(s=>s.title!==pair[0].title);
const firstNextId='00000000-0000-4000-8000-000000000003';
const duplicateNextId='00000000-0000-4000-8000-000000000002';
const laterNextId='00000000-0000-4000-8000-000000000001';
function seedNext(id,songId,time,showId=nextShow,playedAt=null){sql.prepare('INSERT INTO listener_requests (id,song_id,visitor,created_at,show_id,played_at,requester_name) VALUES (?,?,?,?,?,?,?)').run(id,songId,'private-visitor',time,showId,playedAt,'Private requester');}
seedNext(crypto.randomUUID(),laterSong.id,1,'old-show');
seedNext(crypto.randomUUID(),laterSong.id,2,nextShow,3);
seedNext(crypto.randomUUID(),'missing-song',4);
seedNext(firstNextId,pair[0].id,100);
seedNext(duplicateNextId,pair[1].id,200);
seedNext(laterNextId,laterSong.id,200);
user=null;
let nextCatalog=await (await cat.namespace.GET()).json();
assert.equal(nextCatalog.playingNextSongId,pair[0].id,'oldest pending request wins');
assert(!('queue' in nextCatalog));assert(!('counts' in nextCatalog));
for(const field of ['requesterName','createdAt','visitor','Private requester'])assert(!JSON.stringify(nextCatalog).includes(field));
// A live song excludes equivalent arrangements from Playing Next.
sql.prepare("INSERT INTO midibard_playback (id,show_id,event_id,song_id,file_name,playing,updated_at) VALUES ('owner',?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET show_id=excluded.show_id,event_id=excluded.event_id,song_id=excluded.song_id,playing=1,updated_at=excluded.updated_at").run(nextShow,crypto.randomUUID(),pair[1].id,'test.mid',Date.now());
nextCatalog=await (await cat.namespace.GET()).json();
assert.equal(nextCatalog.statuses[pair[0].id].playing,true);
assert.equal(nextCatalog.playingNextSongId,laterSong.id);
sql.prepare("UPDATE midibard_playback SET playing=0 WHERE id='owner'").run();
user={userId:'owner',email:'owner@example.test'};
await manage.namespace.PATCH(patch({id:firstNextId}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,laterSong.id,'equal times use the owner queue ID order');
await manage.namespace.PATCH(patch({id:firstNextId,undo:true}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,pair[0].id,'Undo restores the oldest request');
await manage.namespace.PATCH(patch({action:'mark-song-played',songId:pair[0].id}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,laterSong.id,'playing a song clears all matching requests');
await manage.namespace.PATCH(patch({action:'set-requests-open',open:false}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,laterSong.id,'closed requests still show the waiting song');
await manage.namespace.PATCH(patch({id:laterNextId}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,null,'no waiting requests');
await manage.namespace.PATCH(patch({id:laterNextId,undo:true}));
await manage.namespace.PATCH(patch({action:'reset-show'}));
assert.equal((await (await cat.namespace.GET()).json()).playingNextSongId,null,'new show starts without a next request');
console.log('PASS: Playing Next uses oldest current-show pending requests, stable ties, ignores missing/played/old-show songs and live equivalent arrangements, advances after completion, restores on Undo, survives closure, clears on empty/reset, and excludes private request data.');
