import test from "node:test";
import assert from "node:assert/strict";
import {basicAbility,scenePlan,spellKey,supportedSpells,persistentProjection} from "../scripts/adapter.mjs";
test("ambiguous attacks stay manual instead of receiving invented damage",()=>{
 const x=basicAbility({name:"Unknown",toHit:"special",damage:"varies"});assert.deepEqual(x.system.activities,{});assert.equal(x.flags["shadow-edge-gm"].coverage,"manual");
 const y=basicAbility({name:"Sword",toHit:"+5",damage:"1d8+3 slashing"});assert.equal(Object.values(y.system.activities)[0].attack.bonus,"5");
});
test("scene geometry uses source pixels and new scenes are inactive",()=>{
 const s=scenePlan({key:"session-map:1",kind:"session-map",title:"House"},{id:"floor",name:"Ground",imageUrl:"/map.png",width:1000,height:500,walls:[{kind:"door",start:{x:0.1,y:0.2},end:{x:0.4,y:0.6}}],grid:{type:"square",size:0.1},gridDistance:5});assert.deepEqual(s.walls[0].c,[100,100,400,300]);assert.equal(s.walls[0].door,1);assert.equal(s.active,false);
});
test("edition keys retain a common profile without sharing source documents",()=>{assert.equal(spellKey("fireball-2014"),"fireball");assert.equal(spellKey("fireball-2024"),"fireball");assert.equal(supportedSpells.size,10)});
test("projection never includes unrequested runtime fields",()=>{assert.deepEqual(persistentProjection({name:"A",system:{hp:{max:30,value:2}}},{name:"A",system:{hp:{max:30}}}),{name:"A",system:{hp:{max:30}}})});
test("embedded document IDs and door state do not create authoring conflicts",()=>{assert.deepEqual(persistentProjection({walls:[{_id:"local-id",c:[1,2,3,4],door:1,ds:1}]},{walls:[{c:[1,2,3,4],door:1}]}),{walls:[{c:[1,2,3,4],door:1}]})});
