const {build}=require('esbuild');
const assert=require('node:assert/strict');
(async()=>{
 const output=await build({entryPoints:['apps/web/src/features/entity-links/relation-draft.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const mod={exports:{}};new Function('module','exports',output.outputFiles[0].text)(mod,mod.exports);
 const read=mod.exports.readRelationDraft;
 const value={selected:{target:'A target'},reason:'My unsaved note',editing:null};
 assert.deepEqual(read(value,156,'source'),{...value,revision:156},'An older copy keeps its own revision');
 assert.deepEqual(read({...value,editing:'target'},0,'source'),{...value,editing:'target',revision:0});
 assert.ok(read({...value,reason:'🐉'.repeat(2000)},156,'source'),'Server limit counts Unicode code points');
 assert.notEqual(read(value,156,'source').selected,value.selected,'Recovery owns a new selection');
 for(const bad of [null,{},[],{...value,selected:null},{...value,selected:[]},{...value,selected:{source:'Self'}},{...value,selected:{target:7}},{...value,editing:'source'},{...value,editing:''},{...value,reason:'x'.repeat(2001)},{...value,selected:Object.fromEntries(Array.from({length:101},(_,i)=>['id'+i,'Name']))}])assert.equal(read(bad,156,'source'),null);
 for(const rev of [undefined,null,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'156'])assert.equal(read(value,rev,'source'),null);
 console.log('Relation drafts: original revision, legacy values, independent selection, corrupt/self/oversized copies passed');
})();
