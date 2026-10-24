const {build}=require("esbuild");
const assert=require("node:assert/strict");
(async()=>{
 const r=await build({entryPoints:["apps/web/src/features/entities/quest-appearance.ts"],bundle:true,platform:"node",format:"cjs",write:false});
 const m={exports:{}};new Function("module","exports",r.outputFiles[0].text)(m,m.exports);
 const clean=m.exports.sanitizeQuestAppearance;
 assert.equal(clean(undefined),undefined);
 assert.deepEqual(clean({}),{});
 const value={textColor:"#EEE5FF",backgroundColor:"#302b40",accentColor:"#B4A5ED",density:"compact"};
 assert.deepEqual(clean(value),{textColor:"#eee5ff",backgroundColor:"#302b40",accentColor:"#b4a5ed",density:"compact"});
 assert.equal(value.textColor,"#EEE5FF");
 assert.deepEqual(clean({textColor:"red;display:none",backgroundColor:"url(x)",accentColor:"#abc",density:"giant"}),{});
 console.log("Quest appearance: optional fields, normalized colors, reset and CSS rejection passed");
})().catch(e=>{console.error(e);process.exit(1)});
