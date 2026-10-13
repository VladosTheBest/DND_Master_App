// Keep the Actor's original portrait; only the on-map token gets a derived PNG.
export function portraitCrop(width,height){
  const side=Math.min(width,height);
  return {x:(width-side)/2,y:(height-side)*.15,size:side};
}
export async function tokenPortraitBlob(src){
  const image=new Image();image.decoding='async';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Не удалось открыть портрет для токена.'));image.src=src});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),crop=portraitCrop(image.naturalWidth,image.naturalHeight);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.save();ctx.beginPath();ctx.arc(256,256,245,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#20232b';ctx.fillRect(0,0,512,512);
  ctx.drawImage(image,crop.x,crop.y,crop.size,crop.size,11,11,490,490);ctx.restore();
  const rim=ctx.createLinearGradient(0,0,512,512);rim.addColorStop(0,'#e4d3a1');rim.addColorStop(.45,'#84704e');rim.addColorStop(1,'#d2ba7d');
  ctx.beginPath();ctx.arc(256,256,246,0,Math.PI*2);ctx.strokeStyle='#1a1c24';ctx.lineWidth=12;ctx.stroke();
  ctx.beginPath();ctx.arc(256,256,246,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=5;ctx.stroke();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Не удалось создать круглый токен.')),'image/png'));
}
export async function roundTokenAsset(state,src){
  const key=`circle-v1:${src}`,cached=state.tokenAssets?.[key];if(cached)return cached;
  const blob=await tokenPortraitBlob(src),digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  const name=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'.png';
  const root='shadow-edge-gm',campaign=`${root}/${state.campaignId}`,path=`${campaign}/Токены`,Picker=foundry.applications.apps.FilePicker.implementation;
  for(const dir of [root,campaign,path]){try{await Picker.createDirectory('data',dir)}catch{await Picker.browse('data',dir)}}
  const uploaded=await Picker.upload('data',path,new File([blob],name,{type:'image/png'}),{},{notify:false});
  if(!uploaded?.path)throw Error('Foundry не сохранил круглый токен.');
  state.tokenAssets??={};state.tokenAssets[key]=uploaded.path;return uploaded.path;
}
export const placeholderPortraits=['icons/svg/mystery-man.svg','icons/svg/skull.svg','icons/svg/cowled.svg','icons/svg/item-bag.svg'];
export const missingPortrait=src=>!src||placeholderPortraits.includes(String(src).split('?')[0]);
export async function placeholderTokenSources(state,sources){
  const previous=new Set(sources.filter(missingPortrait));
  for(const [key,path] of Object.entries(state.tokenAssets??{}))if(key.startsWith('circle-v1:')&&missingPortrait(key.slice(10)))previous.add(path);
  // Older round placeholders survive in worlds even after browser storage is lost.
  const unknown=sources.filter(src=>!previous.has(src)&&/^shadow-edge-gm\//.test(src)&&/\.png$/.test(src));
  if(unknown.length)for(const src of placeholderPortraits){
    const blob=await tokenPortraitBlob(src),digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const name=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'.png';
    for(const path of unknown)if(path.split('/').at(-1)===name)previous.add(path);
  }
  return previous;
}
export async function syncPortraitToken(state,actor,oldPortrait){
  if(missingPortrait(actor.img))return;
  const image=actor.img,prototype=actor.prototypeToken.texture.src;
  const sources=[prototype,...game.scenes.contents.flatMap(s=>s.tokens.filter(t=>t.actorId===actor.id).map(t=>t.texture.src))];
  const previous=await placeholderTokenSources(state,sources);
  previous.add(image);if(oldPortrait)previous.add(oldPortrait);
  if(!sources.some(src=>previous.has(src)))return;
  const token=await roundTokenAsset(state,image);
  if(actor.img!==image)return;
  if(actor.prototypeToken.texture.src===prototype&&previous.has(prototype))await actor.update({'prototypeToken.texture.src':token});
  for(const scene of game.scenes){const updates=tokenArtUpdates(scene,actor.id,previous,token);if(updates.length)await scene.updateEmbeddedDocuments('Token',updates)}
}
export function tokenArtUpdates(scene,actorId,previous,newSrc){
  return scene.tokens.filter(t=>t.actorId===actorId&&previous.has(t.texture.src)&&t.texture.src!==newSrc)
    .map(t=>({_id:t.id,'texture.src':newSrc}));
}
export async function updatePlacedTokenArt(actor,previous){
  const src=actor.prototypeToken.texture.src;
  for(const scene of game.scenes){const updates=tokenArtUpdates(scene,actor.id,previous,src);if(updates.length)await scene.updateEmbeddedDocuments('Token',updates)}
}
