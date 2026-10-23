import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

export const DraftOwnerContext=createContext("");

// Owned workspace children inherit the verified account. Isolated/standalone
// consumers retain session lookup without duplicating it inside the cabinet.
export function useDraftOwner(provided?:string) {
  const inherited=useContext(DraftOwnerContext),known=provided||inherited;
  const [owner,setOwner]=useState(known||"");
  useEffect(()=>{if(known){setOwner(known);return;}let active=true;void api.getSession().then(session=>{if(active)setOwner(session.authenticated?session.userId||"":"");}).catch(()=>{if(active)setOwner("");});return()=>{active=false;};},[known]);
  return known||owner;
}
