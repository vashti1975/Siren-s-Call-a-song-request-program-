import {fixtureSongsSource,songFixtures} from "./fixtures/catalog.mjs";
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
function statement(text,args=[]){return {bind(...v){return statement(text,v)},async run(){return sql.prepare(text).run(...args)},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}}};}
globalThis.TEST_ENV={SONGBOOK_OWNER_EMAIL:'owner@example.test',DB:{prepare:statement}};
globalThis.TEST_USER=null;
const dir=mkdtempSync(join(tmpdir(),'songbook-feedback-'));
try{
await build({entryPoints:['app/api/feedback/route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'env',setup(b){b.onLoad({filter:/songs\.ts$/},args=>({contents:fixtureSongsSource(readFileSync(args.path,"utf8")),loader:"ts"}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.TEST_ENV'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'auth-mock'}));b.onLoad({filter:/.*/,namespace:'auth-mock'},()=>({contents:'export const getChatGPTUser=async()=>globalThis.TEST_USER'}));}}]});
const {GET,POST,PATCH}=await import(join(dir,'test.mjs'));
const origin='https://songbook.test',visitor=crypto.randomUUID();
function request(body,{method='POST',cookie=`songbook_listener=${visitor}`,requestOrigin=origin}={}){return new Request(origin+'/api/feedback',{method,headers:{'Content-Type':'application/json',Origin:requestOrigin,Cookie:cookie},body:JSON.stringify(body)});}
assert.equal((await GET()).status,403);
const id=crypto.randomUUID(),message='I love the songbook!\nCould we have more filters? <script>example</script>';
// Feedback is independent of song requests and remains open when those close.
sql.prepare("INSERT INTO show_state (id,show_id) VALUES ('requests-open','closed')").run();
let response=await POST(request({id,message:`  ${message}  `,name:'  A Listener  '}));
assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
assert(!response.headers.get('set-cookie').includes('Partitioned'));
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM listener_requests').get().n,0);
assert.equal((await GET()).status,403,'anonymous visitors cannot read comments');
globalThis.TEST_USER={email:'other@example.test'};assert.equal((await GET()).status,403);
assert.equal((await PATCH(request({id},{method:'PATCH'}))).status,403);
globalThis.TEST_USER={email:'owner@example.test'};
response=await GET();let data=await response.json();assert.equal(data.comments.length,1);
assert.equal(data.comments[0].message,message);assert.equal(data.comments[0].name,'A Listener');
assert(!JSON.stringify(data).includes(visitor));assert.match(response.headers.get('cache-control'),/private, no-store/);
// Same ID retries cannot duplicate, replace, or reveal feedback.
assert.equal((await POST(request({id,message:'Replacement'}))).status,200);
assert.equal((await POST(request({id,message:'Replacement'},{cookie:`songbook_listener=${crypto.randomUUID()}`}))).status,409);
assert.equal(sql.prepare('SELECT message FROM listener_feedback WHERE id=?').get(id).message,message);
assert.equal((await PATCH(request({id},{method:'PATCH',requestOrigin:'https://elsewhere.test'}))).status,403);
assert.equal((await PATCH(request({id},{method:'PATCH'}))).status,200);
assert.equal((await (await GET()).json()).comments.length,0);
assert.equal((await PATCH(request({id,undo:true},{method:'PATCH'}))).status,200);
assert.equal((await (await GET()).json()).comments[0].message,message);
assert.equal((await PATCH(request({id:crypto.randomUUID()},{method:'PATCH'}))).status,404);
globalThis.TEST_USER=null;
for(const body of [{message:''},{message:'  '},{message:'x'.repeat(1001)},{message:'hello',name:'x'.repeat(81)},{message:42},{message:'hello',embedded:'true'}])assert.equal((await POST(request({id:crypto.randomUUID(),...body}))).status,400);
assert.equal((await POST(request({id:crypto.randomUUID(),message:'hello'},{requestOrigin:'https://elsewhere.test'}))).status,403);
const anonymousId=crypto.randomUUID();assert.equal((await POST(request({id:anonymousId,message:'x'.repeat(1000),name:'   '}))).status,200);
assert.equal(sql.prepare('SELECT name FROM listener_feedback WHERE id=?').get(anonymousId).name,null);
const embedVisitor=crypto.randomUUID();response=await POST(request({id:crypto.randomUUID(),message:'From Carrd',embedded:true},{cookie:`songbook_listener=${embedVisitor}`}));
assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=None; Partitioned/);
for(let i=0;i<3;i++)assert.equal((await POST(request({id:crypto.randomUUID(),message:'Another idea'}))).status,200);
assert.equal((await POST(request({id:crypto.randomUUID(),message:'Too many'}))).status,429);
assert.equal((await POST(request({id,message}))).status,200,'accepted retries still work at the limit');
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM listener_feedback WHERE visitor=?').get(visitor).n,5);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM listener_requests').get().n,0);
console.log('PASS: independent guest feedback while song requests are closed, optional names, validation, owner-only reads/clearing, private headers, no visitor disclosure, safe plain-text storage, retry safety, rate limit, embedded cookies, reversible clearing and untouched song requests.');
}finally{sql.close();rmSync(dir,{recursive:true,force:true});}
