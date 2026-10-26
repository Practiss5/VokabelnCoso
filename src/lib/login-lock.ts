/** Blocage après essais répétés : 5 échecs → 5 min, puis 5 échecs → 15 min (et ainsi de suite). */
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = [5, 15];

export type LockState = { failures: number; lock_level: number; locked_until: string | null };

export function lockRemainingMs(s: LockState | null, now: Date): number {
  if (!s?.locked_until) return 0;
  return Math.max(0, new Date(s.locked_until).getTime() - now.getTime());
}

export function afterFailure(s: LockState | null, now: Date): LockState {
  const failures = (s?.failures ?? 0) + 1;
  const level = s?.lock_level ?? 0;
  if (failures < MAX_FAILURES) return { failures, lock_level: level, locked_until: s?.locked_until ?? null };
  const minutes = LOCK_MINUTES[Math.min(level, LOCK_MINUTES.length - 1)]!;
  return { failures: 0, lock_level: level + 1, locked_until: new Date(now.getTime() + minutes * 60_000).toISOString() };
}
