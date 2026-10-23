import { build } from "esbuild";
import assert from "node:assert/strict";

const load = async path => {
  const result = await build({ entryPoints:[path],bundle:true,write:false,format:"esm",platform:"node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
};
const { requestJson, ApiError } = await load("packages/api-client/src/index.ts");
const reply = (status, data, code) => new Response(JSON.stringify({data,error:code?{code,message:"test failure"}:null}),{status});
const calls=[];
let responses=[];
globalThis.fetch = async (url,init) => { calls.push({url,init}); const result=responses.shift(); if(result instanceof Error) throw result; return result; };
const scenario = list => { calls.length=0; responses=list; };

scenario([reply(401,null),reply(200,{authenticated:true}),reply(200,{id:"read"})]);
assert.deepEqual(await requestJson("http://test/api/campaigns"),{id:"read"});
assert.equal(calls.length,3,"safe GET can recover once");
scenario([reply(401,null)]);
await assert.rejects(requestJson("http://test/api/campaigns",{method:"POST",body:"{}"}),e=>e instanceof ApiError && e.status===401);
assert.equal(calls.length,1,"a mutation must never be replayed");
scenario([reply(401,null)]);
await assert.rejects(requestJson("http://test/api/character-sheets/test-only-token"),e=>e.status===401);
assert.equal(calls.length,1,"public token access must not become account recovery");
scenario([reply(409,{revision:7},"revision_conflict")]);
await assert.rejects(requestJson("http://test/api/campaigns/c/entities/e",{method:"PUT"}),e=>e.code==="revision_conflict" && e.current.revision===7);
scenario([new Response("<html>proxy down</html>",{status:503})]);
await assert.rejects(requestJson("http://test/api/campaigns"),e=>e instanceof ApiError && e.status===503);
scenario([new Response("",{status:200})]);
await assert.rejects(requestJson("http://test/api/campaigns"),e=>e instanceof ApiError);
scenario([new Response('"invalid envelope"',{status:200})]);
await assert.rejects(requestJson("http://test/api/campaigns"),e=>e instanceof ApiError);
scenario([new TypeError("fetch failed")]);
await assert.rejects(requestJson("http://test/api/campaigns",{method:"PUT"}),e=>e instanceof ApiError && e.code==="network_error");
assert.equal(calls.length,1);
const abort = new AbortController(); abort.abort();
scenario([new DOMException("Aborted","AbortError")]);
await assert.rejects(requestJson("http://test/api/campaigns",{signal:abort.signal}),e=>e.name==="AbortError");
assert.equal(calls[0].init.signal,abort.signal);

const { browserStorage } = await load("apps/web/src/app/browser-storage.ts");
globalThis.window={get localStorage(){throw new DOMException("Disabled","SecurityError")}};
assert.equal(browserStorage.getItem("key"),null);
assert.equal(browserStorage.setItem("key","value"),false);
assert.equal(browserStorage.removeItem("key"),false);
console.log("Passed: safe recovery, no mutation replay, token access, conflict payload, proxy/empty response, abort and disabled browser storage.");
