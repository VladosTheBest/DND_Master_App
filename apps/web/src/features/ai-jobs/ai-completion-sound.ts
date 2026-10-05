import type { AIJob } from "@shadow-edge/shared-types";

const preference="shadow-edge:ai-sound", receipts="shadow-edge:ai-sound-receipts";
const active=new Set<string>(), notified=new Set<string>();
let audio:AudioContext|undefined, installed=false;
export function soundEnabled(){try{return localStorage.getItem(preference)!=="off";}catch{return true;}}
export function prepareAISound(){
  if(installed)return;installed=true;
  const unlock=()=>{
    if(!soundEnabled())return;
    try{audio??=new AudioContext();if(audio.state==="suspended")void audio.resume().catch(()=>{});}catch{/* Audio is optional. */}
  };
  window.addEventListener("pointerdown",unlock,{capture:true});window.addEventListener("keydown",unlock,{capture:true});
}
export function setSoundEnabled(enabled:boolean){
  try{localStorage.setItem(preference,enabled?"on":"off");}catch{/* Private browsing. */}
  window.dispatchEvent(new Event("ai-sound-preference"));
  if(enabled){try{audio??=new AudioContext();void audio.resume().catch(()=>{});}catch{/* Audio is optional. */}}
}
export function notifyAICompletion(id:string,failed=false){
  if(notified.has(id))return;notified.add(id);active.delete(id);
  const play=()=>{
    let seen:Record<string,number>={};
    try{seen=JSON.parse(localStorage.getItem(receipts)||"{}");if(seen[id])return;}catch{seen={};}
    // Do not claim a cross-tab receipt in a tab whose audio is still locked.
    if(!soundEnabled()||!audio||audio.state!=="running")return;
    const now=Date.now();seen[id]=now;
    try{localStorage.setItem(receipts,JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([,at])=>now-at<86400000).slice(-200))));}catch{/* In-memory deduplication remains available. */}
    const context=audio;
    try{(failed?[440,330]:[660,880]).forEach((frequency,index)=>{
      const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.18;
      oscillator.type="sine";oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.3);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.32);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });}catch{/* Never let sound interrupt job completion. */}
  };
  if(navigator.locks)void navigator.locks.request("shadow-edge-ai-sound",play).catch(()=>{});else play();
}
export function observeAIJobs(jobs:AIJob[]){
  for(const job of jobs){if(job.state==="queued"||job.state==="running")active.add(job.id);else if(active.has(job.id))notifyAICompletion(job.id,job.state==="failed");}
}
