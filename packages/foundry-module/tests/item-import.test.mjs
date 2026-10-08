import test from 'node:test';
import assert from 'node:assert/strict';
import {importItems} from '../scripts/item-import.mjs';
import {MODULE,clone} from '../scripts/core.mjs';
class Item {
 constructor(data){Object.assign(this,clone(data))}
 toObject(){return clone({...this})}
 async update(data){for(const [key,value]of Object.entries(data)){if(key==='system.uses.spent')this.system.uses.spent=value;else this[key]=clone(value)}}
}
globalThis.CONFIG={Item:{documentClass:Item}};
const source=()=>({name:'Feature',type:'feat',system:{description:{value:'Original'},uses:{max:'3'}},flags:{[MODULE]:{importKey:'ability-0'}}});
function setup(){const item=new Item(source()),actor={name:'Actor',items:[item],createEmbeddedDocuments:async(_type,data)=>{const created=data.map(d=>new Item(d));actor.items.push(...created);return created}};return {actor,item}}
test('unchanged site data preserves a local edit silently; competing revision is reported once',async()=>{
 const {actor,item}=setup(),state={itemBaselines:{'ability-0':source()},itemSources:{'ability-0':source()}};
 item.system.description.value='GM edit';assert.deepEqual(await importItems(actor,[source()],state),[]);assert.equal(item.system.description.value,'GM edit');
 const incoming=source();incoming.system.description.value='Site edit';const report=await importItems(actor,[incoming],state);assert.equal(report.length,1);assert.equal(report[0].item,'Feature');assert.equal(item.system.description.value,'GM edit');
});
test('legacy baseline compares normalized site data without warning for unchanged source',async()=>{
 const {actor,item}=setup(),state={itemBaselines:{'ability-0':source()}};item.name='Local name';assert.deepEqual(await importItems(actor,[source()],state),[]);assert.equal(item.name,'Local name');
});
test('missing history is adopted only for identical items; different items remain protected',async()=>{
 const {actor,item}=setup(),state={};assert.deepEqual(await importItems(actor,[source()],state),[]);assert(state.itemBaselines['ability-0']);
 item.name='Different';const report=await importItems(actor,[source()],{});assert.equal(report.length,1);assert.match(report[0].reason,/Нет истории/);assert.equal(item.name,'Different');
});
test('spent uses do not cause a false conflict and are not replenished by import',async()=>{
 const {actor,item}=setup(),baseline=source();baseline.system.uses.spent=0;item.system.uses.spent=2;
 const incoming=source();incoming.name='New site name';assert.deepEqual(await importItems(actor,[incoming],{itemBaselines:{'ability-0':baseline}}),[]);assert.equal(item.name,'New site name');assert.equal(item.system.uses.spent,2);
});
