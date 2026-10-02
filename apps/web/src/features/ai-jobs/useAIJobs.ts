import { useCallback, useEffect, useRef, useState } from "react";
import type { AIJob } from "@shadow-edge/shared-types";
import { api } from "../../app/api";

export const isActiveJob = (job: AIJob) => job.state === "queued" || job.state === "running";

export function useAIJobs(campaignId?: string) {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const inFlight = useRef(0);
  const refresh = useCallback(async (force = true) => {
    if (!force && inFlight.current) return;
    inFlight.current++;
    const version = ++generation.current;
    try {
      const next = await api.listAIJobs(campaignId);
      if (version !== generation.current) return;
      setJobs(next); setError(""); setLoading(false);
    } catch {
      if (version !== generation.current) return;
      setError("Не удалось обновить статус. Работа на сервере может продолжаться."); setLoading(false);
    } finally {
      inFlight.current--;
    }
  }, [campaignId]);
  useEffect(() => {
    setJobs([]); setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(false), 2500);
    const focused = () => void refresh(false);
    window.addEventListener("focus", focused);
    return () => { generation.current++; clearInterval(timer); window.removeEventListener("focus", focused); };
  }, [refresh]);
  return { jobs, error, loading, refresh };
}
