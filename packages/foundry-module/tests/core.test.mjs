import test from "node:test";
import assert from "node:assert/strict";
import {mergeThree,damageFormula,scalarNumber,validBaseURL,authoringActor} from "../scripts/core.mjs";
test("three way merge keeps local fields, applies independent site changes, reports conflicts",()=>{
  const result=mergeThree({name:"A",stats:{hp:10,ac:12}},{name:"Local",stats:{hp:10,ac:13}},{name:"Remote",stats:{hp:15,ac:12}});
  assert.deepEqual(result.value,{name:"Local",stats:{hp:15,ac:13}});assert.deepEqual(result.conflicts,["name"]);
});
test("unknown formulas and unsafe URLs are never silently guessed",()=>{assert.equal(damageFormula("7 (2d6 + 1) fire"),"2d6+1");assert.equal(damageFormula("special"),null);assert.equal(scalarNumber("39 (6d8 + 12)"),39);assert.equal(scalarNumber("varies"),null);assert.throws(()=>validBaseURL("http://remote.example"));assert.throws(()=>validBaseURL("https://user:secret@example.com"));assert.equal(validBaseURL("http://localhost:8080"),"http://localhost:8080")});
test("actor transport excludes current HP, spent slots, effects and scripts",()=>{
  const d={name:"Hero",system:{abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(x=>[x,{value:12}])),attributes:{hp:{max:30,value:2},ac:{value:15},movement:{walk:30}},spells:{spell1:{value:0,max:4}},effects:[{script:"secret"}]},items:[]};
  const a=authoringActor(d);assert.equal(a.maxHp,30);assert(!JSON.stringify(a).includes('"value":2'));assert(!("spells" in a));assert(!("effects" in a));
});
test("arrays changed independently become an explicit conflict",()=>{assert.deepEqual(mergeThree([1],[1,2],[1,3]).conflicts,["document"])});
