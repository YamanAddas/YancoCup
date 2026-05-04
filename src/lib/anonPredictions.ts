/**
 * Anonymous prediction storage.
 *
 * Lets users predict before signing up — predictions live in localStorage,
 * keyed by user_id sentinel ANON_USER_ID. On sign-in, auth.tsx migrates them
 * into Supabase under the real user.id and clears the local copy.
 *
 * Pure module — no React, no Supabase imports. The shape of AnonPrediction
 * mirrors the relevant subset of yc_predictions so migration is a one-shot
 * upsert per row.
 */

import type { Prediction } from "../hooks/usePredictions";

export const ANON_USER_ID = "__anon__";
const STORAGE_KEY = "yc_anon_predictions";

export interface AnonPrediction {
  match_id: number;
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  quick_pick: "H" | "D" | "A" | null;
  is_joker: boolean;
  confidence: 1 | 2 | 3 | null;
  created_at: string;
  updated_at: string;
}

function safeRead(): AnonPrediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(list: AnonPrediction[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Notify other tabs / hooks listening for prediction changes
    window.dispatchEvent(new CustomEvent("yc:anon-predictions"));
  } catch {
    /* localStorage full or blocked — fail silently */
  }
}

/** Read all anonymous predictions, optionally filtered by competition. */
export function readAnonPredictions(
  competitionId?: string,
): AnonPrediction[] {
  const all = safeRead();
  return competitionId
    ? all.filter((p) => p.competition_id === competitionId)
    : all;
}

/** Number of anonymous predictions across all competitions. */
export function countAnonPredictions(): number {
  return safeRead().length;
}

/**
 * Insert or update an anonymous prediction. Matches Supabase upsert semantics:
 * conflict key = (competition_id, match_id).
 */
export function upsertAnonPrediction(
  pred: Omit<AnonPrediction, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
  },
): void {
  const list = safeRead();
  const now = new Date().toISOString();
  const idx = list.findIndex(
    (p) =>
      p.competition_id === pred.competition_id && p.match_id === pred.match_id,
  );
  const next: AnonPrediction = {
    match_id: pred.match_id,
    competition_id: pred.competition_id,
    home_score: pred.home_score,
    away_score: pred.away_score,
    quick_pick: pred.quick_pick,
    is_joker: pred.is_joker,
    confidence: pred.confidence,
    created_at: idx >= 0 ? list[idx]!.created_at : (pred.created_at ?? now),
    updated_at: now,
  };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  safeWrite(list);
}

/** Wipe all anonymous predictions — call after migrating to a real account. */
export function clearAnonPredictions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("yc:anon-predictions"));
  } catch {
    /* ignore */
  }
}

/** Convert an AnonPrediction into the Prediction shape consumers expect. */
export function toPrediction(a: AnonPrediction): Prediction {
  return {
    id: `anon-${a.competition_id}-${a.match_id}`,
    user_id: ANON_USER_ID,
    match_id: a.match_id,
    competition_id: a.competition_id,
    home_score: a.home_score,
    away_score: a.away_score,
    quick_pick: a.quick_pick,
    points: null,
    scored_at: null,
    is_joker: a.is_joker,
    confidence: a.confidence,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}
