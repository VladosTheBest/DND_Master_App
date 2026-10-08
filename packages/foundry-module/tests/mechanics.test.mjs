import test from "node:test";
import assert from "node:assert/strict";
import {basicAbility} from "../scripts/adapter.mjs";
import {authoringActor} from "../scripts/core.mjs";
const activity=item=>Object.values(item.system.activities)[0];
test("structured save, healing and ranged attack retain their actual activity types",()=>{
 const save=activity(basicAbility({name:"Breath",damage:"4d6 fire",foundry:{kind:"save",saveAbility:"dex",saveDc:15,saveDamage:"half",range:30}}));assert.equal(save.type,"save");assert.deepEqual(save.save.ability,["dex"]);assert.equal(save.save.dc.formula,"15");assert.equal(save.damage.onSave,"half");assert.equal(save.range.value,30);
 const heal=activity(basicAbility({name:"Heal",damage:"1d8+3",foundry:{kind:"heal",activation:"bonus"}}));assert.equal(heal.type,"heal");assert.equal(heal.healing.custom.formula,"1d8+3");assert.equal(heal.activation.type,"bonus");
 const ranged=activity(basicAbility({name:"Bow",toHit:"+0",damage:"1d6 piercing",foundry:{kind:"attack",attackMode:"ranged",range:60}}));assert.equal(ranged.attack.type.value,"ranged");assert.equal(ranged.attack.bonus,"0");
});
test("ambiguous multi-part damage, dynamic formulas and incomplete saves stay manual",()=>{for(const entry of [{damage:"1d8 + 1d6 fire",toHit:"5"},{damage:"1d8+@mod fire",toHit:"5"},{damage:"2d6 fire",foundry:{kind:"save",saveDc:14}},{damage:"2d6 fire",toHit:"5",foundry:{kind:"manual"}}])assert.deepEqual(basicAbility(entry).system.activities,{})});
test("export and reimport of a fixed save preserve DC, half damage, range and activation",()=>{
 const item=basicAbility({name:"Breath",type:"feat",damage:"4d6 fire",foundry:{kind:"save",saveAbility:"con",saveDc:16,saveDamage:"half",range:60,activation:"reaction"}});item.id="breath";
 const transported=authoringActor({name:"Dragon",items:[item]}).items[0];assert.equal(transported.mechanics.kind,"save");assert.equal(transported.mechanics.saveDc,16);assert.equal(transported.mechanics.activation,"reaction");assert.equal(activity(basicAbility(transported)).type,"save");
});
test("derived attacks and resource-consuming actions cannot silently become free flat attacks",()=>{
 const item={id:"sword",type:"weapon",name:"Sword",system:{activities:{a:{type:"attack",activation:{type:"action"},attack:{flat:false},damage:{parts:[]}}}}};assert.equal(authoringActor({items:[item]}).items[0].mechanics.kind,"manual");
 item.system.activities.a.attack.flat=true;item.system.activities.a.consumption={targets:[{type:"itemUses",value:"1"}]};assert.equal(authoringActor({items:[item]}).items[0].mechanics.kind,"manual");
 item.system.activities.a.consumption={};item.system.activities.a.damage.parts=[{scaling:{mode:"whole"}}];assert.equal(authoringActor({items:[item]}).items[0].mechanics.kind,"manual");
});
test("Foundry activity collections are read through contents, not enumerable properties",()=>{const item=basicAbility({name:"Breath",damage:"2d6 fire",foundry:{kind:"save",saveAbility:"dex",saveDc:14}});item.system.activities={contents:Object.values(item.system.activities)};const dto=authoringActor({items:[item]}).items[0];assert.equal(dto.mechanics.kind,"save");assert.equal(dto.damage,"2d6");assert.equal(dto.saveDc,14)});
