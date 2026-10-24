import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../app/api";
import type { ItemCatalogBrowseResult } from "@shadow-edge/shared-types";
import type { Item } from "./items.types";
import { applyCatalogDetailToItem, catalogSummaryToItem, isRemoteItem, loadCachedRemoteItemDetails, mergeCatalogItemWithCachedDetail, rememberRemoteItemDetail } from "./items.utils";
type Filters=NonNullable<Parameters<typeof api.browseItemCatalog>[0]>;
const cacheVersion=2;
const catalogs=new Map<string,{time:number;result:ItemCatalogBrowseResult}>();
const pending=new Map<string,Promise<ItemCatalogBrowseResult>>();
const details=new Map<string,Item>();
function browse(key:string,filters:Filters){
 const saved=catalogs.get(key);if(saved&&Date.now()-saved.time<300000)return Promise.resolve(saved.result);
 let request=pending.get(key);if(!request){request=api.browseItemCatalog(filters).then(result=>{if(catalogs.size>100)catalogs.clear();catalogs.set(key,{time:Date.now(),result});return result;}).finally(()=>pending.delete(key));pending.set(key,request);}return request;
}
export function useItemsCatalogController({filters={},enabled=true}:{campaignId:string;filters?:Filters;enabled?:boolean}) {
 const key=JSON.stringify([cacheVersion,filters.q||"",filters.source||"",filters.category||"",filters.armorType||"",filters.sort||"",filters.price||"",filters.rarity||""]);
 const currentKey=useRef(key);currentKey.current=key;
 const [catalogDetails,setCatalogDetails]=useState<Record<string,Item>>({});
 const [nextCursor,setNextCursor]=useState(""),[catalogTotal,setCatalogTotal]=useState(0);
 const [catalogItems,setCatalogItems]=useState<Item[]>([]),[catalogLoading,setCatalogLoading]=useState(false),[catalogError,setCatalogError]=useState("");
 const [loadingCatalogItemIds,setLoadingCatalogItemIds]=useState<string[]>([]),[detailErrors,setDetailErrors]=useState<Record<string,string>>({}),[retry,setRetry]=useState(0);
 const items=useRef(catalogItems),loading=useRef(new Set<string>()),alive=useRef(true);items.current=catalogItems;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let active=true;setCatalogError("");setCatalogItems([]);setNextCursor("");setCatalogTotal(0);
  if(!enabled){setCatalogLoading(false);return;}
  setCatalogLoading(true);
  const timer=setTimeout(()=>{void browse(key,{...filters,limit:48}).then(result=>{if(!active)return;setNextCursor(result.nextCursor||"");setCatalogTotal(result.total);const cached=loadCachedRemoteItemDetails();setCatalogItems(result.items.map(summary=>{const item=catalogSummaryToItem(summary),detail=details.get(summary.id)||cached[summary.id]?.item;return detail?mergeCatalogItemWithCachedDetail(item,detail):item;}));}).catch(reason=>{if(active)setCatalogError(reason instanceof Error?reason.message:"Не удалось загрузить каталог.");}).finally(()=>{if(active)setCatalogLoading(false);});},filters.q?250:0);
  return()=>{active=false;clearTimeout(timer);};
 },[key,enabled,retry]);
 const ensureCatalogItemDetail=useCallback((id:string)=>{
  const target=items.current.find(item=>item.id===id);if(target&&(!isRemoteItem(target)||target.detailLoaded)||loading.current.has(id))return;
  loading.current.add(id);setLoadingCatalogItemIds([...loading.current]);setDetailErrors(old=>({...old,[id]:""}));
  void api.getCatalogItem(id).then(detail=>{const next=applyCatalogDetailToItem(target||catalogSummaryToItem(detail.summary),detail);details.set(id,next);rememberRemoteItemDetail(next);if(alive.current){setCatalogDetails(old=>({...old,[id]:next}));setCatalogItems(old=>old.some(item=>item.id===id)?old.map(item=>item.id===id?next:item):old);}}).catch(reason=>{if(alive.current)setDetailErrors(old=>({...old,[id]:reason instanceof Error?reason.message:"Не удалось загрузить описание."}));}).finally(()=>{loading.current.delete(id);if(alive.current)setLoadingCatalogItemIds([...loading.current]);});
 },[]);
 const loadMore=async()=>{if(catalogLoading||!nextCursor)return;setCatalogLoading(true);setCatalogError("");const sourceKey=key;try{const result=await browse(key+nextCursor,{...filters,limit:48,cursor:nextCursor});if(!alive.current||currentKey.current!==sourceKey)return;setCatalogItems(old=>{const ids=new Set(old.map(item=>item.id));return [...old,...result.items.filter(item=>!ids.has(item.id)).map(summary=>details.get(summary.id)||catalogSummaryToItem(summary))];});setNextCursor(result.nextCursor||"");setCatalogTotal(result.total);}catch(reason){if(currentKey.current===sourceKey)setCatalogError(reason instanceof Error?reason.message:"Не удалось загрузить следующую страницу.");}finally{if(currentKey.current===sourceKey)setCatalogLoading(false);}};
 return {catalogDetails,hasMore:!!nextCursor,loadMore,catalogTotal,catalogItems,catalogLoading,catalogError,loadingCatalogItemIds,detailErrors,ensureCatalogItemDetail,retryCatalog:()=>{catalogs.delete(key);setRetry(value=>value+1);}};
}
