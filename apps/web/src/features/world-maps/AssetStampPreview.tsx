import {useEffect,useRef} from 'react';
import {paintAsset} from './creative-assets';
import {preparePaintedAssets} from './creative-painted-assets';

// The cursor uses the same painter and dimensions as the placed object, not a square catalogue thumbnail.
export function AssetStampPreview({asset,width,height}:{asset:string;width:number;height:number}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let active=true;const c=canvas.current!;const padding=Math.max(width,height)*.1;
  const scale=Math.min(2,2048/(Math.max(width,height)+padding*2));
  c.width=Math.ceil((width+padding*2)*scale);c.height=Math.ceil((height+padding*2)*scale);
  void preparePaintedAssets([asset]).then(()=>{if(!active)return;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);ctx.translate(c.width/2,c.height/2);ctx.scale(scale,scale);paintAsset(ctx,asset,width,height);}).catch(()=>{});
  return()=>{active=false;};
 },[asset,width,height]);
 const padding=Math.max(width,height)*.1;
 return <canvas ref={canvas} style={{position:'absolute',maxWidth:'none',width:`${(width+2*padding)/width*100}%`,height:`${(height+2*padding)/height*100}%`,left:`${-padding/width*100}%`,top:`${-padding/height*100}%`}}/>;
}
