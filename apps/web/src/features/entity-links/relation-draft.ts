export type RelationDraft = {selected:Record<string,string>;reason:string;editing:string|null};

/** Device storage can be stale or damaged. Never promote a recovered copy to the live revision. */
export function readRelationDraft(value:unknown, baseRevision:unknown, sourceId:string) {
  if (!value || typeof value !== "object" || !Number.isSafeInteger(baseRevision) || (baseRevision as number) < 0) return null;
  const draft=value as Record<string,unknown>;
  if (!draft.selected || typeof draft.selected !== "object" || Array.isArray(draft.selected) || typeof draft.reason !== "string" || [...draft.reason].length > 2000 || (draft.editing !== null && typeof draft.editing !== "string")) return null;
  const entries=Object.entries(draft.selected);
  if(entries.length > 100 || entries.some(([id,title])=>!id || id===sourceId || typeof title!=="string")) return null;
  if(draft.editing===sourceId || draft.editing==="") return null;
  return {selected:Object.fromEntries(entries) as Record<string,string>,reason:draft.reason,editing:draft.editing as string|null,revision:baseRevision as number};
}
