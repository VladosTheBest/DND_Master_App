import test from "node:test";
import assert from "node:assert/strict";
import {basicAbility} from "../scripts/adapter.mjs";
import {authoringActor} from "../scripts/core.mjs";
const activity=item=>Object.values(item.system.activities)[0];
test('real Fiend Warlock wording preserves printed bonus and both damage types',()=>{
 const sword=basicAbility({name:'Скимитар',toHit:'+6 к попаданию',damage:'6 (1к6 + 3) рубящего урона плюс 14 (4к6) урона огнём.'});const a=activity(sword);assert.equal(sword.type,'weapon');assert.equal(a.attack.bonus,'6');assert.deepEqual(a.damage.parts.map(p=>[p.custom.formula,p.types[0]]),[['1d6+3','slashing'],['4d6','fire']]);
 const mace=activity(basicAbility({name:'Булава',toHit:'+3 к попаданию',damage:'Дробящий урон 3 (1к6) плюс урон огнём 10 (3к6).'}));assert.deepEqual(mace.damage.parts.map(p=>p.types[0]),['bludgeoning','fire']);
 const dto=authoringActor({items:[sword]}).items[0];assert.equal(dto.mechanics.kind,'attack');assert.deepEqual(activity(basicAbility(dto)).damage.parts.map(p=>p.types[0]),['slashing','fire']);
});
test('real Fiend Warlock hellfire uses the complete save sentence rather than truncated damage',()=>{
 const a=activity(basicAbility({name:'Адский огонь',damage:'16 (3к10) урона',description:'Колдун создаёт сферу радиусом 10 футов с центром в пределах 120 футов. Каждое существо должно совершить спасбросок Ловкости Сл 15, получая 16 (3к10) урона огнём и 11 (2к10) урона некротической энергией при провале, или половину этого урона при успешном спасброске.'}));assert.equal(a.type,'save');assert.deepEqual(a.save.ability,['dex']);assert.equal(a.save.dc.formula,'15');assert.equal(a.damage.onSave,'half');assert.equal(a.range.value,120);assert.equal(a.target.template.size,10);assert.deepEqual(a.damage.parts.map(p=>[p.custom.formula,p.types[0]]),[['3d10','fire'],['2d10','necrotic']]);
 const reaction=basicAbility({name:'Возмездие исчадия (3/день)',damage:'22 (4к10) урона некротической энергией',description:'Существо совершает спасбросок Телосложения Сл 15.'});assert.equal(reaction.system.uses.max,'3');assert.equal(activity(reaction).consumption.targets[0].type,'itemUses');
});
test("structured save, healing and ranged attack retain their actual activity types",()=>{
 const save=activity(basicAbility({name:"Breath",damage:"4d6 fire",foundry:{kind:"save",saveAbility:"dex",saveDc:15,saveDamage:"half",range:30}}));assert.equal(save.type,"save");assert.deepEqual(save.save.ability,["dex"]);assert.equal(save.save.dc.formula,"15");assert.equal(save.damage.onSave,"half");assert.equal(save.range.value,30);
 const heal=activity(basicAbility({name:"Heal",damage:"1d8+3",foundry:{kind:"heal",activation:"bonus"}}));assert.equal(heal.type,"heal");assert.equal(heal.healing.custom.formula,"1d8+3");assert.equal(heal.activation.type,"bonus");
 const ranged=activity(basicAbility({name:"Bow",toHit:"+0",damage:"1d6 piercing",foundry:{kind:"attack",attackMode:"ranged",range:60}}));assert.equal(ranged.attack.type.value,"ranged");assert.equal(ranged.attack.bonus,"0");
});
test("ambiguous multi-part damage, dynamic formulas and incomplete saves stay manual",()=>{for(const entry of [{damage:"1d8 + 1d6 fire",toHit:"5"},{damage:"1d8 piercing plus 2d6 poison on failed save",toHit:"5"},{damage:"1d8+@mod fire",toHit:"5"},{damage:"2d6 fire",foundry:{kind:"save",saveDc:14}},{damage:"2d6 fire",toHit:"5",foundry:{kind:"manual"}}])assert.deepEqual(basicAbility(entry).system.activities,{})});
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
