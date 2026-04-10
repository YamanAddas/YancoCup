import { Hono } from "hono";
import { cors } from "hono/cors";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  SCORES_KV: KVNamespace;
  FOOTBALL_DATA_API_KEY: string;
  API_FOOTBALL_KEY: string;
  AI: Ai;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

/** Competition configuration */
interface CompetitionDef {
  name: string;
  type: "tournament" | "league";
  fdId: number;
}

/** football-data.org match shape (trimmed to what we need) */
interface FDMatch {
  id: number;
  competition: { id: number; code: string; name: string };
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  } | null;
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  } | null;
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

/** What we store in KV and serve to clients */
interface MatchScore {
  apiId: number;
  competitionCode: string;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: string | null;
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

interface StandingTeam {
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

interface GroupStanding {
  group: string;
  table: StandingTeam[];
}

// ---------------------------------------------------------------------------
// Competition registry
// ---------------------------------------------------------------------------

const COMPETITIONS: Record<string, CompetitionDef> = {
  WC: { name: "FIFA World Cup 2026", type: "tournament", fdId: 2000 },
  CL: { name: "UEFA Champions League", type: "tournament", fdId: 2001 },
  PL: { name: "Premier League", type: "league", fdId: 2021 },
  PD: { name: "La Liga", type: "league", fdId: 2014 },
  BL1: { name: "Bundesliga", type: "league", fdId: 2002 },
  SA: { name: "Serie A", type: "league", fdId: 2019 },
  FL1: { name: "Ligue 1", type: "league", fdId: 2015 },
  EC: { name: "European Championship", type: "tournament", fdId: 2018 },
};

// Reverse map: fd competition ID → our code
const FD_ID_TO_CODE = new Map(
  Object.entries(COMPETITIONS).map(([code, def]) => [def.fdId, code]),
);

// Competitions with active standings to rotate through
const STANDINGS_COMPS = ["WC", "PL", "PD", "BL1", "SA", "FL1", "CL", "EC"];

// ---------------------------------------------------------------------------
// Safe JSON parse — returns null on corrupt KV data instead of crashing
// ---------------------------------------------------------------------------

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// KV key patterns
// ---------------------------------------------------------------------------

function kvScores(comp: string): string {
  return `${comp}:scores`;
}
function kvStandings(comp: string): string {
  return `${comp}:standings`;
}
function kvMatch(id: number): string {
  return `match:${id}`;
}
function kvSchedule(comp: string): string {
  return `${comp}:schedule`;
}
const KV_LAST_POLL = "config:last_poll";
const KV_TICK = "config:tick_count";

// ---------------------------------------------------------------------------
// Upstream API
// ---------------------------------------------------------------------------

const FD_BASE = "https://api.football-data.org/v4";

async function fetchFromFootballData(
  path: string,
  apiKey: string,
): Promise<Response> {
  return fetch(`${FD_BASE}${path}`, {
    headers: { "X-Auth-Token": apiKey },
  });
}

// ---------------------------------------------------------------------------
// API-Football (api-sports.io) — rich match data (goals, lineups, stats)
// ---------------------------------------------------------------------------

const AF_BASE = "https://v3.football.api-sports.io";

/** Map our competition codes to API-Football league IDs */
const AF_LEAGUE_IDS: Record<string, number> = {
  PL: 39,
  PD: 140,
  BL1: 78,
  SA: 135,
  FL1: 61,
  CL: 2,
  WC: 1,
  EC: 4,
};

async function fetchFromApiFootball(
  path: string,
  apiKey: string,
): Promise<Response> {
  return fetch(`${AF_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
  });
}

/**
 * Find an API-Football fixture matching a football-data.org match.
 * Searches by league + date + team names. Returns the fixture object or null.
 */
async function findApiFootballFixture(
  env: Env,
  compCode: string,
  matchDate: string, // YYYY-MM-DD
  homeTla: string,
  awayTla: string,
): Promise<Record<string, unknown> | null> {
  const leagueId = AF_LEAGUE_IDS[compCode];
  if (!leagueId || !env.API_FOOTBALL_KEY) return null;

  // Check cache first (keyed by league + date)
  const dayCacheKey = `af:${compCode}:${matchDate}`;
  const dayCached = await env.SCORES_KV.get(dayCacheKey);
  let fixtures: Array<Record<string, unknown>>;

  if (dayCached) {
    fixtures = safeParse(dayCached) ?? [];
  } else {
    // Fetch all fixtures for this league on this date (1 API call for ~10 matches)
    const season = parseInt(matchDate.slice(0, 4), 10);
    // API-Football season year: use the start year of the season
    const seasonYear = compCode === "WC" || compCode === "EC" ? season : (new Date(matchDate) >= new Date(`${season}-07-01`) ? season : season - 1);

    const res = await fetchFromApiFootball(
      `/fixtures?league=${leagueId}&season=${seasonYear}&date=${matchDate}`,
      env.API_FOOTBALL_KEY,
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { response: Array<Record<string, unknown>> };
    fixtures = data.response ?? [];

    // Cache for 24hr (finished matches don't change)
    if (fixtures.length > 0) {
      await kvPut(env.SCORES_KV, dayCacheKey, JSON.stringify(fixtures), { expirationTtl: 86400 });
    }
  }

  // Match by team TLA codes
  const homeUp = homeTla.toUpperCase();
  const awayUp = awayTla.toUpperCase();
  return fixtures.find((f) => {
    const teams = f.teams as { home?: { name?: string }; away?: { name?: string } } | undefined;
    const hName = (teams?.home?.name ?? "").toUpperCase();
    const aName = (teams?.away?.name ?? "").toUpperCase();
    return (hName.includes(homeUp) || homeUp.includes(hName.slice(0, 3))) &&
           (aName.includes(awayUp) || awayUp.includes(aName.slice(0, 3)));
  }) ?? null;
}

/**
 * Fetch rich match detail from API-Football for a specific fixture ID.
 * Returns events, lineups, statistics.
 */
async function fetchApiFootballDetail(
  env: Env,
  fixtureId: number,
): Promise<Record<string, unknown> | null> {
  const cacheKey = `af:fixture:${fixtureId}`;
  const cached = await env.SCORES_KV.get(cacheKey);
  if (cached) return safeParse(cached) ?? {};

  // Fetch fixture detail with events, lineups, statistics
  const res = await fetchFromApiFootball(
    `/fixtures?id=${fixtureId}`,
    env.API_FOOTBALL_KEY,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { response: Array<Record<string, unknown>> };
  const fixture = data.response?.[0] ?? null;
  if (fixture) {
    // Cache: finished = 7 days, live = 2min, upcoming = 1hr
    const status = ((fixture.fixture as Record<string, unknown>)?.status as Record<string, unknown>)?.short as string;
    const ttl = status === "FT" || status === "AET" || status === "PEN" ? 604800
      : status === "1H" || status === "2H" || status === "HT" ? 120
      : 3600;
    await kvPut(env.SCORES_KV, cacheKey, JSON.stringify(fixture), { expirationTtl: ttl });
  }
  return fixture;
}

function transformMatch(m: FDMatch): MatchScore {
  // Map competition ID to our code, or use the API's code
  const compCode = FD_ID_TO_CODE.get(m.competition.id) ?? m.competition.code;
  return {
    apiId: m.id,
    competitionCode: compCode,
    utcDate: m.utcDate,
    status: m.status,
    matchday: m.matchday,
    stage: m.stage,
    group: m.group,
    homeTeam: m.homeTeam?.tla ?? null,
    awayTeam: m.awayTeam?.tla ?? null,
    homeCrest: m.homeTeam?.crest ?? null,
    awayCrest: m.awayTeam?.crest ?? null,
    homeTeamName: m.homeTeam?.shortName ?? null,
    awayTeamName: m.awayTeam?.shortName ?? null,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    halfTimeHome: m.score.halfTime.home,
    halfTimeAway: m.score.halfTime.away,
    winner: m.score.winner,
  };
}

/** Safe KV put — silently handles daily write limit errors */
async function kvPut(
  kv: KVNamespace,
  key: string,
  value: string,
  opts?: { expirationTtl: number },
): Promise<void> {
  try {
    await kv.put(key, value, opts);
  } catch {
    // KV daily write limit exceeded — skip silently, data will refresh next cycle
  }
}

// ---------------------------------------------------------------------------
// News pipeline — RSS feeds, AI rewrite, Supabase storage
// ---------------------------------------------------------------------------

interface RSSFeedConfig {
  url: string;
  sourceName: string;
  language: string;
}

const RSS_FEEDS: RSSFeedConfig[] = [
  // English
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", sourceName: "BBC Sport", language: "en" },
  { url: "https://www.theguardian.com/football/rss", sourceName: "The Guardian", language: "en" },
  { url: "https://www.espn.com/espn/rss/soccer/news", sourceName: "ESPN", language: "en" },
  { url: "https://www.skysports.com/rss/12040", sourceName: "Sky Sports", language: "en" },
  // Arabic
  { url: "https://www.aljazeera.net/rss", sourceName: "Al Jazeera", language: "ar" },
  // Spanish
  { url: "https://e00-marca.uecdn.es/rss/portada.xml", sourceName: "Marca", language: "es" },
  { url: "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada", sourceName: "AS", language: "es" },
  // German
  { url: "https://newsfeed.kicker.de/news/aktuell", sourceName: "Kicker", language: "de" },
  // Italian
  { url: "https://www.gazzetta.it/dynamic-feed/rss/section/Calcio.xml", sourceName: "Gazzetta dello Sport", language: "it" },
  // French
  { url: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/", sourceName: "L'Equipe", language: "fr" },
  // Portuguese
  { url: "https://www.record.pt/rss", sourceName: "Record", language: "pt" },
];

/** Parsed RSS article */
interface RSSArticle {
  title: string;
  link: string;
  description: string;
  imageUrl: string | null;
  pubDate: string;
  sourceName: string;
  language: string;
}

/** Generate a URL-safe slug from title */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
}

/** Detect competition from article title/description */
function detectCompetition(text: string): string | null {
  const lower = text.toLowerCase();
  if (/world cup|copa del mundo|كأس العالم|coupe du monde|wm 2026|mondiale/.test(lower)) return "WC";
  if (/champions league|uefa cl|ligue des champions|liga de campeones/.test(lower)) return "CL";
  if (/premier league|epl/.test(lower)) return "PL";
  if (/la liga|liga española/.test(lower)) return "PD";
  if (/bundesliga/.test(lower)) return "BL1";
  if (/serie a|calcio/.test(lower)) return "SA";
  if (/ligue 1/.test(lower)) return "FL1";
  if (/europa league/.test(lower)) return "EL";
  return null;
}

/** Detect team tags from article text (using known team TLAs) */
const KNOWN_TEAMS = [
  "BAR", "RMA", "ATM", "LIV", "MCI", "MUN", "CHE", "ARS",
  "BAY", "BVB", "JUV", "INT", "MIL", "NAP", "PSG", "BEN",
  "POR", "AJA", "FCB", "TOT", "NEW", "AVL", "BHA", "WHU",
];

function detectTeamTags(text: string): string[] {
  const upper = text.toUpperCase();
  return KNOWN_TEAMS.filter((tla) => upper.includes(tla));
}

/** Fetch and parse a single RSS feed */
async function fetchRSSFeed(feed: RSSFeedConfig): Promise<RSSArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "YancoCup/1.0 (RSS Reader)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(xml);

    // Handle both RSS 2.0 and Atom formats
    const items: unknown[] =
      parsed?.rss?.channel?.item ??
      parsed?.feed?.entry ??
      [];

    const articles: RSSArticle[] = [];
    const itemArray = Array.isArray(items) ? items : [items];

    for (const item of itemArray.slice(0, 10)) {
      const i = item as Record<string, unknown>;

      // Title
      const title = (typeof i.title === "string" ? i.title : (i.title as Record<string, unknown>)?.["#text"] as string) ?? "";
      if (!title) continue;

      // Link
      const link = (typeof i.link === "string" ? i.link : (i.link as Record<string, unknown>)?.["@_href"] as string) ?? "";
      if (!link) continue;

      // Filter Al Jazeera to sports/football only
      if (feed.sourceName === "Al Jazeera") {
        const category = JSON.stringify(i.category ?? "").toLowerCase();
        const titleLower = title.toLowerCase();
        if (!category.includes("رياضة") && !category.includes("sport") && !titleLower.includes("كرة") && !titleLower.includes("foot")) {
          continue;
        }
      }

      // Description
      const desc = (typeof i.description === "string" ? i.description : (i["content:encoded"] as string) ?? (i.summary as string) ?? "")
        .replace(/<[^>]+>/g, "") // strip HTML tags
        .slice(0, 500);

      // Image URL
      const imageUrl =
        (i["media:content"] as Record<string, unknown>)?.["@_url"] as string ??
        (i["media:thumbnail"] as Record<string, unknown>)?.["@_url"] as string ??
        (i.enclosure as Record<string, unknown>)?.["@_url"] as string ??
        null;

      // Published date
      const pubDate = (i.pubDate as string) ?? (i.published as string) ?? (i.updated as string) ?? new Date().toISOString();

      articles.push({
        title: title.trim(),
        link: link.trim(),
        description: desc.trim(),
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        pubDate,
        sourceName: feed.sourceName,
        language: feed.language,
      });
    }

    return articles;
  } catch {
    return [];
  }
}

/** Fetch all RSS feeds in batches of 6 (Workers connection limit) */
async function fetchAllFeeds(): Promise<RSSArticle[]> {
  const all: RSSArticle[] = [];
  const batchSize = 6;

  for (let i = 0; i < RSS_FEEDS.length; i += batchSize) {
    const batch = RSS_FEEDS.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchRSSFeed));
    for (const articles of results) {
      all.push(...articles);
    }
  }

  return all;
}

/** AI rewrite an article into a 3-5 sentence summary */
async function aiRewrite(
  ai: Ai,
  article: RSSArticle,
): Promise<string | null> {
  try {
    const prompt = article.language === "ar"
      ? `لخص هذا المقال الرياضي في 3-5 جمل بالعربية. اكتب بشكل محايد وإخباري.\n\nالعنوان: ${article.title}\n\n${article.description}`
      : article.language === "es"
      ? `Resume este artículo deportivo en 3-5 oraciones en español. Escribe de forma neutral e informativa.\n\nTítulo: ${article.title}\n\n${article.description}`
      : article.language === "de"
      ? `Fasse diesen Sportartikel in 3-5 Sätzen auf Deutsch zusammen. Schreibe neutral und informativ.\n\nTitel: ${article.title}\n\n${article.description}`
      : article.language === "it"
      ? `Riassumi questo articolo sportivo in 3-5 frasi in italiano. Scrivi in modo neutrale e informativo.\n\nTitolo: ${article.title}\n\n${article.description}`
      : article.language === "fr"
      ? `Résumez cet article sportif en 3-5 phrases en français. Écrivez de manière neutre et informative.\n\nTitre: ${article.title}\n\n${article.description}`
      : article.language === "pt"
      ? `Resuma este artigo esportivo em 3-5 frases em português. Escreva de forma neutra e informativa.\n\nTítulo: ${article.title}\n\n${article.description}`
      : `Summarize this sports article in 3-5 sentences. Write neutrally and informatively. Do not add opinions.\n\nTitle: ${article.title}\n\n${article.description}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "You are a concise sports news summarizer. Output ONLY the summary, no labels or prefixes." },
        { role: "user", content: prompt },
      ],
      max_tokens: 256,
    });

    const text = (result as { response?: string }).response;
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/** Insert articles into Supabase yc_articles table */
async function insertArticles(
  env: Env,
  articles: Array<{
    slug: string;
    title: string;
    summary: string;
    source_name: string;
    source_url: string;
    image_url: string | null;
    language: string;
    competition_id: string | null;
    team_tags: string[];
    is_featured: boolean;
    published_at: string;
  }>,
): Promise<void> {
  if (!articles.length || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;

  // Upsert — skip if slug already exists
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(articles),
  });

  if (!res.ok) {
    console.error("Supabase insert failed:", res.status, await res.text());
  }
}

/** News cron: fetch RSS, store raw, AI-rewrite top picks */
async function handleNewsCron(env: Env): Promise<void> {
  try {
    console.log("News cron: starting RSS fetch...");

    // 1. Fetch all RSS feeds
    const allArticles = await fetchAllFeeds();
    console.log(`News cron: fetched ${allArticles.length} articles from RSS`);

    if (!allArticles.length) return;

    // 2. Deduplicate by link (source URL)
    const seen = new Set<string>();
    const unique = allArticles.filter((a) => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });

    // 3. Prepare raw articles for insert (not AI-rewritten)
    const rawArticles = unique.map((a) => {
      const combinedText = `${a.title} ${a.description}`;
      return {
        slug: slugify(a.title) + "-" + Date.now().toString(36).slice(-4),
        title: a.title,
        summary: a.description || a.title,
        source_name: a.sourceName,
        source_url: a.link,
        image_url: a.imageUrl,
        language: a.language,
        competition_id: detectCompetition(combinedText),
        team_tags: detectTeamTags(combinedText),
        is_featured: false,
        published_at: new Date(a.pubDate).toISOString(),
      };
    });

    // 4. Insert all raw articles into Supabase
    // Batch in groups of 25 to avoid payload limits
    for (let i = 0; i < rawArticles.length; i += 25) {
      await insertArticles(env, rawArticles.slice(i, i + 25));
    }
    console.log(`News cron: inserted ${rawArticles.length} raw articles`);

    // 5. AI-rewrite top 2 articles (budget: ~1000 neurons each, ~10-15/day)
    // Pick the 2 most recent football-related articles with enough description
    const candidates = unique
      .filter((a) => a.description.length > 80)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 2);

    for (const article of candidates) {
      const summary = await aiRewrite(env.AI, article);
      if (summary) {
        const combinedText = `${article.title} ${article.description}`;
        const featured = {
          slug: "ai-" + slugify(article.title) + "-" + Date.now().toString(36).slice(-4),
          title: article.title,
          summary,
          source_name: article.sourceName,
          source_url: article.link,
          image_url: article.imageUrl,
          language: article.language,
          competition_id: detectCompetition(combinedText),
          team_tags: detectTeamTags(combinedText),
          is_featured: true,
          published_at: new Date(article.pubDate).toISOString(),
        };
        await insertArticles(env, [featured]);
      }
    }
    console.log(`News cron: AI-rewrote ${candidates.length} featured articles`);
  } catch (err) {
    console.error("News cron failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Cron handler — polls upstream, writes to KV
// ---------------------------------------------------------------------------

async function handleCron(env: Env): Promise<void> {
  try {
    // Get tick count for periodic actions
    const tickStr = await env.SCORES_KV.get(KV_TICK);
    const tick = tickStr ? parseInt(tickStr, 10) + 1 : 1;
    await kvPut(env.SCORES_KV,KV_TICK, String(tick));

    // -----------------------------------------------------------------------
    // Every tick: fetch ALL matches across all competitions (single API call)
    // /v4/matches returns today's matches for all TIER_ONE competitions
    // -----------------------------------------------------------------------
    const res = await fetchFromFootballData(
      "/matches",
      env.FOOTBALL_DATA_API_KEY,
    );

    if (res.ok) {
      const data = (await res.json()) as { matches: FDMatch[] };

      // Group by competition code
      const byComp = new Map<string, MatchScore[]>();
      const allLive: MatchScore[] = [];

      for (const m of data.matches) {
        const score = transformMatch(m);
        const code = score.competitionCode;

        // Only process competitions we care about
        if (!(code in COMPETITIONS)) continue;

        if (!byComp.has(code)) byComp.set(code, []);
        byComp.get(code)!.push(score);

        // Track live matches across all competitions
        if (m.status === "IN_PLAY" || m.status === "PAUSED") {
          allLive.push(score);
        }

        // Store individual match detail
        await kvPut(env.SCORES_KV,kvMatch(m.id), JSON.stringify(score), {
          expirationTtl: 300,
        });
      }

      // Write per-competition score KV entries
      for (const [code, scores] of byComp) {
        // Merge with existing scores (today's poll replaces today's entries)
        const existing = await env.SCORES_KV.get(kvScores(code));
        let merged = scores;

        if (existing) {
          const prev = safeParse<MatchScore[]>(existing) ?? [];
          // Keep entries from other days, replace today's
          const todayIds = new Set(scores.map((s) => s.apiId));
          const kept = prev.filter((p) => !todayIds.has(p.apiId));
          merged = [...kept, ...scores];
        }

        await kvPut(env.SCORES_KV,kvScores(code), JSON.stringify(merged), {
          expirationTtl: 3600,
        });
      }

      // Store all live matches
      await kvPut(env.SCORES_KV,"all:live", JSON.stringify(allLive), {
        expirationTtl: 120,
      });
    }

    // -----------------------------------------------------------------------
    // Every 5th tick (~5 min): fetch upcoming week for scheduling
    // -----------------------------------------------------------------------
    if (tick % 5 === 0) {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const from = today.toISOString().slice(0, 10);
      const to = nextWeek.toISOString().slice(0, 10);

      const upcomingRes = await fetchFromFootballData(
        `/matches?dateFrom=${from}&dateTo=${to}`,
        env.FOOTBALL_DATA_API_KEY,
      );

      if (upcomingRes.ok) {
        const upData = (await upcomingRes.json()) as { matches: FDMatch[] };
        const byComp = new Map<string, MatchScore[]>();

        for (const m of upData.matches) {
          const score = transformMatch(m);
          if (!(score.competitionCode in COMPETITIONS)) continue;

          if (!byComp.has(score.competitionCode))
            byComp.set(score.competitionCode, []);
          byComp.get(score.competitionCode)!.push(score);

          // Store individual match detail
          await kvPut(env.SCORES_KV,kvMatch(m.id), JSON.stringify(score), {
            expirationTtl: 3600,
          });
        }

        // Update per-competition scores with full upcoming week
        for (const [code, scores] of byComp) {
          const existing = await env.SCORES_KV.get(kvScores(code));
          let merged = scores;

          if (existing) {
            const prev = safeParse<MatchScore[]>(existing) ?? [];
            const newIds = new Set(scores.map((s) => s.apiId));
            const kept = prev.filter((p) => !newIds.has(p.apiId));
            merged = [...kept, ...scores];
          }

          await kvPut(env.SCORES_KV,kvScores(code), JSON.stringify(merged), {
            expirationTtl: 3600,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Every 15th tick (~15 min): standings for one competition (rotated)
    // -----------------------------------------------------------------------
    if (tick % 15 === 0) {
      const compIdx = Math.floor(tick / 15) % STANDINGS_COMPS.length;
      const comp = STANDINGS_COMPS[compIdx];
      const def = COMPETITIONS[comp];

      if (def) {
        const standingsRes = await fetchFromFootballData(
          `/competitions/${comp}/standings`,
          env.FOOTBALL_DATA_API_KEY,
        );

        if (standingsRes.ok) {
          const sData = (await standingsRes.json()) as {
            standings: GroupStanding[];
          };
          await kvPut(env.SCORES_KV,
            kvStandings(comp),
            JSON.stringify(sData.standings),
            { expirationTtl: 1800 },
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Every 60th tick (~1 hour): full season schedule for one competition
    // Rotates through all competitions, populates kvSchedule so the
    // /api/:comp/matches endpoint never needs to hit upstream.
    // -----------------------------------------------------------------------
    if (tick % 60 === 0) {
      const schedComps = STANDINGS_COMPS.filter((c) => c !== "WC"); // WC uses static JSON
      const schedIdx = Math.floor(tick / 60) % schedComps.length;
      const comp = schedComps[schedIdx]!;

      const schedRes = await fetchFromFootballData(
        `/competitions/${comp}/matches`,
        env.FOOTBALL_DATA_API_KEY,
      );

      if (schedRes.ok) {
        const schedData = (await schedRes.json()) as { matches: FDMatch[] };
        const matches = schedData.matches.map(transformMatch);
        await kvPut(env.SCORES_KV, kvSchedule(comp), JSON.stringify(matches), {
          expirationTtl: 7200, // 2 hours
        });
      }
    }

    // -----------------------------------------------------------------------
    // Every 48th tick (~4 hours): fetch RSS news, AI-rewrite top picks
    // -----------------------------------------------------------------------
    if (tick % 48 === 0) {
      await handleNewsCron(env);
    }

    // Record last successful poll
    await kvPut(env.SCORES_KV,KV_LAST_POLL, new Date().toISOString());
  } catch (err) {
    console.error("Cron poll failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (simple per-IP via KV)
// ---------------------------------------------------------------------------

async function checkRateLimit(
  ip: string,
  kv: KVNamespace,
): Promise<boolean> {
  try {
    const key = `ratelimit:${ip}`;
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= 60) return false; // 60 req/min

    await kv.put(key, String(count + 1), { expirationTtl: 60 });
    return true;
  } catch {
    // KV write limit exceeded — allow request rather than blocking
    return true;
  }
}

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

// CORS — allow GitHub Pages + localhost dev
app.use(
  "/api/*",
  cors({
    origin: [
      "https://yamanaddas.github.io",
      "http://localhost:5173",
      "http://localhost:4173",
    ],
    allowMethods: ["GET", "OPTIONS"],
    maxAge: 86400,
  }),
);

// Rate limiting middleware
app.use("/api/*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const allowed = await checkRateLimit(ip, c.env.SCORES_KV);
  if (!allowed) {
    return c.json(
      { error: "Rate limit exceeded. Max 60 requests per minute." },
      429,
    );
  }
  await next();
});

// ---------------------------------------------------------------------------
// GET /api/competitions — list all supported competitions
// ---------------------------------------------------------------------------

app.get("/api/competitions", (c) => {
  const list = Object.entries(COMPETITIONS).map(([code, def]) => ({
    id: code,
    name: def.name,
    type: def.type,
    fdId: def.fdId,
  }));
  return c.json({ competitions: list });
});

// ---------------------------------------------------------------------------
// GET /api/live — all live matches across all competitions
// ---------------------------------------------------------------------------

app.get("/api/live", async (c) => {
  const cached = await c.env.SCORES_KV.get("all:live");
  if (!cached) {
    return c.json({ matches: [] });
  }
  return c.json({ matches: safeParse(cached) ?? [] });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/scores — match scores for a competition (from KV)
// ---------------------------------------------------------------------------

app.get("/api/:comp/scores", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  if (!(comp in COMPETITIONS)) {
    return c.json({ error: `Unknown competition: ${comp}` }, 404);
  }

  const cached = await c.env.SCORES_KV.get(kvScores(comp));
  if (!cached) {
    return c.json({
      matches: [],
      message: `No score data for ${comp} yet.`,
    });
  }

  const scores = safeParse<MatchScore[]>(cached) ?? [];

  // Optional filters
  const status = c.req.query("status");
  const date = c.req.query("date");
  const matchday = c.req.query("matchday");

  let filtered = scores;
  if (status) {
    filtered = filtered.filter((m) => m.status === status);
  }
  if (date) {
    filtered = filtered.filter((m) => m.utcDate.startsWith(date));
  }
  if (matchday) {
    const md = parseInt(matchday, 10);
    filtered = filtered.filter((m) => m.matchday === md);
  }

  return c.json({ matches: filtered });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/standings — standings for a competition (from KV)
// ---------------------------------------------------------------------------

app.get("/api/:comp/standings", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  if (!(comp in COMPETITIONS)) {
    return c.json({ error: `Unknown competition: ${comp}` }, 404);
  }

  const cached = await c.env.SCORES_KV.get(kvStandings(comp));
  if (!cached) {
    return c.json({
      standings: [],
      message: `No standings data for ${comp} yet.`,
    });
  }
  return c.json({ standings: safeParse(cached) ?? [] });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/match/:id — single match detail (from KV)
// ---------------------------------------------------------------------------

app.get("/api/:comp/match/:id", async (c) => {
  const apiId = c.req.param("id");
  const cached = await c.env.SCORES_KV.get(kvMatch(parseInt(apiId, 10)));
  if (!cached) {
    return c.json(
      { error: "Match not found or data not yet available." },
      404,
    );
  }
  return c.json({ match: safeParse(cached) ?? null });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/matches — full schedule for a competition
// Fetches from upstream if not cached, caches for 1hr
// ---------------------------------------------------------------------------

app.get("/api/:comp/matches", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  if (!(comp in COMPETITIONS)) {
    return c.json({ error: `Unknown competition: ${comp}` }, 404);
  }

  // Check KV cache: try schedule first, then scores as fallback
  const cached =
    (await c.env.SCORES_KV.get(kvSchedule(comp))) ??
    (await c.env.SCORES_KV.get(kvScores(comp)));

  if (!cached) {
    // No cached data — cron hasn't populated yet. Return empty, don't hit upstream.
    return c.json({ matches: [] });
  }

  const matches = safeParse<MatchScore[]>(cached) ?? [];

  // Apply optional matchday filter
  const matchday = c.req.query("matchday");
  if (matchday) {
    const md = parseInt(matchday, 10);
    return c.json({ matches: matches.filter((m) => m.matchday === md) });
  }

  return c.json({ matches });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/teams — team squads for a competition (on-demand, 24hr cache)
// ---------------------------------------------------------------------------

app.get("/api/:comp/teams", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  if (!(comp in COMPETITIONS)) {
    return c.json({ error: `Unknown competition: ${comp}` }, 404);
  }

  const cacheKey = `${comp}:teams`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) {
    const parsed = safeParse(cached);
    if (parsed) return c.json(parsed);
  }

  const res = await fetchFromFootballData(
    `/competitions/${comp}/teams`,
    c.env.FOOTBALL_DATA_API_KEY,
  );

  if (!res.ok) {
    return c.json({ error: `Failed to fetch teams for ${comp}` }, 502);
  }

  const data = (await res.json()) as Record<string, unknown>;
  await kvPut(c.env.SCORES_KV, cacheKey, JSON.stringify(data), {
    expirationTtl: 86400,
  });
  return c.json(data);
});

// ---------------------------------------------------------------------------
// Backward-compatible aliases (existing frontend uses these)
// ---------------------------------------------------------------------------

app.get("/api/scores", async (c) => {
  const cached = await c.env.SCORES_KV.get(kvScores("WC"));
  if (!cached) {
    return c.json({
      matches: [],
      message: "No data yet. Scores populate during the tournament.",
    });
  }
  const scores = safeParse<MatchScore[]>(cached) ?? [];

  const status = c.req.query("status");
  const date = c.req.query("date");

  let filtered = scores;
  if (status) {
    filtered = filtered.filter((m) => m.status === status);
  }
  if (date) {
    filtered = filtered.filter((m) => m.utcDate.startsWith(date));
  }

  return c.json({ matches: filtered });
});

app.get("/api/standings", async (c) => {
  const cached = await c.env.SCORES_KV.get(kvStandings("WC"));
  if (!cached) {
    return c.json({ standings: [], message: "No standings data yet." });
  }
  return c.json({ standings: safeParse(cached) ?? [] });
});

app.get("/api/match/:id", async (c) => {
  const apiId = c.req.param("id");
  const cached = await c.env.SCORES_KV.get(kvMatch(parseInt(apiId, 10)));
  if (!cached) {
    return c.json(
      { error: "Match not found or data not yet available." },
      404,
    );
  }
  return c.json({ match: safeParse(cached) ?? null });
});

// ---------------------------------------------------------------------------
// GET /api/match/:id/detail — full match detail (on-demand, KV cached)
// ---------------------------------------------------------------------------

app.get("/api/match/:id/detail", async (c) => {
  const id = c.req.param("id");

  // Check for enriched cache first
  const enrichedKey = `matchenriched:${id}`;
  const enrichedCached = await c.env.SCORES_KV.get(enrichedKey);
  if (enrichedCached) return c.json(safeParse(enrichedCached) ?? {});

  // Fetch basic data from football-data.org
  const basicKey = `matchdetail:${id}`;
  let basicData: Record<string, unknown>;
  const basicCached = await c.env.SCORES_KV.get(basicKey);

  if (basicCached) {
    basicData = safeParse(basicCached) ?? {};
  } else {
    const res = await fetchFromFootballData(
      `/matches/${id}`,
      c.env.FOOTBALL_DATA_API_KEY,
    );
    if (!res.ok) {
      return c.json({ error: "Match not found" }, 404);
    }
    basicData = (await res.json()) as Record<string, unknown>;
    const status = basicData.status as string;
    const ttl = status === "FINISHED" ? 3600 : status === "IN_PLAY" || status === "PAUSED" ? 120 : 300;
    await kvPut(c.env.SCORES_KV, basicKey, JSON.stringify(basicData), { expirationTtl: ttl });
  }

  // Try to enrich with API-Football data (goals, lineups, stats)
  const compCode = (basicData.competition as Record<string, unknown>)?.code as string;
  const utcDate = basicData.utcDate as string;
  const matchDate = utcDate?.slice(0, 10);
  const homeTla = (basicData.homeTeam as Record<string, unknown>)?.tla as string;
  const awayTla = (basicData.awayTeam as Record<string, unknown>)?.tla as string;

  if (compCode && matchDate && homeTla && awayTla && c.env.API_FOOTBALL_KEY) {
    try {
      const afFixture = await findApiFootballFixture(c.env, compCode, matchDate, homeTla, awayTla);
      if (afFixture) {
        const fixtureId = ((afFixture.fixture as Record<string, unknown>)?.id as number);
        if (fixtureId) {
          const detail = await fetchApiFootballDetail(c.env, fixtureId);
          if (detail) {
            const enriched = {
              ...basicData,
              events: detail.events ?? [],
              lineups: detail.lineups ?? [],
              statistics: detail.statistics ?? [],
            };
            const status = basicData.status as string;
            const ttl = status === "FINISHED" ? 604800 : status === "IN_PLAY" || status === "PAUSED" ? 120 : 3600;
            await kvPut(c.env.SCORES_KV, enrichedKey, JSON.stringify(enriched), { expirationTtl: ttl });
            return c.json(enriched);
          }
        }
      }
    } catch {
      // API-Football failed — return basic data
    }
  }

  return c.json(basicData);
});

// ---------------------------------------------------------------------------
// GET /api/h2h/:id — head-to-head for a match (on-demand, 24hr cache)
// ---------------------------------------------------------------------------

app.get("/api/h2h/:id", async (c) => {
  const id = c.req.param("id");
  const cacheKey = `h2h:${id}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) {
    const parsed = safeParse(cached);
    if (parsed) return c.json(parsed);
  }

  const res = await fetchFromFootballData(
    `/matches/${id}/head2head?limit=10`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  if (!res.ok) {
    return c.json({ error: "H2H data not available" }, 404);
  }

  const data = (await res.json()) as Record<string, unknown>;
  await kvPut(c.env.SCORES_KV,cacheKey, JSON.stringify(data), {
    expirationTtl: 86400,
  });
  return c.json(data);
});

// ---------------------------------------------------------------------------
// GET /api/:comp/scorers — top scorers for a competition (on-demand, 1hr cache)
// ---------------------------------------------------------------------------

app.get("/api/:comp/scorers", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  const def = COMPETITIONS[comp];
  if (!def) return c.json({ error: "Unknown competition" }, 404);

  const cacheKey = `${comp}:scorers`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) {
    const parsed = safeParse(cached);
    if (parsed) return c.json(parsed);
  }

  const res = await fetchFromFootballData(
    `/competitions/${comp}/scorers?limit=20`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  if (!res.ok) {
    const status = res.status >= 500 ? 502 : res.status === 404 ? 404 : 400;
    return c.json({ error: "Scorers data not available" }, status as 400 | 404 | 502);
  }

  const data = (await res.json()) as Record<string, unknown>;
  await kvPut(c.env.SCORES_KV, cacheKey, JSON.stringify(data), {
    expirationTtl: 3600,
  });
  return c.json(data);
});

// ---------------------------------------------------------------------------
// News API endpoints — read from Supabase yc_articles
// ---------------------------------------------------------------------------

/** Helper: fetch articles from Supabase with filters */
async function fetchArticles(
  env: Env,
  params: {
    competitionId?: string;
    teamId?: string;
    language?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    slug?: string;
  },
): Promise<{ data: unknown[]; count: number }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return { data: [], count: 0 };
  }

  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "published_at.desc");

  if (params.slug) {
    query.set("slug", `eq.${params.slug}`);
  } else {
    if (params.competitionId) {
      query.set("competition_id", `eq.${params.competitionId}`);
    }
    if (params.teamId) {
      query.set("team_tags", `cs.{${params.teamId}}`);
    }
    if (params.language) {
      query.set("language", `eq.${params.language}`);
    }
    if (params.featured) {
      query.set("is_featured", "eq.true");
    }
    query.set("limit", String(params.limit ?? 30));
    query.set("offset", String(params.offset ?? 0));
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?${query.toString()}`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        Prefer: "count=exact",
      },
    },
  );

  if (!res.ok) return { data: [], count: 0 };

  const data = (await res.json()) as unknown[];
  const countHeader = res.headers.get("content-range");
  const count = countHeader ? parseInt(countHeader.split("/")[1] ?? "0", 10) : data.length;

  return { data, count };
}

// GET /api/news — global news feed
app.get("/api/news", async (c) => {
  const lang = c.req.query("lang");
  const featured = c.req.query("featured") === "true";
  const limit = parseInt(c.req.query("limit") ?? "30", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const { data, count } = await fetchArticles(c.env, {
    language: lang,
    featured: featured || undefined,
    limit,
    offset,
  });

  return c.json({ articles: data, total: count });
});

// GET /api/news/:slug — single article by slug
app.get("/api/news/:slug", async (c) => {
  const slug = c.req.param("slug");
  const { data } = await fetchArticles(c.env, { slug });

  if (!data.length) {
    return c.json({ error: "Article not found" }, 404);
  }

  return c.json({ article: data[0] });
});

// GET /api/:comp/news — competition-specific news
app.get("/api/:comp/news", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  const lang = c.req.query("lang");
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const { data, count } = await fetchArticles(c.env, {
    competitionId: comp,
    language: lang,
    limit,
    offset,
  });

  return c.json({ articles: data, total: count });
});

// GET /api/team/:teamId/news — team-specific news
app.get("/api/team/:teamId/news", async (c) => {
  const teamId = c.req.param("teamId").toUpperCase();
  const lang = c.req.query("lang");
  const limit = parseInt(c.req.query("limit") ?? "15", 10);

  const { data, count } = await fetchArticles(c.env, {
    teamId,
    language: lang,
    limit,
  });

  return c.json({ articles: data, total: count });
});

// ---------------------------------------------------------------------------
// GET /api/health — status check
// ---------------------------------------------------------------------------

app.get("/api/health", async (c) => {
  const lastPoll = await c.env.SCORES_KV.get(KV_LAST_POLL);
  const tick = await c.env.SCORES_KV.get(KV_TICK);
  return c.json({
    status: "ok",
    lastPoll: lastPoll ?? null,
    tickCount: tick ? parseInt(tick, 10) : 0,
    competitions: Object.keys(COMPETITIONS),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      endpoints: [
        "GET /api/competitions",
        "GET /api/live",
        "GET /api/:comp/scores",
        "GET /api/:comp/standings",
        "GET /api/:comp/matches",
        "GET /api/:comp/match/:id",
        "GET /api/match/:id/detail",
        "GET /api/h2h/:id",
        "GET /api/news",
        "GET /api/news/:slug",
        "GET /api/:comp/news",
        "GET /api/team/:teamId/news",
        "GET /api/scores (alias → WC)",
        "GET /api/standings (alias → WC)",
        "GET /api/match/:id (alias)",
        "GET /api/health",
      ],
    },
    404,
  );
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
};
