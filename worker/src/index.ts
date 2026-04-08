import { Hono } from "hono";
import { cors } from "hono/cors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  SCORES_KV: KVNamespace;
  FOOTBALL_DATA_API_KEY: string;
}

/** football-data.org match shape (trimmed to what we need) */
interface FDMatch {
  id: number;
  utcDate: string;
  status: string; // TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED | CANCELLED | SUSPENDED
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string } | null;
  awayTeam: { id: number; name: string; shortName: string; tla: string } | null;
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
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: string | null; // TLA
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: string | null;
}

interface StandingTeam {
  position: number;
  team: { tla: string; name: string; shortName: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface GroupStanding {
  group: string;
  table: StandingTeam[];
}

// ---------------------------------------------------------------------------
// KV keys
// ---------------------------------------------------------------------------

const KV_SCORES = "wc2026:scores"; // all match scores
const KV_STANDINGS = "wc2026:standings"; // group standings
const KV_MATCH_PREFIX = "wc2026:match:"; // individual match detail
const KV_LAST_POLL = "wc2026:last_poll"; // ISO timestamp of last successful poll

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
  return {
    apiId: m.id,
    utcDate: m.utcDate,
    status: m.status,
    stage: m.stage,
    group: m.group,
    homeTeam: m.homeTeam?.tla ?? null,
    awayTeam: m.awayTeam?.tla ?? null,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    halfTimeHome: m.score.halfTime.home,
    halfTimeAway: m.score.halfTime.away,
    winner: m.score.winner,
  };
}

// ---------------------------------------------------------------------------
// Cron handler — polls upstream, writes to KV
// ---------------------------------------------------------------------------

async function handleCron(env: Env): Promise<void> {
  const now = new Date();

  // Only poll during tournament window (June 1 - July 20, 2026)
  // Widened a bit for pre-tournament testing
  const tournamentStart = new Date("2026-06-01T00:00:00Z");
  const tournamentEnd = new Date("2026-07-20T23:59:59Z");

  if (now < tournamentStart || now > tournamentEnd) {
    // Outside tournament window — skip to save API quota
    return;
  }

  try {
    // Fetch all WC 2026 matches
    const res = await fetchFromFootballData(
      "/competitions/WC/matches?season=2026",
      env.FOOTBALL_DATA_API_KEY,
    );

    if (!res.ok) {
      console.error(`football-data.org returned ${res.status}`);
      return;
    }

    const data = (await res.json()) as { matches: FDMatch[] };
    const matches = data.matches;

    // Transform and store all scores
    const scores: MatchScore[] = matches.map(transformMatch);
    await env.SCORES_KV.put(KV_SCORES, JSON.stringify(scores), {
      expirationTtl: 300, // 5 min TTL as safety net
    });

    // Store individual match details (for /api/match/:id)
    const puts = matches.map((m) =>
      env.SCORES_KV.put(
        `${KV_MATCH_PREFIX}${m.id}`,
        JSON.stringify(transformMatch(m)),
        { expirationTtl: 300 },
      ),
    );
    await Promise.all(puts);

    // Fetch and store standings
    const standingsRes = await fetchFromFootballData(
      "/competitions/WC/standings?season=2026",
      env.FOOTBALL_DATA_API_KEY,
    );

    if (standingsRes.ok) {
      const standingsData = (await standingsRes.json()) as {
        standings: GroupStanding[];
      };
      await env.SCORES_KV.put(
        KV_STANDINGS,
        JSON.stringify(standingsData.standings),
        { expirationTtl: 300 },
      );
    }

    // Record last successful poll
    await env.SCORES_KV.put(KV_LAST_POLL, now.toISOString());
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
  const key = `ratelimit:${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 60) return false; // 60 req/min

  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
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
    return c.json({ error: "Rate limit exceeded. Max 60 requests per minute." }, 429);
  }
  await next();
});

// ---------------------------------------------------------------------------
// GET /api/scores — all match scores (from KV)
// ---------------------------------------------------------------------------

app.get("/api/scores", async (c) => {
  const cached = await c.env.SCORES_KV.get(KV_SCORES);
  if (!cached) {
    return c.json({ matches: [], message: "No data yet. Scores populate during the tournament." });
  }
  const scores: MatchScore[] = JSON.parse(cached);

  // Optional filters
  const status = c.req.query("status"); // IN_PLAY, FINISHED, TIMED
  const date = c.req.query("date"); // YYYY-MM-DD

  let filtered = scores;
  if (status) {
    filtered = filtered.filter((m) => m.status === status);
  }
  if (date) {
    filtered = filtered.filter((m) => m.utcDate.startsWith(date));
  }

  return c.json({ matches: filtered });
});

// ---------------------------------------------------------------------------
// GET /api/standings — group standings (from KV)
// ---------------------------------------------------------------------------

app.get("/api/standings", async (c) => {
  const cached = await c.env.SCORES_KV.get(KV_STANDINGS);
  if (!cached) {
    return c.json({ standings: [], message: "No standings data yet." });
  }
  return c.json({ standings: JSON.parse(cached) });
});

// ---------------------------------------------------------------------------
// GET /api/match/:id — single match detail (from KV)
// ---------------------------------------------------------------------------

app.get("/api/match/:id", async (c) => {
  const apiId = c.req.param("id");
  const cached = await c.env.SCORES_KV.get(`${KV_MATCH_PREFIX}${apiId}`);
  if (!cached) {
    return c.json({ error: "Match not found or data not yet available." }, 404);
  }
  return c.json({ match: JSON.parse(cached) });
});

// ---------------------------------------------------------------------------
// GET /api/health — status check
// ---------------------------------------------------------------------------

app.get("/api/health", async (c) => {
  const lastPoll = await c.env.SCORES_KV.get(KV_LAST_POLL);
  return c.json({
    status: "ok",
    lastPoll: lastPoll ?? null,
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
        "GET /api/scores",
        "GET /api/standings",
        "GET /api/match/:id",
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
