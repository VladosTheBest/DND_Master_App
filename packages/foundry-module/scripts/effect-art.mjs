// Original generated textures. GPU frames share their base texture; scene cleanup never destroys the cache.
const cache=new Map(),frames=new Map();
const magicRects={flame:[0,0,627,627],crystal:[627,0,627,627],rune:[0,627,627,627],sun:[627,627,627,627]};
const rects={sword:[10,232,675,217],axe:[725,198,525,360],hammer:[9,773,669,298],dagger:[734,847,506,152]};
const creatureRects={mace:[0,225,627,210],spear:[630,260,624,145],tentacle:[0,665,627,440],tail:[627,655,627,410]};
export function artTexture(name){
 if(!globalThis.PIXI)return null;
 let frame=rects[name]??magicRects[name]??creatureRects[name];const jaw=name==='jaw-top'||name==='jaw-bottom',asset=jaw?'bite':rects[name]?'weapons':magicRects[name]?'magic':creatureRects[name]?'creature-weapons':name;
 let texture=cache.get(asset);if(!texture){texture=PIXI.Texture.from(`modules/shadow-edge-gm/assets/${asset}.png`);cache.set(asset,texture)}
 if(!texture.baseTexture.valid)return null;
 if(jaw)frame=[0,name==='jaw-top'?0:Math.floor(texture.height/2),texture.width,Math.floor(texture.height/2)];
 if(!frame)return texture;
 if(!frames.has(name))frames.set(name,new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(...frame)));
 return frames.get(name);
}
export function makeArtSprites(layer){
 const sprites=[];let cursor=0;
 return {reset(){cursor=0;for(const sprite of sprites)sprite.visible=false},draw(name,x,y,width,rotation=0,alpha=1,anchor=.5){
  const texture=artTexture(name);if(!texture)return null;
  let sprite=sprites[cursor++];if(!sprite){sprite=new PIXI.Sprite(texture);layer.addChild(sprite);sprites.push(sprite)}
  sprite.texture=texture;sprite.anchor.set(anchor,.5);sprite.position.set(x,y);sprite.width=width;sprite.height=width*texture.height/texture.width;sprite.rotation=rotation;sprite.alpha=Math.max(0,Math.min(1,alpha));sprite.visible=alpha>0;return sprite;
 }};
}
