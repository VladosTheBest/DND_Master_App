import { useWorkspaceRoute, navigateWorkspace } from "../../app/workspace-route";
import { AIJobsPanel } from "./AIJobsPanel";
import { buildAIResultURL } from "../../app-route";
import type { ChatContext } from "./AIChat";
import "./ai-jobs.css";
function contextFromLink(raw?:string):ChatContext|undefined {
  try{const value=JSON.parse(raw||"null");if(value&&typeof value.includeCampaign==="boolean"&&Array.isArray(value.sessionIds)&&value.sessionIds.every((id:unknown)=>typeof id==="string"))return value;}catch{}
}
export function ChatWorkspace({campaignId}:{campaignId:string}) {
  const route=useWorkspaceRoute();
  return <section className="ai-chat-page-main workspace-chat" aria-label="AI-чат и задачи"><AIJobsPanel key={`${campaignId}:${route.context||""}`} campaignId={campaignId} pageMode initialContext={contextFromLink(route.context)} onOpenSession={job=>{if(job.campaignId&&job.sessionId)navigateWorkspace(buildAIResultURL(job.campaignId,{sessionId:job.sessionId}));}} onOpenProposal={(id,campaign)=>navigateWorkspace(buildAIResultURL(campaign||campaignId,{proposalId:id}))}/></section>;
}
