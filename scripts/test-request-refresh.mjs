import assert from 'node:assert/strict';
import { createRequestRefresh } from '../lib/request-refresh.ts';
const refresh=createRequestRefresh();
const accepted=[],errors=[];
let polls=0,release,oldSignal;
const first=refresh.run(signal=>{polls++;oldSignal=signal;return new Promise(resolve=>{release=resolve;});},data=>accepted.push(data),error=>errors.push(error));
await Promise.resolve();
// A slow phone connection must finish instead of being restarted each poll.
const repeated=refresh.run(()=>{polls++;return Promise.resolve('wrong');},data=>accepted.push(data),error=>errors.push(error));
assert.equal(polls,1);
release('all 12 waiting');await Promise.all([first,repeated]);
assert.deepEqual(accepted,['all 12 waiting']);
// Even a transport ignoring abort cannot overwrite a newer post-action queue.
let releaseStale;
const stale=refresh.run(signal=>{oldSignal=signal;return new Promise(resolve=>{releaseStale=resolve;});},data=>accepted.push(data),error=>errors.push(error));
await Promise.resolve();refresh.invalidate();assert.equal(oldSignal.aborted,true);
await refresh.run(async()=> '11 waiting after confirmed play',data=>accepted.push(data),error=>errors.push(error));
releaseStale('stale 12 waiting');await stale;
assert.deepEqual(accepted,['all 12 waiting','11 waiting after confirmed play']);
// Losing connectivity keeps the last accepted list and a later refresh recovers.
await refresh.run(async()=>{throw new Error('offline');},data=>accepted.push(data),error=>errors.push(error));
assert.equal(accepted.length,2);assert.equal(errors[0].message,'offline');
await refresh.run(async()=> '12 after reconnect',data=>accepted.push(data),error=>errors.push(error));
assert.equal(accepted.at(-1),'12 after reconnect');
// Unmount cancels delivery without surfacing a false request error.
let rejectOld;
const unmounted=refresh.run(()=>new Promise((_,reject)=>{rejectOld=reject;}),data=>accepted.push(data),error=>errors.push(error));
await Promise.resolve();refresh.invalidate();rejectOld(new Error('aborted'));await unmounted;
assert.equal(errors.length,1);
console.log('PASS: slow polls coalesce; stale snapshots cannot overwrite newer queues; offline refresh preserves requests and recovers; unmount cancels delivery.');
