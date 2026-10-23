import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { confirmAction } from "./confirm-action";

export const workspaceSections = ["dashboard","offline","combat","locations","players","npcs","monsters","quests","notes","events","shops","items","sessions","rules","maps","chat"] as const;
export type WorkspaceSection = typeof workspaceSections[number];
export type WorkspaceRoute = {campaignId:string;section:WorkspaceSection;target:string;tab:string;query:string;view:string;filters?:string;context?:string;proposal?:string};
export function readWorkspaceRoute(href=location.href):WorkspaceRoute {
  const url=new URL(href,"https://workspace.invalid"), p=url.searchParams;
  const parts=url.pathname.split("/").filter(Boolean);
  let campaignId=p.get("campaign")||"",section=p.get("section")||"dashboard",target=p.get("entity")||"";
  if(parts[0]==="campaigns") {try{campaignId=decodeURIComponent(parts[1]||"");target=decodeURIComponent(parts[3]||"");}catch{campaignId="";target="";}section=parts[2]||"dashboard";}
  if(url.pathname==="/maps") {section="maps";target=p.get("map")||"";}
  if(url.pathname==="/chat")section="chat";
  if(p.get("session")){section="sessions";target=p.get("session")||"";}
  return {campaignId,section:workspaceSections.includes(section as WorkspaceSection)?section as WorkspaceSection:"dashboard",target,tab:p.get("tab")||"",query:p.get("q")||"",view:p.get("view")||"",filters:p.get("filters")||undefined,context:p.get("context")||undefined,proposal:p.get("proposal")||undefined};
}
export function workspaceURL(route:Partial<WorkspaceRoute>&Pick<WorkspaceRoute,"campaignId"|"section">):string {
  const p=new URLSearchParams();let path:string;
  if(route.section==="maps"||route.section==="chat") {path=`/${route.section}`;if(route.campaignId)p.set("campaign",route.campaignId);if(route.target&&route.section==="maps")p.set("map",route.target);}
  else path=route.campaignId?`/campaigns/${encodeURIComponent(route.campaignId)}/${route.section}${route.target?`/${encodeURIComponent(route.target)}`:""}`:"/";
  if(route.tab)p.set("tab",route.tab);if(route.query)p.set("q",route.query);if(route.view)p.set("view",route.view);if(route.filters)p.set("filters",route.filters);if(route.context)p.set("context",route.context);if(route.proposal)p.set("proposal",route.proposal);
  return path+(p.size?`?${p}`:"");
}
export function workspaceFilters(raw?:string):Record<string,string|number|boolean>{
  try{if(!raw||raw.length>6000)return {};const value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).filter(([key,entry])=>key.length<80&&["string","number","boolean"].includes(typeof entry))) as Record<string,string|number|boolean>;}catch{return {};}
}
/** List preferences belong to the address; drafts and server authoring never enter it. */
export function useWorkspaceListState<T extends string|number|boolean|null>(key:string,initial:T):[T,Dispatch<SetStateAction<T>>] {
  const route=useWorkspaceRoute(),baseline=useRef(initial);
  const read=()=>{const value=key==="q"?route.query:workspaceFilters(route.filters)[key];return typeof value===typeof baseline.current?value as T:baseline.current;};
  const [value,setValue]=useState<T>(read),latest=useRef(value);latest.current=value;
  useEffect(()=>{setValue(read());},[route.query,route.filters,key]);
  const update:Dispatch<SetStateAction<T>>=next=>{
    const resolved=typeof next==="function"?next(latest.current):next;latest.current=resolved;setValue(resolved);
    const current=readWorkspaceRoute();if(current.campaignId!==route.campaignId||current.section!==route.section)return;if(key==="q")current.query=String(resolved);else {const filters=workspaceFilters(current.filters);if(resolved===baseline.current||resolved===null)delete filters[key];else filters[key]=resolved;current.filters=Object.keys(filters).length?JSON.stringify(filters):undefined;}
    navigateWorkspace(workspaceURL(current),true);
  };
  return [value,update];
}
const guards=new Map<object,string>();
export async function allowWorkspaceNavigation(){return !guards.size||await confirmAction([...guards.values()][0]);}
export function useWorkspaceGuard(dirty:boolean,message="Есть несохранённые изменения. Перейти? Локальная копия останется доступна для восстановления.") {
  useEffect(()=>{if(!dirty)return;const key={};guards.set(key,message);return()=>{guards.delete(key);};},[dirty,message]);
}
const eventName="workspace-navigation";
let committedIndex=0;
const scroll=()=>({window:window.scrollY,content:document.querySelector(".content")?.scrollTop||0});
function saveScroll(){history.replaceState({...history.state,workspaceScroll:scroll()},"");}
export function navigateWorkspace(href:string,replace=false){
  const url=new URL(href,location.origin);if(url.origin!==location.origin)return;
  if(url.href===location.href)return;
  saveScroll();committedIndex=Number(history.state?.workspaceIndex||0)+(replace?0:1);
  history[replace?"replaceState":"pushState"]({...history.state,workspaceIndex:committedIndex,workspaceScroll:replace?history.state?.workspaceScroll:{window:0,content:0}},"",url);
  window.dispatchEvent(new Event(eventName));
}
export function restoreWorkspaceScroll(){const saved=history.state?.workspaceScroll||{window:0,content:0};requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo({top:saved.window,behavior:"instant"});document.querySelector(".content")?.scrollTo({top:saved.content,behavior:"instant"});}));}
export function useWorkspaceRoute(){
  const [route,setRoute]=useState(readWorkspaceRoute);
  useEffect(()=>{const update=()=>setRoute(readWorkspaceRoute());window.addEventListener("popstate",update);window.addEventListener(eventName,update);window.addEventListener("pagehide",saveScroll);return()=>{window.removeEventListener("popstate",update);window.removeEventListener(eventName,update);window.removeEventListener("pagehide",saveScroll);};},[]);
  return route;
}
export function installWorkspaceLinks(){
  committedIndex=Number(history.state?.workspaceIndex||0);
  history.replaceState({...history.state,workspaceIndex:committedIndex},"");
  history.scrollRestoration="manual";
  let pendingIndex:number|null=null,allowedIndex:number|null=null;
  const pop=(event:PopStateEvent)=>{
    const next=event.state?.workspaceIndex;
    if(typeof next!=="number")return;
    if(allowedIndex===next){committedIndex=next;allowedIndex=null;return;}
    if(pendingIndex!==null){
      event.stopImmediatePropagation();
      if(next===committedIndex){const destination=pendingIndex;pendingIndex=null;void allowWorkspaceNavigation().then(accepted=>{if(accepted){allowedIndex=destination;history.go(destination-committedIndex);}});}
      return;
    }
    if(guards.size&&next!==committedIndex){event.stopImmediatePropagation();pendingIndex=next;history.go(committedIndex-next);return;}
    committedIndex=next;
  };
  window.addEventListener("popstate",pop);
  const click=async(event:MouseEvent)=>{const link=(event.target as Element)?.closest?.("a");if(!link||event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target||link.hasAttribute("download"))return;
    const url=new URL(link.href,location.origin);if(url.origin!==location.origin||url.hash||!(/^\/(?:campaigns\/[^/]+(?:\/.*)?|maps|chat)?$/.test(url.pathname)))return;
    event.preventDefault();if(await allowWorkspaceNavigation())navigateWorkspace(url.href);
  };
  document.addEventListener("click",click);return()=>{document.removeEventListener("click",click);window.removeEventListener("popstate",pop);};
}
