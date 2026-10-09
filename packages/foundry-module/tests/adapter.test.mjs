import test from "node:test";
import assert from "node:assert/strict";
import {basicAbility,actorPlan,scenePlan,spellKey,supportedSpells,persistentProjection} from "../scripts/adapter.mjs";
test("dnd5e 6 stores flat AC in calcs while dnd5e 5 retains calc",async()=>{
 const previous=globalThis.game;try{for(const version of ["5.3.3","6.0.6"]){globalThis.game={system:{version},packs:new Map()};const plan=await actorPlan({key:"npc:ac",kind:"npc",data:{title:"AC",statBlock:{armorClass:"17"}}},[]);assert.deepEqual(plan.projection.system.attributes.ac,version.startsWith("6")?{calcs:["flat"],flat:17}:{calc:"flat",flat:17})}}finally{globalThis.game=previous}
});
test("ambiguous attacks stay manual instead of receiving invented damage",()=>{
 const x=basicAbility({name:"Unknown",toHit:"special",damage:"varies"});assert.deepEqual(x.system.activities,{});assert.equal(x.flags["shadow-edge-gm"].coverage,"manual");
 const y=basicAbility({name:"Sword",toHit:"+5",damage:"1d8+3 slashing"});assert.equal(Object.values(y.system.activities)[0].attack.bonus,"5");
});
test("scene geometry uses source pixels and new scenes are inactive",()=>{
 const s=scenePlan({key:"session-map:1",kind:"session-map",title:"House"},{id:"floor",name:"Ground",imageUrl:"/map.png",width:1000,height:500,walls:[{kind:"door",start:{x:0.1,y:0.2},end:{x:0.4,y:0.6}}],grid:{type:"square",size:0.1},gridDistance:5});assert.deepEqual(s.walls[0].c,[100,100,400,300]);assert.equal(s.walls[0].door,1);assert.equal(s.active,false);
});
test("edition keys retain a common profile without sharing source documents",()=>{assert.equal(spellKey("fireball-2014"),"fireball");assert.equal(spellKey("fireball-2024"),"fireball");assert.equal(supportedSpells.size,42)});
test("projection never includes unrequested runtime fields",()=>{assert.deepEqual(persistentProjection({name:"A",system:{hp:{max:30,value:2}}},{name:"A",system:{hp:{max:30}}}),{name:"A",system:{hp:{max:30}}})});
test("embedded document IDs and door state do not create authoring conflicts",()=>{assert.deepEqual(persistentProjection({walls:[{_id:"local-id",c:[1,2,3,4],door:1,ds:1}]},{walls:[{c:[1,2,3,4],door:1}]}),{walls:[{c:[1,2,3,4],door:1}]})});
test('wizard imports current preparation and book grants without resurrecting replaced cantrips',async()=>{
 const previous=globalThis.game;try{for(const version of ['5.3.3','6.0.6']){globalThis.game={system:{version},packs:new Map()};const plan=await actorPlan({key:'character:wizard',kind:'character',data:{draft:{name:'Wizard',classId:'wizard',edition:'2024',targetLevel:5,levels:[{spellIds:['old'],cantripIds:['old-cantrip']},{spellIds:['shield-2024','grease-2024'],cantripIds:['fire-bolt-2024'],preparedSpellIds:['shield-2024']}]},spellSelection:{known:['shield-2024','grease-2024','fireball-2024'],cantrips:['fire-bolt-2024'],prepared:['shield-2024'],always:['fireball-2024']},stats:{abilities:{int:18,dex:12},proficiencyBonus:3,skills:[{id:'arcana',ability:'int',proficient:true,bonus:10},{id:'perception',ability:'wis',proficient:false,bonus:0}]}}},[{id:'shield-2024',name:'Shield',level:1},{id:'grease-2024',name:'Grease',level:1},{id:'fireball-2024',name:'Fireball',level:3},{id:'fire-bolt-2024',name:'Fire Bolt',level:0}]);const spells=plan.items.filter(i=>i.type==='spell');assert.equal(spells.length,4);assert.deepEqual(plan.projection.system.skills.arc,{value:2,ability:'int'});assert.equal(spells.find(i=>i.flags['shadow-edge-gm'].spellId==='shield-2024').system[version[0]==='6'?'prepared':'preparation']?.prepared??spells[0].system.prepared,version[0]==='6'?1:true);const grease=spells.find(i=>i.flags['shadow-edge-gm'].spellId==='grease-2024');assert.equal(version[0]==='6'?grease.system.prepared:grease.system.preparation.prepared,version[0]==='6'?0:false)}}finally{globalThis.game=previous}
});
