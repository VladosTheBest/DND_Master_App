import type { WorldMapLabel } from "@shadow-edge/shared-types";

export const labelRoleSizes = {major:28, region:20, settlement:15, site:12};
export function labelGeometry(label:WorldMapLabel) {
  const span=label.span||240, bend=(label.curve||0)/100*span;
  const path=`M ${-span/2} ${bend/2} Q 0 ${-bend/2} ${span/2} ${bend/2}`;
  let length=0, previous={x:-span/2,y:bend/2};
  for(let i=1;i<=40;i++){
    const t=i/40, point={x:span*(t-.5),y:2*bend*(t-.5)**2};
    length+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;
  }
  return {path,length};
}
export function labelTextSize(label:WorldMapLabel) {
  if(!label.curve)return label.size;
  const ctx=document.createElement("canvas").getContext("2d");
  if(!ctx)return label.size;
  ctx.font=`${label.italic?"italic ":""}${label.bold?"bold ":""}${label.size}px "${label.font==="serif"?"Georgia":label.font==="monospace"?"Courier New":"Arial"}"`;
  return Math.min(label.size,label.size*labelGeometry(label).length*.94/Math.max(1,ctx.measureText(label.text).width));
}
