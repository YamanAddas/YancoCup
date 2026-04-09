/**
 * Frontend client for the YancoCup Cloudflare Worker API.
 * All live score data flows through the Worker (never direct to football-data.org).
 *
 * Match IDs are football-data.org API IDs everywhere — no local ID mapping needed.
 */

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ?? "https://yancocup-api.catbyte1985.workers.dev";

// ---------------------------------------------------------------------------
// Types (mirror Worker response shapes)
// ---------------------------------------------------------------------------

export interface LiveMatchScore {
  apiId: number;
  utcDate: string;
  status: string; // TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED | CANCELLED | SUSPENDED
  stage: string;
  group: string | null;
  homeTeam: string | null; // TLA
  awayTeam: string | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: string | null;
}

export interface StandingTeam {
  position: number;
  team: { id: number; tla: string; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
}

export interface GroupStanding {
  group: string;
  table: StandingTeam[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${WORKER_URL}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Worker unreachable — graceful degradation
    return null;
  }
}

/** Fetch all match scores. Optionally filter by status or date. */
export async function fetchScores(filters?: {
  status?: string;
  date?: string;
}): Promise<LiveMatchScore[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  const path = `/api/scores${qs ? `?${qs}` : ""}`;
  const data = await apiFetch<{ matches: LiveMatchScore[] }>(path);
  return data?.matches ?? [];
}

/** Fetch group standings for a competition. */
export async function fetchStandings(comp?: string): Promise<GroupStanding[]> {
  const path = comp ? `/api/${comp}/standings` : "/api/standings";
  const data = await apiFetch<{ standings: GroupStanding[] }>(path);
  return data?.standings ?? [];
}

/** Fetch a single match by API ID. */
export async function fetchMatch(
  apiId: number,
): Promise<LiveMatchScore | null> {
  const data = await apiFetch<{ match: LiveMatchScore }>(
    `/api/match/${apiId}`,
  );
  return data?.match ?? null;
}

/** Check Worker health. */
export async function fetchHealth(): Promise<{
  status: string;
  lastPoll: string | null;
  tickCount: number;
  competitions: string[];
  timestamp: string;
} | null> {
  return apiFetch("/api/health");
}
