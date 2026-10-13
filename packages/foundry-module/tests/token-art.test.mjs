import test from 'node:test';
import assert from 'node:assert/strict';
import {portraitCrop,tokenArtUpdates,syncPortraitToken} from '../scripts/token-art.mjs';
test('portrait framing preserves aspect ratio and favors the upper portrait',()=>{
  assert.deepEqual(portraitCrop(600,1000),{x:0,y:60,size:600});
  assert.deepEqual(portraitCrop(1000,600),{x:200,y:0,size:600});
});

test('AI portrait repairs cached round skulls across scenes while preserving custom art',async()=>{
 const previous=globalThis.game,updates=[];
 const scene={tokens:[{id:'old',actorId:'a',texture:{src:'round-skull.png'}},{id:'raw',actorId:'a',texture:{src:'icons/svg/skull.svg'}},{id:'custom',actorId:'a',texture:{src:'custom.webp'}},{id:'other',actorId:'b',texture:{src:'round-skull.png'}}],updateEmbeddedDocuments:async(_type,rows)=>updates.push(...rows)};
 const scenes=[scene];scenes.contents=scenes;globalThis.game={scenes};
 const state={tokenAssets:{'circle-v1:icons/svg/skull.svg':'round-skull.png','circle-v1:dragon.webp':'round-dragon.png'}};
 const actor={id:'a',img:'dragon.webp',prototypeToken:{texture:{src:'round-skull.png'}},update:async data=>{actor.prototypeToken.texture.src=data['prototypeToken.texture.src']}};
 try{await syncPortraitToken(state,actor);assert.equal(actor.prototypeToken.texture.src,'round-dragon.png');assert.deepEqual(updates,[{_id:'old','texture.src':'round-dragon.png'},{_id:'raw','texture.src':'round-dragon.png'}]);actor.prototypeToken.texture.src='custom.webp';updates.length=0;await syncPortraitToken(state,actor);assert.equal(actor.prototypeToken.texture.src,'custom.webp');assert.equal(updates.length,2)}finally{globalThis.game=previous}
});
test('placed token migration touches only matching actor art and preserves overrides',()=>{
  const scene={tokens:[{id:'old',actorId:'a',texture:{src:'portrait'}},{id:'custom',actorId:'a',texture:{src:'custom'}},{id:'other',actorId:'b',texture:{src:'portrait'}},{id:'done',actorId:'a',texture:{src:'round'}}]};
  assert.deepEqual(tokenArtUpdates(scene,'a',new Set(['portrait','round']),'round'),[{_id:'old','texture.src':'round'}]);
  assert.deepEqual(tokenArtUpdates(scene,'a',new Set(['round']),'round'),[]);
});
