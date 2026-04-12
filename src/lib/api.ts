/**
 * Frontend client for the YancoCup Cloudflare Worker API.
 * All live score data flows through the Worker (never direct to football-data.org).
 *
 * Match IDs are football-data.org API IDs everywhere — no local ID mapping needed.
 */

export const WORKER_URL =
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
  homeTeamId: number | null;
  awayTeamId: number | null;
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

export type ApiError = "network" | "http" | "parse";

interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${WORKER_URL}${path}`);
    if (!res.ok) return { data: null, error: "http" };
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err) {
    // Distinguish parse errors from network errors
    if (err instanceof SyntaxError) return { data: null, error: "parse" };
    return { data: null, error: "network" };
  }
}

/** Fetch match scores for a competition. Defaults to WC. */
export async function fetchScores(comp?: string, filters?: {
  status?: string;
  date?: string;
}): Promise<{ scores: LiveMatchScore[]; fetchedAt: string | null; error: ApiError | null }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  // Use competition-specific endpoint so league pages get their own scores
  const base = comp && comp !== "WC" ? `/api/${comp}/scores` : "/api/scores";
  const path = `${base}${qs ? `?${qs}` : ""}`;
  const { data, error } = await apiFetch<{ matches: LiveMatchScore[]; fetchedAt: string | null }>(path);
  return { scores: data?.matches ?? [], fetchedAt: data?.fetchedAt ?? null, error };
}

/** Fetch group standings for a competition. */
export async function fetchStandings(comp?: string): Promise<GroupStanding[]> {
  const path = comp ? `/api/${comp}/standings` : "/api/standings";
  const { data } = await apiFetch<{ standings: GroupStanding[] }>(path);
  return data?.standings ?? [];
}

/** Fetch a single match by API ID. */
export async function fetchMatch(
  apiId: number,
): Promise<LiveMatchScore | null> {
  const { data } = await apiFetch<{ match: LiveMatchScore }>(
    `/api/match/${apiId}`,
  );
  return data?.match ?? null;
}

export interface Scorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedMatches: number;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
}

/** Fetch top scorers for a competition. */
export async function fetchScorers(comp: string): Promise<Scorer[]> {
  const { data } = await apiFetch<{ scorers: Scorer[] }>(`/api/${comp}/scorers`);
  return data?.scorers ?? [];
}

// ---------------------------------------------------------------------------
// News API
// ---------------------------------------------------------------------------

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  full_content: string | null;
  source_name: string;
  source_url: string;
  image_url: string | null;
  language: string;
  original_language: string;
  competition_id: string | null;
  team_tags: string[];
  is_featured: boolean;
  translated: boolean;
  has_full_content: boolean;
  published_at: string;
  created_at: string;
}

/** Fetch news articles. lang = user's display language (articles are translated to it). */
export async function fetchNews(
  lang: string,
  filters?: {
    featured?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ articles: NewsArticle[]; total: number }> {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (filters?.featured) params.set("featured", "true");
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  const { data } = await apiFetch<{ articles: NewsArticle[]; total: number }>(
    `/api/news?${params.toString()}`,
  );
  return data ?? { articles: [], total: 0 };
}

/** Fetch a single article by slug, translated to the user's language. */
export async function fetchArticle(slug: string, lang: string): Promise<NewsArticle | null> {
  const { data } = await apiFetch<{ article: NewsArticle }>(`/api/news/${slug}?lang=${lang}`);
  return data?.article ?? null;
}

/** Fetch news for a specific competition. */
export async function fetchCompetitionNews(
  comp: string,
  lang: string,
  filters?: { limit?: number; offset?: number },
): Promise<{ articles: NewsArticle[]; total: number }> {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  const { data } = await apiFetch<{ articles: NewsArticle[]; total: number }>(
    `/api/${comp}/news?${params.toString()}`,
  );
  return data ?? { articles: [], total: 0 };
}

/** Fetch news for a specific team. */
export async function fetchTeamNews(
  teamId: string,
  lang: string,
  filters?: { limit?: number },
): Promise<{ articles: NewsArticle[]; total: number }> {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const { data } = await apiFetch<{ articles: NewsArticle[]; total: number }>(
    `/api/team/${teamId}/news?${params.toString()}`,
  );
  return data ?? { articles: [], total: 0 };
}

/** Request on-demand full article translation. Returns translated title + summary + full_content. */
export async function translateArticleOnDemand(
  slug: string,
  lang: string,
): Promise<{ title: string; summary: string; full_content: string | null } | null> {
  const { data } = await apiFetch<{ title: string; summary: string; full_content: string | null }>(
    `/api/news/${slug}/translate?lang=${lang}`,
  );
  return data ?? null;
}

/** Check Worker health. */
export async function fetchHealth(): Promise<{
  status: string;
  lastPoll: string | null;
  tickCount: number;
  cronErrorCount: number;
  competitions: string[];
  timestamp: string;
} | null> {
  const { data } = await apiFetch<{
    status: string;
    lastPoll: string | null;
    tickCount: number;
    cronErrorCount: number;
    competitions: string[];
    timestamp: string;
  }>("/api/health");
  return data;
}
