import test from 'node:test';import assert from 'node:assert/strict';import {MODULE} from '../scripts/core.mjs';import {animationProfile,weaponProfile,receiveAnimation} from '../scripts/animations.mjs';import {validEffect,profiles} from '../scripts/native-effects.mjs';
test('weapon names and structured base items select bundled profiles',()=>{for(const [name,key]of [['Длинный лук','bow'],['Light Crossbow','crossbow'],['Боевой топор','axe'],['Longsword','sword'],['Когти','claw'],['Копьё','spear'],['Кинжал','dagger'],['Боевой молот','hammer']])assert.equal(weaponProfile({name}).key,key);assert.equal(weaponProfile({name:'Custom',system:{type:{baseItem:'longbow'}}}).key,'bow');assert.equal(animationProfile({name:'Меч'}, {type:'attack'}),null);assert.equal(animationProfile({flags:{[MODULE]:{spellId:'shield-2024'}}}).mode,'self');assert.equal(Object.keys(profiles).length,85)});
const payload=()=>({id:'one',key:'bow',sceneId:'scene',userId:'player',actorUuid:'Actor.one',source:{x:10,y:10},targets:[{x:20,y:20}],size:100});
test('foundation includes exactly forty spells through sixth level and distinguishes natural attacks from magical projectiles',async()=>{
 const {animationCatalog}=await import('../scripts/animation-catalog.mjs'),foundation=animationCatalog.filter(p=>p.foundation);
 assert.equal(foundation.length,40);assert.equal(new Set(foundation.map(p=>p.key)).size,40);assert(foundation.every(p=>p.spellLevel>=0&&p.spellLevel<=6&&p.aliases.length));
 for(const [name,key]of [['Укус','bite'],['Удар хвостом','tail'],['Щупальце','tentacle'],['Удар рогами','horn'],['Жало','sting'],['Булава','mace'],['Посох','staff'],['Скимитар','sword']])assert.equal(weaponProfile({name}).key,key);
 assert.equal(animationProfile({name:'Custom fire',type:'spell',flags:{[MODULE]:{}}},{type:'attack',attack:{type:{value:'ranged',classification:'spell'}},damage:{parts:[{types:['fire']}]}}).key,'fire-bolt');
 assert.equal(animationProfile({name:'Удержание личности',flags:{[MODULE]:{}}}).key,'hold-person');
});
test('socket input is bounded and checks actor permission',async()=>{assert(validEffect(payload()));for(const bad of [{key:'constructor'},{key:'__proto__'},{key:'https://example.com/script'},{size:Infinity},{targets:Array(21).fill({x:1,y:2})},{template:{x:0,y:0,length:100000,direction:0}},{source:{x:NaN,y:0}}])assert.equal(validEffect({...payload(),...bad}),false);globalThis.canvas={scene:{id:'scene'}};globalThis.game={users:new Map([['player',{isGM:false}]])};globalThis.fromUuid=async()=>({testUserPermission:()=>false});assert.equal(await receiveAnimation(payload()),false)});


test('AI and renderer share a complete catalog with packaged transparent art',async()=>{const {readFile}=await import('node:fs/promises'),{animationCatalog}=await import('../scripts/animation-catalog.mjs');const server=JSON.parse(await readFile(new URL('../../../apps/server/internal/httpapi/foundry_animation_catalog.json',import.meta.url),'utf8'));assert.deepEqual(animationCatalog,server);assert.deepEqual(animationCatalog.map(p=>p.key).sort(),Object.keys(profiles).sort());for(const name of ['weapons','vines','blood-slash','magic']){const data=await readFile(new URL('../assets/'+name+'.png',import.meta.url));assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(data[25],6)}assert.equal(validEffect({...payload(),targets:[{x:20,y:20,hit:'yes'}]}),false)});

test('Sequencer resolves installed files only and safely falls back',async()=>{
 const {sequencerFile,playSequencerEffect,sequencerFinished}=await import('../scripts/sequencer-effects.mjs');
 let enabled=true,files=['https://bad.invalid/a.webm','modules/JB2A/../bad.webm','modules/JB2A/Loop.webm','modules/JB2A/claws.webm'],calls=[];
 globalThis.game={settings:{get:()=>enabled},modules:new Map([['sequencer',{active:true}]]),audio:{}};
 globalThis.Sequencer={Database:{getAllFileEntries:()=>files}};
 globalThis.Sequence=class {effect(){return this}file(v){calls.push(v);return this}name(){return this}duration(){return this}fadeIn(){return this}fadeOut(){return this}volume(){return this}atLocation(){return this}stretchTo(){return this}size(){return this}tint(){return this}waitUntilFinished(){calls.push("wait");return this}play(options){calls.push(options);return Promise.resolve()}};
 assert.equal(sequencerFile('claw'),'modules/JB2A/claws.webm');assert.equal(sequencerFile('unknown'),null);
 const p={...payload(),key:'claw',id:'seq-test',targets:[{x:20,y:20,hit:true}]};
 assert.equal(playSequencerEffect(p,()=>assert.fail('fallback')),true);await sequencerFinished(p.id);assert.deepEqual(calls,['modules/JB2A/claws.webm','wait',{local:true}]);
 assert.equal(playSequencerEffect({...p,template:{}},()=>{}),false);assert.equal(playSequencerEffect({...p,targets:[{x:20,y:20,hit:false}]},()=>{}),false);
 enabled=false;assert.equal(sequencerFile('claw'),null);enabled=true;
 files=[];assert.equal(playSequencerEffect(p,()=>{}),false);
 Sequencer.Database.getAllFileEntries=()=>{throw Error('not ready')};assert.equal(playSequencerEffect(p,()=>{}),false);
 Sequencer.Database.getAllFileEntries=()=>['modules/JB2A/claws.webm'];Sequence.prototype.play=()=>Promise.reject(Error('decode failed'));
 let fallback=0;assert.equal(playSequencerEffect(p,()=>fallback++),true);await sequencerFinished(p.id);assert.equal(fallback,1);
 delete globalThis.Sequence;delete globalThis.Sequencer;
});

test('installed catalog is bounded and selected database names resolve before defaults',async()=>{
 const {sequencerCatalog,sequencerFile}=await import('../scripts/sequencer-effects.mjs');globalThis.game={settings:{get:()=>true},modules:new Map([['sequencer',{active:true}]])};globalThis.Sequence=class {};
 globalThis.Sequencer={Database:{getPathsUnder:()=>['bite','tail','../unsafe','bite'],getAllFileEntries:key=>key==='jb2a.tail'?['modules/JB2A/tail.webm']:[]}};
 assert.deepEqual(sequencerCatalog(),['jb2a.bite','jb2a.tail']);assert.equal(sequencerFile('slam','jb2a.tail'),'modules/JB2A/tail.webm');assert.equal(validEffect({...payload(),sequencerAnimation:'https://bad.invalid/file.webm'}),false);
 delete globalThis.Sequence;delete globalThis.Sequencer;
});

test('area geometry uses full dimensions and cold rejects a fire-only selection',async()=>{
 const {animationTemplate,animationTheme}=await import('../scripts/area-geometry.mjs');
 const p=animationTemplate({shapes:[{type:'rectangle',x:100,y:200,width:1200,height:300}]},{grid:{size:100,distance:5}});
 assert.deepEqual([p.x,p.y,p.length],[700,350,600]);assert.equal(p.shapes[0].width,1200);
 assert.equal(animationTheme({name:'Снежная буря',system:{}},{}),'cold');
 const {sequencerFile,playSequencerEffect,sequencerFinished}=await import('../scripts/sequencer-effects.mjs');
 globalThis.game={settings:{get:()=>true},modules:new Map([['sequencer',{active:true}]])};globalThis.Sequencer={Database:{getAllFileEntries:path=>path==='jb2a.fireball'?['modules/JB2A/Fireball.webm']:['modules/JB2A/IceStorm.webm']}};
 let dimensions;globalThis.Sequence=class {effect(){return this}file(){return this}name(){return this}duration(){return this}fadeIn(){return this}fadeOut(){return this}volume(){return this}atLocation(){return this}size(v){dimensions=v;return this}waitUntilFinished(){return this}play(){return Promise.resolve()}};
 assert.match(sequencerFile('fireball','jb2a.fireball','cold'),/IceStorm/);
 assert(playSequencerEffect({...payload(),id:'area-size',key:'ice-storm',theme:'cold',template:p,targets:[]},()=>assert.fail()));await sequencerFinished('area-size');assert.deepEqual(dimensions,{width:1200,height:300});
 delete globalThis.Sequence;delete globalThis.Sequencer;
});
