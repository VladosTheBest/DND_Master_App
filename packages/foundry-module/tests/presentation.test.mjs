import test from 'node:test';
import assert from 'node:assert/strict';
import {inferAttackMode,folderPath,lootItems,mediaEntries} from '../scripts/presentation.mjs';
import {basicAbility} from '../scripts/adapter.mjs';
import {animationProfile} from '../scripts/animations.mjs';

test('unconfigured distant shot imports as a ranged weapon and uses arrows',()=>{
 const item=basicAbility({name:'Дальний выстрел',toHit:'+4',damage:'1d8+2 piercing'});
 const activity=Object.values(item.system.activities)[0];
 assert.equal(item.type,'weapon');assert.equal(activity.attack.type.value,'ranged');assert.equal(activity.attack.bonus,'4');assert.equal(activity.damage.parts[0].custom.formula,'1d8+2');assert.equal(animationProfile(item,activity).key,'bow');
 assert.equal(inferAttackMode({name:'Выстрел',foundry:{attackMode:'melee'}}),'melee');
 assert.equal(animationProfile(basicAbility({name:'Метание копья',toHit:'+3',damage:'1d6 piercing',foundry:{attackMode:'ranged'}})).key,'thrown');
});
test('location parents are ordered and broken/cyclic parent references terminate',()=>{
 const parent={id:'p',title:'Parent',kind:'location',data:{parentId:'c'}},child={id:'c',title:'Child',kind:'location',data:{parentId:'p'}};
 assert.deepEqual(folderPath(child,[parent,child],'JournalEntry'),['Локации','Parent']);
 assert.deepEqual(folderPath(child,[],'JournalEntry'),['Локации']);
});
test('loot preserves supplied harvesting conditions; inferred items have no invented price or bonuses',()=>{
 const items=lootItems({data:{content:'Страж с верёвкой и книгой',rewardProfile:{loot:[{name:'Шкура',quantity:'1d6',check:'Выживание',dc:'12'}]}}});
 assert.equal(items[0].system.quantity,1);assert.match(items[0].system.description.value,/1d6/);assert.match(items[0].system.description.value,/Выживание/);
 assert(items.some(i=>i.name==='Верёвка'&&i.flags['shadow-edge-gm'].inferredLoot));assert(items.every(i=>!i.system.price&&!i.system.activities));
 assert.deepEqual(lootItems({data:{foundryCharacter:{items:[]},content:'Страж с верёвкой'}}),[]);
 assert.equal(mediaEntries({title:'Portrait',data:{art:{url:'/uploads/a.png'},gallery:[{url:'/uploads/a.png'},{url:'/uploads/b.png'}]}}).length,2);
});
