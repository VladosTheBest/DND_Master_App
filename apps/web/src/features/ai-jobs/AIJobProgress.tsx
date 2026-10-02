import { useEffect, useState } from "react";
import type { AIJob } from "@shadow-edge/shared-types";
import "./ai-jobs.css";

export function AIJobProgress({ job }: { job: AIJob }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(job.startedAt || job.createdAt)) / 1000));
  return <section className="ai-background-progress" aria-label={job.title} aria-busy="true">
    <div className="ai-background-orbit" aria-hidden="true"><span>✦</span><i /><b /></div>
    <div className="ai-background-copy">
      <small>{job.state === "queued" ? "В очереди на сервере" : "AI работает в фоне"}</small>
      <strong>{job.title}</strong>
      <p role="status">{job.stage}</p>
      <div className="ai-background-track" aria-hidden="true"><i /></div>
      <span>Можно переходить по сайту и закрывать вкладку. Результат сохранится автоматически.</span>
    </div>
    <time aria-label="Прошло времени">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2,"0")}</time>
  </section>;
}
