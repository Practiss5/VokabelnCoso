import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { afterFailure, lockRemainingMs, type LockState } from "./login-lock";
import { isValidCode, isValidPin, normalizeCode, studentEmail } from "./student-code";

type Result =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; reason: "locked"; minutes: number }
  | { ok: false; reason: "wrong"; locked_minutes?: number };

export const studentLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; pin: string }) => {
    const code = normalizeCode(String(d?.code ?? ""));
    const pin = String(d?.pin ?? "");
    if (!isValidCode(code) || !isValidPin(pin)) throw new Error("Code invalide");
    return { code, pin };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const { data: row } = await supabaseAdmin
      .from("student_login_attempts")
      .select("failures, lock_level, locked_until")
      .eq("code", data.code)
      .maybeSingle();
    const state = row as LockState | null;
    const remaining = lockRemainingMs(state, now);
    if (remaining > 0) return { ok: false, reason: "locked", minutes: Math.ceil(remaining / 60000) };

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: auth, error } = await client.auth.signInWithPassword({ email: studentEmail(data.code), password: data.pin });

    if (error || !auth.session) {
      const next = afterFailure(state, now);
      await supabaseAdmin
        .from("student_login_attempts")
        .upsert({ code: data.code, ...next, updated_at: now.toISOString() });
      const lockedMs = lockRemainingMs(next, now);
      return lockedMs > 0 ? { ok: false, reason: "wrong", locked_minutes: Math.ceil(lockedMs / 60000) } : { ok: false, reason: "wrong" };
    }
    await supabaseAdmin.from("student_login_attempts").delete().eq("code", data.code);
    return { ok: true, access_token: auth.session.access_token, refresh_token: auth.session.refresh_token };
  });
