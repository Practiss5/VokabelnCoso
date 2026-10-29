import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Seconds without any key/click/touch after which the timer pauses. */
export const IDLE_LIMIT_S = 60;

/** "—", "45 s", "14 min", "1 h 05". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Whether this second counts as active learning. */
export function isActiveSecond(visible: boolean, lastActivityMs: number, nowMs: number): boolean {
  return visible && nowMs - lastActivityMs <= IDLE_LIMIT_S * 1000;
}

/** Silently records active time on a homework (never shown to the student). */
export function useHomeworkTimer(homeworkId: string | undefined) {
  useEffect(() => {
    if (!homeworkId) return;
    let last = Date.now();
    let pending = 0;
    const bump = () => { last = Date.now(); };
    const flush = () => {
      if (pending <= 0) return;
      const s = pending; pending = 0;
      void supabase.rpc("add_homework_time", { _hw: homeworkId, _seconds: s });
    };
    const tick = setInterval(() => {
      if (isActiveSecond(document.visibilityState === "visible", last, Date.now())) pending++;
      if (pending >= 30) flush();
    }, 1000);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); else bump(); };
    const evts = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(tick);
      evts.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [homeworkId]);
}
