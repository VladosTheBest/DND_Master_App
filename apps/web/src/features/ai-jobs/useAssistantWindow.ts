import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

type Box = {left:number;top:number;width:number;height:number};
function clamp(box:Box):Box {
  const width=Math.min(Math.max(340,box.width),window.innerWidth-16);
  const height=Math.min(Math.max(420,box.height),window.innerHeight-16);
  return {width,height,left:Math.max(8,Math.min(box.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(box.top,window.innerHeight-height-8))};
}
export function useAssistantWindow() {
  const [box,setBox]=useState(()=>clamp({left:window.innerWidth-780,top:40,width:760,height:760}));
  const gesture=useRef<{x:number;y:number;box:Box;resize:boolean}|null>(null);
  useEffect(()=>{const fit=()=>setBox(current=>clamp(current));window.addEventListener("resize",fit);return()=>window.removeEventListener("resize",fit);},[]);
  function start(event:PointerEvent<HTMLElement>,resize=false) {
    if(event.button!==0 || (!resize && (event.target as HTMLElement).closest("button")))return;
    gesture.current={x:event.clientX,y:event.clientY,box,resize};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function move(event:PointerEvent<HTMLElement>) {
    const g=gesture.current;if(!g)return;
    const dx=event.clientX-g.x,dy=event.clientY-g.y;
    setBox(clamp(g.resize?{...g.box,width:g.box.width+dx,height:g.box.height+dy}:{...g.box,left:g.box.left+dx,top:g.box.top+dy}));
  }
  function end(){gesture.current=null;}
  function key(event:KeyboardEvent<HTMLElement>,resize=false){
    if(event.target!==event.currentTarget)return;
    const delta:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if(!delta[event.key])return;event.preventDefault();
    const [x,y]=delta[event.key];setBox(current=>clamp(resize?{...current,width:current.width+x,height:current.height+y}:{...current,left:current.left+x,top:current.top+y}));
  }
  return {box,start,move,end,key};
}
