import { useLayoutEffect, useState } from "react";

/** The baseline is the editor's opened form, including normalized/default fields. */
export function useEditorDirty(open:boolean,value:unknown,savedMarker?:string) {
  const snapshot=JSON.stringify(value);
  const [baseline,setBaseline]=useState<string|null>(null);
  useLayoutEffect(()=>{setBaseline(open?snapshot:null);},[open]);
  // Clearing a success notice on the next edit must not silently accept that edit.
  useLayoutEffect(()=>{if(open&&savedMarker)setBaseline(snapshot);},[savedMarker]);
  return open&&baseline!==null&&snapshot!==baseline;
}
