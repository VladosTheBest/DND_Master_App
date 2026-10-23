import type { CampaignCustomItemsDocument, CampaignCustomItemsPreview } from "@shadow-edge/shared-types";
import { requestJson } from "@shadow-edge/api-client";
import { useEffect, useRef, useState } from "react";
import type { Item } from "./items.types";

export type CustomItemsDocument = CampaignCustomItemsDocument;
export type CustomItemsPreview = CampaignCustomItemsPreview;
const root = (campaign: string) => `${import.meta.env.VITE_API_BASE_URL || ""}/api/campaigns/${encodeURIComponent(campaign)}/custom-items`;
// Only authoring fields cross the boundary, never catalog HTML/cache metadata.
export function customItemPayload(item: Item): Item {
  const {id,name,category,description,subcategory,armorType,rarity,buyPriceGp,sellPriceGp,weightLb,properties,damage,damageType,armorClass,strengthRequirement,stealthDisadvantage,reference} = item;
  return {id,source:"custom",name,category,description,subcategory,armorType,rarity,buyPriceGp,sellPriceGp,weightLb,properties,damage,damageType,armorClass,strengthRequirement,stealthDisadvantage,reference};
}
export const customItemsAPI = {
  list: (campaign:string,signal?:AbortSignal) => requestJson<CustomItemsDocument>(root(campaign),{signal}),
  save: (campaign:string,item:Item,revision?:number) => requestJson<CustomItemsDocument>(`${root(campaign)}${revision===undefined?"":`/${encodeURIComponent(item.id)}`}`,{method:revision===undefined?"POST":"PUT",body:JSON.stringify({item:customItemPayload(item),expectedRevision:revision})}),
  remove: (campaign:string,item:Item) => requestJson<CustomItemsDocument>(`${root(campaign)}/${encodeURIComponent(item.id)}`,{method:"DELETE",body:JSON.stringify({expectedRevision:item.revision})}),
  preview: (campaign:string,items:Item[]) => requestJson<CustomItemsPreview>(`${root(campaign)}/import`,{method:"POST",body:JSON.stringify({items:items.map(customItemPayload)})}),
  import: (campaign:string,items:Item[],revision:number,campaignRevision?:number,referenceChoices?:Record<string,string>) => requestJson<CustomItemsDocument>(`${root(campaign)}/import`,{method:"POST",body:JSON.stringify({items:items.map(customItemPayload),commit:true,expectedRevision:revision,expectedCampaignRevision:campaignRevision,referenceChoices})})
};

export function useCustomItems(campaignId:string) {
  const [document,setDocument]=useState<CustomItemsDocument|null>(null),[error,setError]=useState("");
  const generation=useRef(0);
  const apply=(next:CustomItemsDocument)=>{generation.current++;setDocument(old=>!old||next.revision>=old.revision?next:old);setError("");};
  useEffect(()=>{
    let active=true; const abort=new AbortController();
    const reload=async()=>{
      const expected=++generation.current;
      try {const next=await customItemsAPI.list(campaignId,abort.signal);if(active&&generation.current===expected) {setDocument(old=>!old||next.revision>=old.revision?next:old);setError("");}}
      catch(reason){if(active&&!abort.signal.aborted)setError(reason instanceof Error?reason.message:"Не удалось загрузить предметы.");}
    };
    const refresh=()=>{if(documentVisibility())void reload();};
    void reload();window.addEventListener("focus",refresh);window.addEventListener("online",refresh);
    documentEvent("add",refresh);
    return()=>{active=false;abort.abort();window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);documentEvent("remove",refresh);};
  },[campaignId]);
  const items: Item[] = document?.items ?? [];
  return {document,error,apply,items};
}
const documentVisibility=()=>document.visibilityState!=="hidden";
const documentEvent=(action:"add"|"remove",listener:()=>void)=>{if(action==="add")document.addEventListener("visibilitychange",listener);else document.removeEventListener("visibilitychange",listener);};
