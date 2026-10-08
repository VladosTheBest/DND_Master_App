import test from 'node:test';
import assert from 'node:assert/strict';
import {portraitCrop,tokenArtUpdates} from '../scripts/token-art.mjs';
test('portrait framing preserves aspect ratio and favors the upper portrait',()=>{
  assert.deepEqual(portraitCrop(600,1000),{x:0,y:60,size:600});
  assert.deepEqual(portraitCrop(1000,600),{x:200,y:0,size:600});
});
test('placed token migration touches only matching actor art and preserves overrides',()=>{
  const scene={tokens:[{id:'old',actorId:'a',texture:{src:'portrait'}},{id:'custom',actorId:'a',texture:{src:'custom'}},{id:'other',actorId:'b',texture:{src:'portrait'}},{id:'done',actorId:'a',texture:{src:'round'}}]};
  assert.deepEqual(tokenArtUpdates(scene,'a',new Set(['portrait','round']),'round'),[{_id:'old','texture.src':'round'}]);
  assert.deepEqual(tokenArtUpdates(scene,'a',new Set(['round']),'round'),[]);
});
