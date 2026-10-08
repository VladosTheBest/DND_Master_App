// Account credentials and GM-only source data stay in this GM's browser.
const dbName="shadow-edge-foundry-v1";
export async function database() {
  return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore("state");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
}
const key=()=>`${game.world.id}:${game.user.id}`;
export async function loadState(){const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction("state").objectStore("state").get(key());r.onsuccess=()=>resolve(r.result??{records:{}});r.onerror=()=>reject(r.error)})}finally{db.close()}}
export async function saveState(state){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction("state","readwrite");tx.objectStore("state").put(state,key());tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
