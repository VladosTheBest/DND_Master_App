import {useCallback,useEffect,useMemo,useSyncExternalStore} from "react";
import type {AIJob} from "@shadow-edge/shared-types";
import {api} from "../../app/api";
import {observeAIJobs,prepareAISound} from "./ai-completion-sound";
export const isActiveJob=(job:AIJob)=>job.state==="queued"||job.state==="running";
export function useAIJobs(campaignId?:string){
 const snapshot=useSyncExternalStore(api.subscribeAIJobs,api.getAIJobsSnapshot);
 const jobs=useMemo(()=>campaignId?snapshot.jobs.filter(job=>job.campaignId===campaignId):snapshot.jobs,[snapshot.jobs,campaignId]);
 useEffect(()=>{prepareAISound();observeAIJobs(snapshot.jobs);},[snapshot.jobs]);
 const refresh=useCallback(async()=>{try{return await api.refreshAIJobs();}catch{return [];}},[]);
 return {jobs,error:snapshot.error,loading:snapshot.loading,refresh};
}
