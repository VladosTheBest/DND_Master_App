import {useLayoutEffect,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {AppModal} from "./AppModal";

export function InlineEditorSurface({targetId,label,onClose,children}:{targetId?:string;label:string;onClose:()=>void;children:ReactNode}){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{const host=targetId?document.getElementById(targetId):null;setTarget(host);},[targetId]);
 useLayoutEffect(()=>{if(!target)return;const field=target.querySelector<HTMLElement>('input:not([disabled]),[contenteditable="true"],textarea,button');target.scrollIntoView({block:"nearest",behavior:"instant"});field?.focus({preventScroll:true});},[target]);
 if(targetId)return target?createPortal(<section className="inline-player-card" aria-label={label}>{children}</section>,target):null;
 return <AppModal label={label} onClose={onClose}>{children}</AppModal>;
}
