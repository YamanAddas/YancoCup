import { useState, useEffect } from "react";

export interface CountdownState {
  totalSeconds: number;
  totalMinutes: number;
  hours: number;
  minutes: number;
  seconds: number;
  hasKickedOff: boolean;
}

/**
 * Live countdown to a kickoff time. Adaptive ticking:
 *   - every second when under 10 minutes (drama)
 *   - every 30 seconds when under 2 hours (urgency tier shifts)
 *   - every minute otherwise (cheap idle ticking)
 *
 * Returns null when no kickoffUtc provided.
 */
export function useCountdown(
  kickoffUtc: string | undefined,
): CountdownState | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!kickoffUtc) return;
    const target = new Date(kickoffUtc).getTime();
    let timerId: ReturnType<typeof setTimeout>;

    function tick() {
      const t = Date.now();
      setNow(t);
      const remaining = (target - t) / 1000;
      const next =
        remaining < 600 ? 1000 : remaining < 7200 ? 30_000 : 60_000;
      timerId = setTimeout(tick, next);
    }

    timerId = setTimeout(tick, 0);
    return () => clearTimeout(timerId);
  }, [kickoffUtc]);

  if (!kickoffUtc) return null;
  const target = new Date(kickoffUtc).getTime();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return {
      totalSeconds: 0,
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      hasKickedOff: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  return {
    totalSeconds,
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
    hasKickedOff: false,
  };
}

/** Compact countdown formatter — "1h 47m" / "47m" / "9m 23s" / "23s" */
export function formatCountdown(c: CountdownState): string {
  if (c.hasKickedOff) return "0s";
  if (c.hours >= 1) return `${c.hours}h ${c.minutes}m`;
  if (c.totalMinutes >= 1) {
    if (c.totalMinutes < 10) return `${c.minutes}m ${String(c.seconds).padStart(2, "0")}s`;
    return `${c.minutes}m`;
  }
  return `${c.seconds}s`;
}

/**
 * Urgency tier based on countdown:
 *   - "static" → > 120 minutes (no countdown shown)
 *   - "soon"   → 60-120 minutes (white text, countdown visible)
 *   - "warn"   → 10-60 minutes (amber)
 *   - "urgent" → < 10 minutes (red, "PREDICT NOW" eligible)
 */
export type UrgencyTier = "static" | "soon" | "warn" | "urgent";

export function getUrgencyTier(c: CountdownState | null): UrgencyTier {
  if (!c || c.hasKickedOff) return "static";
  if (c.totalMinutes > 120) return "static";
  if (c.totalMinutes > 60) return "soon";
  if (c.totalMinutes > 10) return "warn";
  return "urgent";
}
