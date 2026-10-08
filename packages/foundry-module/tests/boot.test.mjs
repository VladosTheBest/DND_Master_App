import test from "node:test";
import assert from "node:assert/strict";
test("loading the module and opening a world make no API requests or sync timers",async()=>{
  const once=new Map(),hooks=new Map();let requests=0,timers=0;
  globalThis.Hooks={once:(name,callback)=>once.set(name,callback),on:(name,callback)=>hooks.set(name,callback)};
  globalThis.game={user:{isGM:true},settings:{register:()=>{}}};
  globalThis.document={createElement:()=>({}),body:{append:()=>{}}};
  const fetch=globalThis.fetch,interval=globalThis.setInterval;
  globalThis.fetch=()=>{requests++;throw Error("Unexpected automatic request")};
  globalThis.setInterval=()=>{timers++;throw Error("Unexpected automatic timer")};
  try{await import("../scripts/main.mjs");once.get("init")();once.get("ready")();assert.equal(requests,0);assert.equal(timers,0);assert(hooks.has("midi-qol.RollComplete"))}
  finally{globalThis.fetch=fetch;globalThis.setInterval=interval;delete globalThis.Hooks;delete globalThis.game;delete globalThis.document}
});
