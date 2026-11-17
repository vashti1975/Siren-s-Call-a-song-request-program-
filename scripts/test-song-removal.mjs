import {fixtureSongsSource,songFixtures} from "./fixtures/catalog.mjs";
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
let beforeInsert;
function statement(text,args=[]){return {bind(...v){return statement(text,v)},async run(){if(beforeInsert&&text.startsWith('INSERT OR IGNORE INTO listener_requests')){const hook=beforeInsert;beforeInsert=null;await hook();}return sql.prepare(text).run(...args)},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}}};}
globalThis.TEST_ENV={SONGBOOK_OWNER_EMAIL:'owner@example.test',DB:{prepare:statement,async batch(items){sql.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
globalThis.TEST_USER={userId:'owner',email:'owner@example.test'};
const dir=mkdtempSync(join(tmpdir(),'songbook-removal-'));
try{
 await build({stdin:{contents:"export * as manage from './app/api/manage/route.ts';export * as request from './app/api/request/route.ts';export * as cat from './app/api/catalog/route.ts';export {listenerData} from './lib/listener.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'env',setup(b){b.onLoad({filter:/songs\.ts$/},args=>({contents:fixtureSongsSource(readFileSync(args.path,"utf8")),loader:"ts"}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.TEST_ENV'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'auth-mock'}));b.onLoad({filter:/.*/,namespace:'auth-mock'},()=>({contents:'export const getChatGPTUser=async()=>globalThis.TEST_USER'}));}}]});
 const {manage,request,cat,listenerData}=await import(join(dir,'test.mjs'));
 const origin='https://songbook.test';
 const http=(body,method='DELETE',from=origin)=>new Request(origin+'/api/manage',{method,headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const remove=(id,extra={})=>manage.DELETE(http({id,confirmed:true,...extra}));
 const data=async()=>(await (await manage.GET()).json());
 const publicData=async()=>(await (await cat.GET()).json());
 const send=(songId)=>request.POST(new Request(origin+'/api/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),songId})}));
 let owner=await data();const pair=owner.songs.filter(s=>s.title==='Fixture Duo'&&s.artist==='Fixture Duo Artist');assert.equal(pair.length,2);
 const [removed,kept]=pair;
 for(const user of [null,{email:'other@example.test'}]){globalThis.TEST_USER=user;assert.equal((await remove(removed.id)).status,403);}
 globalThis.TEST_USER={userId:'owner',email:'owner@example.test'};
 for(const body of [{id:removed.id},{id:removed.id,confirmed:false},{id:'',confirmed:true}])assert.equal((await manage.DELETE(http(body))).status,400);
 assert.equal((await manage.DELETE(http({id:removed.id,confirmed:true},'DELETE','https://other.test'))).status,403);
 assert.equal((await manage.DELETE(new Request(origin+'/api/manage',{method:'DELETE',headers:{Origin:origin},body:'{'}))).status,400);
 assert.equal((await remove('missing')).status,404);
 assert.equal((await publicData()).songs.filter(s=>s.title==='Fixture Duo').length,2);

 // Request and play one song, then request it again. Removal must cancel only
 // its pending reservation, without manufacturing a play or losing history.
 sql.prepare("INSERT INTO listener_profiles(user_id,created_at,updated_at) VALUES('owner',1,1)").run();
 assert.equal((await manage.POST(http({...removed,note:'Saved before removal',durationSeconds:225},'POST'))).status,200);
 assert.equal((await send(removed.id)).status,200);
 assert.equal((await manage.PATCH(http({action:'mark-song-played',songId:removed.id},'PATCH'))).status,200);
 // Timestamp must follow the play so it reserves a new performance.
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal((await send(removed.id)).status,200);assert.equal((await send(kept.id)).status,200);
 owner=await data();assert.equal(owner.showBudget.playedSeconds,225);assert.equal(owner.showBudget.queuedSeconds,225);
 const before={requests:sql.prepare('SELECT * FROM listener_requests ORDER BY id').all(),awards:sql.prepare('SELECT * FROM listener_note_awards').all(),total:owner.totalRequests};
 assert.equal((await remove(removed.id)).status,200);
 owner=await data();assert(!owner.songs.some(s=>s.id===removed.id));assert(owner.songs.some(s=>s.id===kept.id));assert(!owner.queue.some(r=>r.songId===removed.id));assert(owner.queue.some(r=>r.songId===kept.id));
 assert.equal(owner.totalRequests,before.total);assert.equal(owner.counts.find(c=>c.songId===kept.id).total,3,'retained duplicate keeps the combined historical count');
 assert.equal(owner.showBudget.playedSeconds,225,'elapsed time survives removal');assert.equal(owner.showBudget.unknownPlayed,0);assert.equal(owner.showBudget.queuedSeconds,225,'only the retained entry still reserves time');
 let pub=await publicData();assert.equal(pub.songs.filter(s=>s.title==='Fixture Duo').length,1);assert(!pub.statuses[removed.id]);assert.equal(pub.playingNextSongId,kept.id);
 assert.equal((await send(removed.id)).status,404,'stale listener pages cannot request removed songs');
 assert.equal((await manage.POST(http({...removed,title:'Stale edit'},'POST'))).status,404,'stale editor cannot restore removed songs');
 assert.deepEqual(sql.prepare('SELECT * FROM listener_requests ORDER BY id').all(),before.requests);
 assert.deepEqual(sql.prepare('SELECT * FROM listener_note_awards').all(),before.awards);
 assert.equal((await listenerData()).totalRequests,3);assert.equal((await listenerData()).noteCount,1);
 assert.equal((await remove(removed.id)).status,200,'retry is safe');
 const fresh=await import(join(dir,'test.mjs')+'?restart=1');assert(!(await (await fresh.cat.GET()).json()).songs.some(s=>s.id===removed.id),'removal persists across worker restarts');
 const staleRequest=owner.queue[0];assert.equal((await remove(kept.id)).status,200);owner=await data();assert.equal(owner.queue.length,0);assert.equal(owner.showBudget.queuedSeconds,0);assert.equal(owner.showBudget.unknownQueued,0);assert.equal(owner.showBudget.playedSeconds,225);
 assert.equal((await manage.PATCH(http({id:staleRequest.id},'PATCH'))).status,404,'stale completion cannot mark removed songs played');

 const added=await (await manage.POST(http({title:'Temporary arrangement',artist:'Songbook',set:'Anime',note:''},'POST'))).json();assert(added.id);
 assert.equal((await remove(added.id)).status,200);assert(!(await publicData()).songs.some(s=>s.id===added.id),'newly added songs can also be removed');
 const readded=await (await manage.POST(http({title:removed.title,artist:removed.artist,set:removed.set,note:''},'POST'))).json();assert.notEqual(readded.id,removed.id);assert((await publicData()).songs.some(s=>s.id===readded.id),'owner can add a song again');
 beforeInsert=()=>remove(readded.id);
 assert.equal((await send(readded.id)).status,404,'removal during acceptance invalidates the old budget revision');
 assert(!sql.prepare('SELECT 1 FROM listener_requests WHERE song_id=?').get(readded.id));
 console.log('PASS: confirmed owner-only removal, original/custom songs, duplicate isolation, persistent removal, stale edit/request protection, concurrent request rejection, queue cleanup, totals/rewards/history and played-time preservation.');
}finally{sql.close();rmSync(dir,{recursive:true,force:true});}
