import {artTexture} from './effect-art.mjs';

export const areaSurfaceAssets={entangle:'area-vines','spike-growth':'area-vines',web:'area-web',darkness:'area-darkness'};
// A single continuous field. The boundary stays fixed while the interior breathes.
export function surfaceVertex(u,v,time,key){
 const dark=key==='darkness',amplitude=dark?.032:key==='web'?.009:.015;
 const envelope=Math.sin(Math.PI*u)*Math.sin(Math.PI*v),speed=dark?.24:.65;
 return [u+amplitude*envelope*Math.sin(v*9+time*speed)*Math.cos(u*5-time*speed*.7),v+amplitude*envelope*Math.sin(u*11-time*speed*.8)*Math.cos(v*6+time*speed*.5)];
}
export function makeAreaSurface(layer,key,bounds){
 if(!areaSurfaceAssets[key])return null;
 let mesh;const columns=25,rows=25;
 return {draw(time,alpha){
  if(!mesh){const texture=artTexture(areaSurfaceAssets[key]);if(!texture)return false;
   mesh=new PIXI.SimplePlane(texture,columns,rows);mesh.name=`shadow-edge-surface:${key}`;layer.addChild(mesh);
   mesh.position.set(bounds.x,bounds.y);mesh.scale.set(bounds.width/texture.width,bounds.height/texture.height);
   if(key==='spike-growth')mesh.tint=0xd9c994;
  }
  const vertices=mesh.geometry.getBuffer('aVertexPosition'),w=mesh.texture.width,h=mesh.texture.height;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const [u,v]=surfaceVertex(x/(columns-1),y/(rows-1),time,key),i=(y*columns+x)*2;vertices.data[i]=u*w;vertices.data[i+1]=v*h}
  vertices.update();mesh.alpha=alpha*(key==='darkness'?.97:key==='web'?.85:.88);return true;
 }};
}
