import type { AIJob } from "@shadow-edge/shared-types";
export type JobsSnapshot={jobs:AIJob[];loading:boolean;error:string};
const active=(job:AIJob)=>job.state==="queued"||job.state==="running";
/** One feed per HTTP client/account. Subscribers filter locally; waiting never cancels server work. */
export class AIJobsFeed {
 private listeners=new Set<()=>void>(); private timer:ReturnType<typeof setTimeout>|undefined;
 private flight:Promise<AIJob[]>|undefined; private version=0;private failures=0;
 private snapshot:JobsSnapshot={jobs:[],loading:true,error:""};
 constructor(private fetchJobs:()=>Promise<AIJob[]>,private hidden=()=>typeof document!=="undefined"&&document.hidden){}
 getSnapshot=()=>this.snapshot;
 private emit(){for(const listener of this.listeners)listener();}
 private schedule(){clearTimeout(this.timer);if(!this.listeners.size)return;const delay=this.failures?Math.min(60000,2500*2**this.failures):this.hidden()?60000:this.snapshot.jobs.some(active)?2500:30000;this.timer=setTimeout(()=>void this.refresh().catch(()=>{}),delay);}
 private wake=()=>{if(!this.hidden())void this.refresh().catch(()=>{});else this.schedule();};
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);if(this.listeners.size===1){if(typeof window!=="undefined"){window.addEventListener("focus",this.wake);window.addEventListener("online",this.wake);document.addEventListener("visibilitychange",this.wake);}void this.refresh().catch(()=>{});}return()=>{this.listeners.delete(listener);if(!this.listeners.size){clearTimeout(this.timer);if(typeof window!=="undefined"){window.removeEventListener("focus",this.wake);window.removeEventListener("online",this.wake);document.removeEventListener("visibilitychange",this.wake);}}};};
 refresh=():Promise<AIJob[]>=>{if(this.flight)return this.flight;clearTimeout(this.timer);const version=this.version;
  const flight=this.fetchJobs().then(jobs=>{if(version!==this.version)return [];this.failures=0;this.snapshot={jobs,loading:false,error:""};this.emit();return jobs;}).catch(error=>{if(version===this.version){this.failures++;this.snapshot={...this.snapshot,loading:false,error:"Не удалось обновить статус. Работа на сервере может продолжаться."};this.emit();}throw error;}).finally(()=>{if(this.flight===flight){this.flight=undefined;this.schedule();}});this.flight=flight;return flight;
 };
 reset(){this.version++;this.flight=undefined;clearTimeout(this.timer);this.snapshot={jobs:[],loading:true,error:""};this.failures=0;this.emit();}
 async wait(id:string,signal?:AbortSignal):Promise<AIJob>{
  if(signal?.aborted)throw new DOMException("Waiting aborted","AbortError");
  return new Promise((resolve,reject)=>{let off:()=>void=()=>{};const finish=(error?:unknown,job?:AIJob)=>{off();signal?.removeEventListener("abort",abort);if(error)reject(error);else resolve(job!);};const abort=()=>finish(new DOMException("Waiting aborted; server work continues","AbortError"));const check=()=>{if(this.failures>=5){finish(new Error("AI job status unavailable"));return;}const job=this.snapshot.jobs.find(job=>job.id===id);if(job&&!active(job))finish(undefined,job);};off=this.subscribe(check);signal?.addEventListener("abort",abort,{once:true});check();});
 }
}
