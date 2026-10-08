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
export function tokenArtUpdates(scene,actorId,previous,newSrc){
  return scene.tokens.filter(t=>t.actorId===actorId&&previous.has(t.texture.src)&&t.texture.src!==newSrc)
    .map(t=>({_id:t.id,'texture.src':newSrc}));
}
export async function updatePlacedTokenArt(actor,previous){
  const src=actor.prototypeToken.texture.src;
  for(const scene of game.scenes){const updates=tokenArtUpdates(scene,actor.id,previous,src);if(updates.length)await scene.updateEmbeddedDocuments('Token',updates)}
}
