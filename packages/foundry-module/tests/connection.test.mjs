import test from "node:test";
import assert from "node:assert/strict";
import {completeConnection} from "../scripts/connection.mjs";

const pending={base:"https://example.test",token:"test-only-secret",pairing:"test-pairing",records:{}};
test("approval finalizes the campaign without importing documents",async()=>{
  const paths=[];
  const result=await completeConnection(pending,async(_state,path)=>{paths.push(path);return path==="v1/snapshot"?{campaignId:"campaign",title:"Test"}:{approved:true,connectionId:"grant"}});
  assert.deepEqual(paths,["pairings/test-pairing","v1/snapshot"]);
  assert.equal(result.campaignId,"campaign");assert.equal(result.connectionId,"grant");assert(!result.pairing);
  assert.equal(pending.pairing,"test-pairing");assert.equal(result.token,pending.token);
});
test("unapproved and failed requests retain the pending secret for retry",async()=>{
  let requests=0;
  await assert.rejects(completeConnection(pending,async()=>{requests++;return {approved:false}}),/Подтвердите кампанию/);
  assert.equal(requests,1);
  await assert.rejects(completeConnection(pending,async()=>{throw new TypeError("Failed to fetch")}),/Failed to fetch/);
  assert.equal(pending.pairing,"test-pairing");assert.equal(pending.token,"test-only-secret");
});
test("expired pairing recovers a persisted grant through authenticated snapshot",async()=>{
  const result=await completeConnection(pending,async(state,path)=>{assert.equal(state.token,pending.token);if(path!=="v1/snapshot")throw Object.assign(Error("Expired"),{code:"pairing_expired"});return {campaignId:"campaign",title:"Test"}});
  assert.equal(result.campaignId,"campaign");assert(!result.pairing);
  await assert.rejects(completeConnection(pending,async(_state,path)=>{throw path==="v1/snapshot"?Object.assign(Error("Unauthorized"),{status:401}):Object.assign(Error("Expired"),{code:"pairing_expired"})}),/Новое подключение/);
});
test("completed connection is idempotent; denied pairing cannot fall back",async()=>{
  const state={...pending,campaignId:"campaign"};assert.equal(await completeConnection(state,()=>{throw Error("Unexpected request")}),state);
  let requests=0;await assert.rejects(completeConnection(pending,async()=>{requests++;throw Object.assign(Error("Denied"),{code:"pairing_denied"})}),/Denied/);assert.equal(requests,1);
});
