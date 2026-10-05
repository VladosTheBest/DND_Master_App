import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { prepareAISound, setSoundEnabled, soundEnabled } from "./ai-completion-sound";

export function AISoundToggle(){
  const [enabled,setEnabled]=useState(soundEnabled);
  useEffect(()=>{prepareAISound();const sync=()=>setEnabled(soundEnabled());window.addEventListener("storage",sync);window.addEventListener("ai-sound-preference",sync);return()=>{window.removeEventListener("storage",sync);window.removeEventListener("ai-sound-preference",sync);};},[]);
  return <button type="button" className="ghost" title={enabled?"Выключить звук завершения AI":"Включить звук завершения AI"} aria-label="Звук завершения AI" aria-pressed={enabled} onClick={()=>setSoundEnabled(!enabled)}>{enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>;
}
