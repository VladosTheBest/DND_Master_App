import fs from 'node:fs';
import assert from 'node:assert/strict';
const manifest=JSON.parse(fs.readFileSync('apps/web/dist/.vite/manifest.json','utf8'));
const done=new Set(),stack=[];
function visit(key){
 assert.ok(manifest[key],`Missing static chunk ${key}`);
 assert.ok(!stack.includes(key),`Static chunk cycle: ${[...stack,key].join(' -> ')}`);
 if(done.has(key))return;
 stack.push(key);
 for(const next of manifest[key].imports||[])visit(next);
 stack.pop();done.add(key);
}
for(const key of Object.keys(manifest))visit(key);
console.log(`Build manifest: ${done.size} entries, all static imports present and acyclic`);

const startup=new Set();
function collect(key){if(startup.has(key))return;startup.add(key);for(const next of manifest[key].imports||[])collect(next);}
collect('index.html');
for(const key of startup)assert.ok(!/assets\/(?:App-|feature-|character-rules)/.test(manifest[key].file),`Gameplay code is eagerly loaded by sign-in: ${manifest[key].file}`);
console.log(`Sign-in boundary: ${startup.size} static entries, no App/gameplay/rules chunks`);
