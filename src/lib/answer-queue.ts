import { supabase } from "@/integrations/supabase/client";

/** Answers that could not reach the server (Wi-Fi cut) wait here and are re-sent later. */
export const QUEUE_KEY = "vokabeln:pending-answers";
export type AnswerArgs = { _word: string; _mode: string; _correct: boolean; _given?: string; _error?: string };
type Rpc = (args: AnswerArgs) => Promise<{ error: { message: string } | null }>;

const defaultRpc: Rpc = async (args) => {
  const { error } = await supabase.rpc("record_answer", args);
  return { error };
};

/** Network failures (not server refusals) are worth retrying. */
export function isNetworkError(msg: string): boolean {
  return /fetch|network|load failed|timeout|offline/i.test(msg);
}

function read(): AnswerArgs[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); } catch { return []; }
}
function write(q: AnswerArgs[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500))); }
export function pendingCount() { return typeof localStorage === "undefined" ? 0 : read().length; }

/** "ok" = saved, "queued" = kept locally for later, "error" = refused by the server. */
export async function sendAnswer(args: AnswerArgs, rpc: Rpc = defaultRpc): Promise<"ok" | "queued" | { error: string }> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      const { error } = await rpc(args);
      if (!error) { void flushAnswers(rpc); return "ok"; }
      if (!isNetworkError(error.message)) return { error: error.message };
    } catch (e) {
      if (!isNetworkError(String((e as Error)?.message ?? e))) return { error: String(e) };
    }
  }
  write([...read(), args]);
  return "queued";
}

let flushing = false;
/** Re-sends waiting answers in order; stops at the first network failure. */
export async function flushAnswers(rpc: Rpc = defaultRpc): Promise<number> {
  if (flushing || typeof localStorage === "undefined") return 0;
  flushing = true;
  let sent = 0;
  try {
    let q = read();
    while (q.length) {
      let res: { error: { message: string } | null };
      try { res = await rpc(q[0]!); } catch (e) { res = { error: { message: String((e as Error)?.message ?? e) } }; }
      if (res.error && isNetworkError(res.error.message)) break;
      q = q.slice(1); write(q);
      if (!res.error) sent++;
    }
  } finally { flushing = false; }
  return sent;
}

let started = false;
export function startAnswerSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void flushAnswers());
  setInterval(() => { if (pendingCount()) void flushAnswers(); }, 15000);
  void flushAnswers();
}
