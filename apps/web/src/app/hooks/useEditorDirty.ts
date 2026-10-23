import { useLayoutEffect, useState } from "react";

/** The baseline is the editor's opened form, including normalized/default fields. */
export function useEditorDirty(open:boolean,value:unknown) {
  const snapshot=JSON.stringify(value);
  const [baseline,setBaseline]=useState<string|null>(null);
  useLayoutEffect(()=>{setBaseline(open?snapshot:null);},[open]);
  return open&&baseline!==null&&snapshot!==baseline;
}
