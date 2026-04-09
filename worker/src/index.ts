import { Hono } from "hono";
import { cors } from "hono/cors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  SCORES_KV: KVNamespace;
  FOOTBALL_DATA_API_KEY: string;
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
const STANDINGS_COMPS = ["WC", "PL", "PD", "BL1", "SA", "FL1", "CL"];

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
          const prev: MatchScore[] = JSON.parse(existing);
          // Keep entries from other days, replace today's
          const todayIds = new Set(scores.map((s) => s.apiId));
          const kept = prev.filter((p) => !todayIds.has(p.apiId));
          merged = [...kept, ...scores];
        }

        await kvPut(env.SCORES_KV,kvScores(code), JSON.stringify(merged), {
          expirationTtl: 600,
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
            const prev: MatchScore[] = JSON.parse(existing);
            const newIds = new Set(scores.map((s) => s.apiId));
            const kept = prev.filter((p) => !newIds.has(p.apiId));
            merged = [...kept, ...scores];
          }

          await kvPut(env.SCORES_KV,kvScores(code), JSON.stringify(merged), {
            expirationTtl: 600,
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
  return c.json({ matches: JSON.parse(cached) });
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

  const scores: MatchScore[] = JSON.parse(cached);

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
  return c.json({ standings: JSON.parse(cached) });
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
  return c.json({ match: JSON.parse(cached) });
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

  // Check KV cache first
  const cached = await c.env.SCORES_KV.get(kvSchedule(comp));
  if (cached) {
    const matches: MatchScore[] = JSON.parse(cached);
    // Apply optional filters
    const matchday = c.req.query("matchday");
    if (matchday) {
      const md = parseInt(matchday, 10);
      return c.json({
        matches: matches.filter((m) => m.matchday === md),
      });
    }
    return c.json({ matches });
  }

  // Fetch from upstream
  const res = await fetchFromFootballData(
    `/competitions/${comp}/matches`,
    c.env.FOOTBALL_DATA_API_KEY,
  );

  if (!res.ok) {
    return c.json(
      { error: `Failed to fetch schedule for ${comp}` },
      502,
    );
  }

  const data = (await res.json()) as { matches: FDMatch[] };
  const matches = data.matches.map(transformMatch);

  // Cache for 1 hour
  await kvPut(c.env.SCORES_KV,kvSchedule(comp), JSON.stringify(matches), {
    expirationTtl: 3600,
  });

  // Apply optional filters
  const matchday = c.req.query("matchday");
  if (matchday) {
    const md = parseInt(matchday, 10);
    return c.json({ matches: matches.filter((m) => m.matchday === md) });
  }

  return c.json({ matches });
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
  const scores: MatchScore[] = JSON.parse(cached);

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
  return c.json({ standings: JSON.parse(cached) });
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
  return c.json({ match: JSON.parse(cached) });
});

// ---------------------------------------------------------------------------
// GET /api/match/:id/detail — full match detail (on-demand, KV cached)
// ---------------------------------------------------------------------------

app.get("/api/match/:id/detail", async (c) => {
  const id = c.req.param("id");
  const cacheKey = `matchdetail:${id}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) return c.json(JSON.parse(cached));

  const res = await fetchFromFootballData(
    `/matches/${id}`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  if (!res.ok) {
    return c.json({ error: "Match not found" }, 404);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const status = data.status as string;
  const ttl = status === "FINISHED" ? 3600 : status === "IN_PLAY" || status === "PAUSED" ? 120 : 300;

  await kvPut(c.env.SCORES_KV,cacheKey, JSON.stringify(data), {
    expirationTtl: ttl,
  });
  return c.json(data);
});

// ---------------------------------------------------------------------------
// GET /api/h2h/:id — head-to-head for a match (on-demand, 24hr cache)
// ---------------------------------------------------------------------------

app.get("/api/h2h/:id", async (c) => {
  const id = c.req.param("id");
  const cacheKey = `h2h:${id}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) return c.json(JSON.parse(cached));

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
