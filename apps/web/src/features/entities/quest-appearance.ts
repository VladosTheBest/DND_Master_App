import type {QuestAppearance} from "@shadow-edge/shared-types";
import {safeCardColor} from "./reward-input";

export function sanitizeQuestAppearance(value?:QuestAppearance):QuestAppearance|undefined {
 if(value===undefined)return undefined;
 return {
  ...(safeCardColor(value.textColor)?{textColor:safeCardColor(value.textColor)}:{}),
  ...(safeCardColor(value.backgroundColor)?{backgroundColor:safeCardColor(value.backgroundColor)}:{}),
  ...(safeCardColor(value.accentColor)?{accentColor:safeCardColor(value.accentColor)}:{}),
  ...(value.density==="compact"||value.density==="comfortable"?{density:value.density}:{})
 };
}
