import { build } from "esbuild";
import assert from "node:assert/strict";
const result=await build({entryPoints:["apps/web/src/app/workspace-route.ts"],bundle:true,write:false,format:"esm",platform:"node"});
const {readWorkspaceRoute,workspaceURL,workspaceSections,workspaceFilters}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
for(const section of workspaceSections){
 const expected={campaignId:"кампания/1",section,target:section==="chat"?"":"объект/#?&%",tab:"Все записи",query:"текст + запрос",view:section==="maps"?"scenes":"",filters:JSON.stringify({"items.category":"weapon","session.page":2}),context:section==="chat"?'{"includeCampaign":true,"sessionIds":[]}':undefined};
 const actual=readWorkspaceRoute(workspaceURL(expected));
 for(const key of Object.keys(expected))assert.deepEqual(actual[key],expected[key],`${section}: ${key}`);
}
assert.equal(readWorkspaceRoute('/?campaign=c&session=s').section,'sessions');
assert.equal(readWorkspaceRoute('/?campaign=c&session=s').target,'s');
assert.equal(readWorkspaceRoute('/maps?campaign=c&map=m&view=scenes').target,'m');
assert.equal(readWorkspaceRoute('/chat?campaign=c').section,'chat');
assert.doesNotThrow(()=>readWorkspaceRoute('/campaigns/%invalid/notes/%broken'));
assert.equal(readWorkspaceRoute('/campaigns/c/unknown').section,'dashboard');
console.log('Passed: every workspace section, Unicode/encoded identifiers, targets, tabs, queries and legacy session/maps/chat links.');

assert.deepEqual(workspaceFilters("{invalid"),{});
assert.deepEqual(workspaceFilters(JSON.stringify({a:"ok",b:3,c:true,nested:{bad:true},nil:null})),{a:"ok",b:3,c:true});
