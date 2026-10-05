import type { WorldMapDocument, WorldMapLabel } from "@shadow-edge/shared-types";
import { labelGeometry, labelTextSize } from "./map-label-geometry";

type Box={left:number;top:number;right:number;bottom:number};
const overlap=(a:Box,b:Box)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const caps={major:28,region:20,settlement:15,site:12};
let measurementID=0;

// Measure the same SVG text/path as the editor, including rotation and a halo gutter.
export function arrangeMapLabels(map:WorldMapDocument){
  const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
  svg.style.cssText="position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  svg.setAttribute("width","1000");svg.setAttribute("height",String(1000*map.height/map.width));
  const defs=document.createElementNS(ns,"defs"),path=document.createElementNS(ns,"path"),text=document.createElementNS(ns,"text");
  path.id=`map-layout-${++measurementID}`;defs.append(path);svg.append(defs,text);document.body.append(svg);
  const height=1000*map.height/map.width,margin=18,placed:Box[]=[],labels=map.labels.map(l=>({...l}));
  let unresolved=0;
  function bounds(l:WorldMapLabel):Box{
    path.setAttribute("d",labelGeometry(l).path);
    const attrs={"font-family":l.font==="serif"?"Georgia":l.font==="monospace"?"Courier New":"Arial","font-size":String(labelTextSize(l)),"font-weight":l.bold?"700":"400","font-style":l.italic?"italic":"normal","text-anchor":"middle","dominant-baseline":"central","letter-spacing":"0"};
    Object.entries(attrs).forEach(([key,value])=>text.setAttribute(key,value));text.replaceChildren();
    if(l.curve){const tp=document.createElementNS(ns,"textPath");tp.setAttribute("href",`#${path.id}`);tp.setAttribute("startOffset","50%");tp.textContent=l.text;text.append(tp);}else text.textContent=l.text;
    const b=text.getBBox(),r=l.rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>({x:x*c-y*s+l.x*1000,y:x*s+y*c+l.y*height}));
    return {left:Math.min(...points.map(p=>p.x))-5,right:Math.max(...points.map(p=>p.x))+5,top:Math.min(...points.map(p=>p.y))-5,bottom:Math.max(...points.map(p=>p.y))+5};
  }
  const fits=(b:Box)=>b.left>=margin&&b.top>=margin&&b.right<=1000-margin&&b.bottom<=height-margin&&!placed.some(p=>overlap(p,b));
  try{
    // Town anchors take priority over decorative geographic lettering.
    const priority={site:0,settlement:1,region:2,major:3};
    const order=labels.map((_,i)=>i).sort((a,b)=>(priority[labels[a].role||"region"]-priority[labels[b].role||"region"])||a-b);
    for(const index of order){
      const original=labels[index],role=original.role||"region",cap=caps[role];
      const base={...original,size:Math.min(original.size,cap),rotation:Math.max(-35,Math.min(35,original.rotation)),curve:Math.max(-25,Math.min(25,original.curve||0))};
      const radius=role==="settlement"||role==="site"?24:65;
      let chosen:WorldMapLabel|undefined;
      for(const style of [base,{...base,rotation:0,curve:0}]){
      for(let size=style.size;size>=8&&!chosen;size=Math.max(7,size-2)){
        const anchor=bounds({...style,size});
        const insetX=(anchor.left<margin?margin-anchor.left:0)+(anchor.right>1000-margin?1000-margin-anchor.right:0);
        const insetY=(anchor.top<margin?margin-anchor.top:0)+(anchor.bottom>height-margin?height-margin-anchor.bottom:0);
        for(let distance=0;distance<=radius&&!chosen;distance+=8){
          const steps=distance?16:1;
          for(let i=0;i<steps;i++){
            const angle=2*Math.PI*i/steps,l={...style,size,x:original.x+(insetX+Math.cos(angle)*distance)/1000,y:original.y+(insetY+Math.sin(angle)*distance)/height};
            const dx=(l.x-original.x)*1000,dy=(l.y-original.y)*height;
            if(fits({left:anchor.left+dx,right:anchor.right+dx,top:anchor.top+dy,bottom:anchor.bottom+dy})){chosen=l;break;}
          }
        }
      }
      }
      if(!chosen){
        // Never silently delete labels or move them across the map to a wrong feature.
        chosen={...base,size:8};const b=bounds(chosen);
        chosen.x+=((b.left<margin?margin-b.left:0)+(b.right>1000-margin?1000-margin-b.right:0))/1000;
        chosen.y+=((b.top<margin?margin-b.top:0)+(b.bottom>height-margin?height-margin-b.bottom:0))/height;
        chosen.x=Math.max(0,Math.min(1,chosen.x));chosen.y=Math.max(0,Math.min(1,chosen.y));
        unresolved++;
      }
      labels[index]=chosen;placed.push(bounds(chosen));
    }
    return {map:{...map,labels},unresolved,boxes:placed};
  }finally{svg.remove();}
}
