const {build}=require('esbuild');
const assert=require('node:assert/strict');
(async()=>{
  const result=await build({entryPoints:['apps/web/src/features/entities/reward-input.ts'],bundle:true,platform:'node',format:'cjs',write:false});
  const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports);
  const sanitize=mod.exports.sanitizeMonsterRewardProfile;
  const empty={name:'',category:'Лут',quantity:'',check:'',dc:'',details:''};
  assert.equal(sanitize(undefined),undefined);
  assert.deepEqual(sanitize({summary:'',loot:[empty]}),{summary:'',loot:[]});
  assert.deepEqual(sanitize({summary:'',loot:[]}),{summary:'',loot:[]});
  const named=sanitize({summary:'  Награда ',loot:[empty,{...empty,name:'  Ключ ',quantity:' 2 '}]});
  assert.equal(named.summary,'Награда');assert.equal(named.loot.length,1);assert.equal(named.loot[0].name,'Ключ');assert.equal(named.loot[0].quantity,'2');
  assert.equal(sanitize({summary:'',loot:[{...empty,category:'Трофей'}]}).loot.length,1);
  assert.equal(sanitize({summary:'',loot:[{...empty,details:'След на коже'}]}).loot.length,1);
  console.log('Reward input: empty scaffolding, explicit clearing, real loot and custom categories passed');
})();
