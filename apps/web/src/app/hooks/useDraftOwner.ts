import { useEffect, useState } from "react";
import { api } from "../api";

// Standalone owned pages (maps/scenes) do not inherit the cabinet's auth state.
export function useDraftOwner(provided?:string) {
  const [owner,setOwner]=useState(provided||"");
  useEffect(()=>{if(provided){setOwner(provided);return;}let active=true;void api.getSession().then(session=>{if(active)setOwner(session.authenticated?session.userId||"":"");}).catch(()=>{if(active)setOwner("");});return()=>{active=false;};},[provided]);
  return provided||owner;
}
