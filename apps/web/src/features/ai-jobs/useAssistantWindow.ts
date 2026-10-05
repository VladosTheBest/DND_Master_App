import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

type Box = {left:number;top:number;width:number;height:number};
export type ResizeEdge = "n"|"s"|"e"|"w"|"ne"|"nw"|"se"|"sw";
function resized(box:Box,edge:ResizeEdge,dx:number,dy:number):Box {
  const right=box.left+box.width,bottom=box.top+box.height;
  let {left,top,width,height}=box;
  const minWidth=Math.min(380,window.innerWidth-16),minHeight=Math.min(420,window.innerHeight-16);
  if(edge.includes("w")){left=Math.max(8,Math.min(right-minWidth,left+dx));width=right-left;}
  if(edge.includes("n")){top=Math.max(8,Math.min(bottom-minHeight,top+dy));height=bottom-top;}
  if(edge.includes("e"))width=Math.max(minWidth,Math.min(window.innerWidth-left-8,width+dx));
  if(edge.includes("s"))height=Math.max(minHeight,Math.min(window.innerHeight-top-8,height+dy));
  return {left,top,width,height};
}
function clamp(box:Box):Box {
  const width=Math.min(Math.max(340,box.width),window.innerWidth-16);
  const height=Math.min(Math.max(420,box.height),window.innerHeight-16);
  return {width,height,left:Math.max(8,Math.min(box.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(box.top,window.innerHeight-height-8))};
}
export function useAssistantWindow() {
  const [box,setBox]=useState(()=>clamp({left:(window.innerWidth-1180)/2,top:24,width:1180,height:880}));
  const gesture=useRef<{x:number;y:number;box:Box;resize:ResizeEdge|false}|null>(null);
  useEffect(()=>{const fit=()=>setBox(current=>clamp(current));window.addEventListener("resize",fit);return()=>window.removeEventListener("resize",fit);},[]);
  function start(event:PointerEvent<HTMLElement>,resize:ResizeEdge|false=false) {
    if(event.button!==0 || (!resize && (event.target as HTMLElement).closest("button, a, input, select")))return;
    gesture.current={x:event.clientX,y:event.clientY,box,resize};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function move(event:PointerEvent<HTMLElement>) {
    const g=gesture.current;if(!g)return;
    const dx=event.clientX-g.x,dy=event.clientY-g.y;
    setBox(g.resize?resized(g.box,g.resize,dx,dy):clamp({...g.box,left:g.box.left+dx,top:g.box.top+dy}));
  }
  function end(){gesture.current=null;}
  function key(event:KeyboardEvent<HTMLElement>,resize:ResizeEdge|false=false){
    if(event.target!==event.currentTarget)return;
    const delta:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if(!delta[event.key])return;event.preventDefault();
    const [x,y]=delta[event.key];setBox(current=>resize?resized(current,resize,x,y):clamp({...current,left:current.left+x,top:current.top+y}));
  }
  return {box,start,move,end,key};
}
