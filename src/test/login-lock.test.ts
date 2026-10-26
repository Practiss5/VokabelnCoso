import { describe, expect, it } from "vitest";
import { afterFailure, lockRemainingMs, type LockState } from "@/lib/login-lock";

const now = new Date("2026-10-26T12:00:00Z");
function fail(n: number, s: LockState | null = null) {
  for (let i = 0; i < n; i++) s = afterFailure(s, now);
  return s!;
}

describe("blocage connexion élève", () => {
  it("4 échecs ne bloquent pas", () => {
    expect(lockRemainingMs(fail(4), now)).toBe(0);
  });
  it("5 échecs bloquent 5 minutes", () => {
    expect(lockRemainingMs(fail(5), now)).toBe(5 * 60_000);
  });
  it("5 échecs de plus bloquent 15 minutes", () => {
    const s = { ...fail(5), locked_until: null };
    expect(lockRemainingMs(fail(5, s), now)).toBe(15 * 60_000);
  });
});
