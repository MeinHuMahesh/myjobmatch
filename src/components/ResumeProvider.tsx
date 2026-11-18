"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { scoreJob } from "@/lib/scoring";
import { snapshotJobs } from "@/lib/snapshot";
import type { ResumeProfile, ScoreBreakdown } from "@/lib/types";

const STORAGE_KEY = "myjobmatch:resume:v1";

interface ResumeContextValue {
  profile: ResumeProfile | null;
  ready: boolean;
  scores: ReadonlyMap<number, ScoreBreakdown>;
  saveProfile: (profile: ResumeProfile | null) => void;
}

const ResumeContext = createContext<ResumeContextValue | null>(null);

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setProfile(JSON.parse(raw) as ResumeProfile);
      } catch {
        // A corrupt or blocked localStorage should not break the page.
      }
      setReady(true);
    });
  }, []);

  const saveProfile = useCallback((next: ResumeProfile | null) => {
    setProfile(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable in private browsing; in-memory state still works.
    }
  }, []);

  const scores = useMemo(() => {
    const result = new Map<number, ScoreBreakdown>();
    if (!profile) return result;
    for (const job of snapshotJobs) {
      result.set(job.id, scoreJob(profile, job));
    }
    return result;
  }, [profile]);

  const value = useMemo(
    () => ({ profile, ready, scores, saveProfile }),
    [profile, ready, scores, saveProfile],
  );

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>;
}

export function useResume(): ResumeContextValue {
  const context = useContext(ResumeContext);
  if (!context) throw new Error("useResume must be used inside ResumeProvider");
  return context;
}
