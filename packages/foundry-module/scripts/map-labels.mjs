import {MODULE,clone,mergeThree,equal} from "./core.mjs";
const fonts={serif:"Georgia","sans-serif":"Arial",monospace:"Courier New"};
export function labelDrawing(label,width,height){
  const fontSize=label.size*width/1000;
  let textWidth=Array.from(label.text).length*fontSize*.65;
  if(typeof document!=="undefined"&&document.createElement("canvas").getContext){const ctx=document.createElement("canvas").getContext("2d");if(ctx){ctx.font=`${fontSize}px ${fonts[label.font]??"Georgia"}`;textWidth=ctx.measureText(label.text).width}}
  const w=Math.max(fontSize,textWidth+fontSize*.4),h=fontSize*1.5;
  return {x:label.x*width-w/2,y:label.y*height-h/2,shape:{type:"r",width:w,height:h},text:label.text,fontFamily:fonts[label.font]??"Georgia",fontSize,textColor:label.color,textAlpha:1,strokeAlpha:0,fillType:0,rotation:label.rotation,flags:{[MODULE]:{labelId:label.id,label:clone(label)}}};
}
export function drawingLabel(d,width,height){
  const metadata=d.flags?.[MODULE]?.label??{};
  return {...metadata,id:d.flags?.[MODULE]?.labelId??`fvtt-${d.id??d._id}`,text:d.text,x:(d.x+d.shape.width/2)/width,y:(d.y+d.shape.height/2)/height,size:d.fontSize*1000/width,rotation:((d.rotation+180)%360+360)%360-180,font:Object.entries(fonts).find(([,font])=>font===d.fontFamily)?.[0]??metadata.font??"serif",color:d.textColor,outline:metadata.outline??"#000000",bold:metadata.bold??false,italic:metadata.italic??false};
}
export function mapLabels(scene){return Array.from(scene.drawings??[]).filter(d=>d.text&&!d.flags?.[MODULE]?.archivedLabel).map(d=>drawingLabel(d,scene.width,scene.height))}
export function mapAuthoring(scene){return {name:scene.name,imageUrl:scene.background?.src??"",width:scene.width,height:scene.height,labels:mapLabels(scene)}}
const projection=d=>({...Object.fromEntries(["x","y","text","fontFamily","fontSize","textColor","rotation"].map(k=>[k,clone(d[k])])),shape:{type:d.shape.type,width:d.shape.width,height:d.shape.height}});
export async function importMapLabels(scene,labels,entry,confirm){
  const baselines=entry.labelBaselines??{},next={};
  for(const label of labels??[]){
    const desired=labelDrawing(label,scene.width,scene.height);let drawing=scene.drawings.find(d=>d.flags?.[MODULE]?.labelId===label.id);
    if(drawing){const remote=projection(desired),local=projection(drawing),base=baselines[label.id]??local;const merged=mergeThree(base,local,remote);if(merged.conflicts.length&&await confirm(drawing.text,merged.conflicts))merged.value=remote;await drawing.update({...merged.value,[`flags.${MODULE}.label`]:label,[`flags.${MODULE}.archivedLabel`]:false});next[label.id]=remote}
    else{[drawing]=await scene.createEmbeddedDocuments("Drawing",[desired]);next[label.id]=projection(drawing)}
  }
  for(const drawing of Array.from(scene.drawings)){const id=drawing.flags?.[MODULE]?.labelId;if(!id||next[id])continue;if(baselines[id]&&equal(projection(drawing),baselines[id])||await confirm(drawing.text,["Удалена на сайте; удалить местную подпись"]))await drawing.delete();else next[id]=baselines[id]??projection(drawing)}
  entry.labelBaselines=next;
}
