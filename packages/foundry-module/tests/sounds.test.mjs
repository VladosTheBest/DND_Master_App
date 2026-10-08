import test from 'node:test';import assert from 'node:assert/strict';
import {soundProfiles,soundSamples,playEffectSound} from '../scripts/sounds.mjs';
import {profiles} from '../scripts/native-effects.mjs';
test('every animation has a finite, audible, bounded original sound',()=>{
 assert.deepEqual(Object.keys(soundProfiles).sort(),Object.keys(profiles).sort());
 const fingerprints=new Set();for(const key of Object.keys(profiles)){const data=soundSamples(key,24000);assert.equal(data.length,24960);let energy=0;for(const x of data){assert(Number.isFinite(x)&&Math.abs(x)<0.7);energy+=x*x}assert(Math.sqrt(energy/data.length)>0.005);assert(Math.abs(data.at(-1))<0.001);fingerprints.add(data.slice(0,100).join(','))}assert.equal(fingerprints.size,20);assert.equal(soundSamples('constructor'),null);assert.equal(soundSamples('bow',Infinity),null);
});
test('locked or muted audio is skipped without queued replay',()=>{globalThis.game={audio:{interface:{state:'suspended'}}};assert.equal(playEffectSound('bow','locked'),null);game.audio.interface={state:'running',gainNode:{gain:{value:0}},createBufferSource:()=>{throw Error('Muted sound must not start')}};assert.equal(playEffectSound('bow','muted'),null);delete globalThis.game});
