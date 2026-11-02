import { useEffect, useState } from "react";
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

/** Event fired after each recorded answer so the timer saves immediately. */
export const ANSWER_EVENT = "vokabeln:answer";
export function notifyAnswer() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ANSWER_EVENT));
}

let cachedToken: string | null = null;
/** Sends seconds with fetch keepalive so it survives tab close. */
function sendTime(hw: string, seconds: number) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/add_homework_time`;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const body = JSON.stringify({ _hw: hw, _seconds: seconds });
  if (!cachedToken) {
    void supabase.rpc("add_homework_time", { _hw: hw, _seconds: seconds });
    return;
  }
  void fetch(url, {
    method: "POST", keepalive: true, body,
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${cachedToken}` },
  }).catch(() => {});
}

/** Active (not overdue) homework of the student's class for this list, earliest due first. */
export function useActiveHomeworkId(listId: string, explicit: string | undefined) {
  const [id, setId] = useState<string | undefined>(explicit);
  useEffect(() => {
    if (explicit) { setId(explicit); return; }
    let off = false;
    void supabase.from("homeworks").select("id").eq("list_id", listId)
      .gt("due_at", new Date().toISOString()).order("due_at", { ascending: true }).limit(1)
      .then(({ data }) => { if (!off) setId(data?.[0]?.id ?? undefined); });
    return () => { off = true; };
  }, [listId, explicit]);
  return id;
}

/** Silently records active time on a homework (never shown to the student). */
export function useHomeworkTimer(homeworkId: string | undefined) {
  useEffect(() => {
    if (!homeworkId) return;
    let last = Date.now();
    let pending = 0;
    void supabase.auth.getSession().then(({ data }) => { cachedToken = data.session?.access_token ?? null; });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => { cachedToken = sess?.access_token ?? null; });
    const bump = () => { last = Date.now(); };
    const flush = () => {
      if (pending <= 0) return;
      const s = Math.min(pending, 120); pending = 0;
      sendTime(homeworkId, s);
    };
    const tick = setInterval(() => {
      if (isActiveSecond(document.visibilityState === "visible", last, Date.now())) pending++;
      if (pending >= 30) flush();
    }, 1000);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); else bump(); };
    const onAnswer = () => { bump(); flush(); };
    const evts = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    window.addEventListener(ANSWER_EVENT, onAnswer);
    return () => {
      clearInterval(tick);
      evts.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener(ANSWER_EVENT, onAnswer);
      sub.subscription.unsubscribe();
      flush();
    };
  }, [homeworkId]);
}
