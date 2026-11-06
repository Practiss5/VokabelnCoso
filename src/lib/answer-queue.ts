import { supabase } from "@/integrations/supabase/client";
import { submitAnswer } from "@/lib/answers.functions";

/** Answers that could not reach the server (Wi-Fi cut) wait here, one queue per student, and are re-sent later. */
export const QUEUE_KEY = "vokabeln:pending-answers";
export type AnswerArgs = { _word: string; _mode: string; _correct: boolean; _given?: string; _error?: string; _alternatives?: string[]; _homework?: string };
type Rpc = (args: AnswerArgs) => Promise<{ error: { message: string } | null }>;

const defaultRpc: Rpc = async (args) => {
  return submitAnswer({ data: args });
};

/** Signed-in user id from the local session (no network needed). */
async function sessionUser(): Promise<string | null> {
  try { return (await supabase.auth.getSession()).data.session?.user.id ?? null; } catch { return null; }
}

/** Network failures (not server refusals) are worth retrying. */
export function isNetworkError(msg: string): boolean {
  return /fetch|network|load failed|timeout|offline/i.test(msg);
}
/** Session problems: keep the answer, it will be sent when its student is signed in again. */
function isAuthError(msg: string): boolean {
  return /jwt|auth|not authenticated|permission denied|401|403/i.test(msg);
}

const keyOf = (user: string) => `${QUEUE_KEY}:${user}`;
function read(user: string): AnswerArgs[] {
  try { return JSON.parse(localStorage.getItem(keyOf(user)) ?? "[]"); } catch { return []; }
}
function write(user: string, q: AnswerArgs[]) {
  if (q.length) localStorage.setItem(keyOf(user), JSON.stringify(q.slice(-500)));
  else localStorage.removeItem(keyOf(user));
}
export function pendingCount(user: string) { return typeof localStorage === "undefined" ? 0 : read(user).length; }

/** "ok" = saved, "queued" = kept locally for later, "error" = refused by the server. */
export async function sendAnswer(args: AnswerArgs, rpc: Rpc = defaultRpc, user?: string | null): Promise<"ok" | "queued" | { error: string }> {
  const uid = user === undefined ? await sessionUser() : user;
  if (!uid) return { error: "Session expirée : reconnecte-toi." };
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      const { error } = await rpc(args);
      if (!error) { void flushAnswers(rpc, uid); return "ok"; }
      if (!isNetworkError(error.message)) return { error: error.message };
    } catch (e) {
      if (!isNetworkError(String((e as Error)?.message ?? e))) return { error: String(e) };
    }
  }
  write(uid, [...read(uid), args]);
  return "queued";
}

let flushing = false;
/** Re-sends the signed-in student's waiting answers in order; never sends another student's answers. */
export async function flushAnswers(rpc: Rpc = defaultRpc, user?: string | null): Promise<number> {
  if (flushing || typeof localStorage === "undefined") return 0;
  const uid = user === undefined ? await sessionUser() : user;
  if (!uid) return 0;
  flushing = true;
  let sent = 0;
  try {
    let q = read(uid);
    while (q.length) {
      let res: { error: { message: string } | null };
      try { res = await rpc(q[0]!); } catch (e) { res = { error: { message: String((e as Error)?.message ?? e) } }; }
      if (res.error && (isNetworkError(res.error.message) || isAuthError(res.error.message))) break;
      q = q.slice(1); write(uid, q);
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
  setInterval(() => void flushAnswers(), 15000);
  void flushAnswers();
}
