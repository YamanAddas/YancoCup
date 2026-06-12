/**
 * Score derivation for football-data.org v4 payloads.
 *
 * fullTime is a RUNNING total ("also acts as the running score" per the
 * docs): after a penalty shootout it includes the shootout conversions —
 * a match that ended 1-1 and was won 4-3 on penalties reads fullTime 5-4.
 * Consumers (display, prediction scoring, bracket resolution) want the
 * 120-minute result, with the shootout carried separately.
 */

export interface FDScore {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
  regularTime?: { home: number | null; away: number | null };
  extraTime?: { home: number | null; away: number | null };
  penalties?: { home: number | null; away: number | null };
}

/** The score a human would call "the result" — 120' for shootout matches. */
export function deriveDisplayScore(score: FDScore): {
  home: number | null;
  away: number | null;
} {
  let home = score.fullTime.home;
  let away = score.fullTime.away;
  if (score.duration === "PENALTY_SHOOTOUT") {
    const rt = score.regularTime;
    const et = score.extraTime;
    const pen = score.penalties;
    if (rt?.home != null && rt.away != null) {
      home = rt.home + (et?.home ?? 0);
      away = rt.away + (et?.away ?? 0);
    } else if (pen?.home != null && pen.away != null && home != null && away != null) {
      // regularTime missing — subtract the shootout from the running total.
      // (football-data has been observed freezing nodes mid-reconciliation,
      // so regularTime+extraTime is preferred when present.)
      home = home - pen.home;
      away = away - pen.away;
    }
  }
  return { home, away };
}
