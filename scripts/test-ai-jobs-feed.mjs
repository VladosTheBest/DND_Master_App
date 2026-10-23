import {build} from 'esbuild';import assert from 'node:assert/strict';
const bundled=await build({entryPoints:['packages/api-client/src/ai-jobs-feed.ts'],bundle:true,write:false,format:'esm',platform:'node'});const {AIJobsFeed}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
let calls=0,resolve,hidden=false;const feed=new AIJobsFeed(()=>{calls++;return new Promise(r=>resolve=r)},()=>hidden);
const off1=feed.subscribe(()=>{}),off2=feed.subscribe(()=>{}),off3=feed.subscribe(()=>{});const flight=feed.refresh();assert.equal(calls,1,'all subscribers and refresh share one request');resolve([{id:'job',state:'running'}]);await flight;
const controller=new AbortController();const waiting=feed.wait('job',controller.signal);controller.abort();await assert.rejects(waiting,e=>e.name==='AbortError');assert.equal(feed.getSnapshot().jobs[0].state,'running','abort only stops UI waiting');off1();off2();off3();
// Old account responses cannot populate the new account's snapshot.
const stale=feed.refresh();feed.reset();resolve([{id:'old-owner',state:'succeeded'}]);await stale;assert.equal(feed.getSnapshot().jobs.length,0);
let timers=[];const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,delay)=>{timers.push(delay);return realTimeout(()=>{},100000)};
try{const idle=new AIJobsFeed(async()=>[],()=>hidden);const off=idle.subscribe(()=>{});await idle.refresh();assert.equal(timers.at(-1),30000);hidden=true;await idle.refresh();assert.equal(timers.at(-1),60000);off();const failing=new AIJobsFeed(async()=>{throw Error('offline')});const stop=failing.subscribe(()=>{});await assert.rejects(failing.refresh());assert.equal(timers.at(-1),5000);await assert.rejects(failing.refresh());assert.equal(timers.at(-1),10000);stop();}finally{globalThis.setTimeout=realTimeout;}
console.log('Passed: one feed, concurrent deduplication, wait abort, account isolation, idle/hidden timing and error backoff.');
