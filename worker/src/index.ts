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
    homeTeamId: m.homeTeam?.id ?? null,
    awayTeamId: m.awayTeam?.id ?? null,
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
  } catch (err) {
    console.error(`KV write failed for key "${key}":`, err);
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
  // ── English — general ──
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", sourceName: "BBC Sport", language: "en" },
  { url: "https://www.theguardian.com/football/rss", sourceName: "The Guardian", language: "en" },
  { url: "https://www.espn.com/espn/rss/soccer/news", sourceName: "ESPN", language: "en" },
  { url: "https://www.skysports.com/rss/12040", sourceName: "Sky Sports", language: "en" },
  // ── English — competition-specific ──
  { url: "https://www.theguardian.com/football/premierleague/rss", sourceName: "The Guardian PL", language: "en" },
  { url: "https://www.theguardian.com/football/championsleague/rss", sourceName: "The Guardian CL", language: "en" },
  { url: "https://www.theguardian.com/football/europaleague/rss", sourceName: "The Guardian EL", language: "en" },
  { url: "https://www.theguardian.com/football/laliga/rss", sourceName: "The Guardian PD", language: "en" },
  { url: "https://www.theguardian.com/football/bundesligafootball/rss", sourceName: "The Guardian BL1", language: "en" },
  { url: "https://www.theguardian.com/football/serieafootball/rss", sourceName: "The Guardian SA", language: "en" },
  { url: "https://www.theguardian.com/football/ligue1football/rss", sourceName: "The Guardian FL1", language: "en" },
  { url: "https://www.theguardian.com/football/world-cup-2026/rss", sourceName: "The Guardian WC", language: "en" },
  // ── Arabic ──
  { url: "https://www.aljazeera.net/sport/rss.xml", sourceName: "Al Jazeera Sport", language: "ar" },
  { url: "https://www.bein.com/ar/rss/", sourceName: "beIN Sports AR", language: "ar" },
  // ── Spanish ──
  { url: "https://e00-marca.uecdn.es/rss/portada.xml", sourceName: "Marca", language: "es" },
  { url: "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada", sourceName: "AS", language: "es" },
  // ── German ──
  { url: "https://newsfeed.kicker.de/news/aktuell", sourceName: "Kicker", language: "de" },
  // ── Italian ──
  { url: "https://www.gazzetta.it/dynamic-feed/rss/section/Calcio.xml", sourceName: "Gazzetta dello Sport", language: "it" },
  // ── French ──
  { url: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/", sourceName: "L'Equipe", language: "fr" },
  // ── Portuguese ──
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
  // World Cup — many variations across languages
  if (/world cup|copa del mundo|كأس العالم|coupe du monde|wm 2026|mondiale 2026|mundial 2026|copa do mundo|fifa 2026|host cit(y|ies).*2026|2026 world|world cup 2026|mondial 2026|weltmeisterschaft/.test(lower)) return "WC";
  // Champions League
  if (/champions league|uefa cl|ligue des champions|liga de campeones|دوري أبطال|champions-league|ucl|\bchampions\b.*\bfinal\b/.test(lower)) return "CL";
  // Premier League — expanded with team-context hints
  if (/premier league|epl|\bprem\b|الدوري الإنجليزي|プレミアリーグ|english top.?flight|top.?four race/.test(lower)) return "PL";
  // La Liga
  if (/la\s?liga|liga española|الدوري الإسباني|laliga|primera divisi[oó]n|liga santander|liga ea sports/.test(lower)) return "PD";
  // Bundesliga
  if (/bundesliga|الدوري الألماني|german league/.test(lower)) return "BL1";
  // Serie A
  if (/\bserie a\b|الدوري الإيطالي|italian league|calcio serie/.test(lower)) return "SA";
  // Ligue 1
  if (/ligue 1|الدوري الفرنسي|french league|ligue1/.test(lower)) return "FL1";
  // Europa League
  if (/europa league|الدوري الأوروبي|ligue europa|uel\b/.test(lower)) return "EL";
  return null;
}

/** Fallback: infer competition from RSS source when text detection fails.
 *  Only sources that are genuinely single-competition get a hint.
 *  General sources (BBC, Guardian, ESPN, Sky) cover all competitions equally. */
const SOURCE_COMPETITION_HINT: Record<string, string> = {
  // Competition-specific Guardian feeds
  "The Guardian PL": "PL",
  "The Guardian CL": "CL",
  "The Guardian EL": "EL",
  "The Guardian PD": "PD",
  "The Guardian BL1": "BL1",
  "The Guardian SA": "SA",
  "The Guardian FL1": "FL1",
  "The Guardian WC": "WC",
  // Language-specific sources that cover a single league
  "Marca": "PD",
  "AS": "PD",
  "Kicker": "BL1",
  "Gazzetta dello Sport": "SA",
  "L'Equipe": "FL1",
};

/** Team name → TLA mapping for detection in article text */
const TEAM_NAMES: Array<{ tla: string; patterns: RegExp }> = [
  // === SPAIN ===
  { tla: "RMA", patterns: /real madrid|ريال مدريد|los blancos|madridista|الملكي|مدريد/ },
  { tla: "BAR", patterns: /barcelona|برشلونة|barça|barca|blaugrana|البرسا|cules/ },
  { tla: "ATM", patterns: /atlético|atletico madrid|أتلتيكو|atleti|colchoneros/ },
  { tla: "RSO", patterns: /real sociedad|سوسيداد/ },
  { tla: "VIL", patterns: /villarreal|فياريال|yellow submarine/ },
  { tla: "BET", patterns: /real betis|بيتيس/ },
  { tla: "SEV", patterns: /sevilla fc|إشبيلية|سيفيا/ },
  { tla: "ATB", patterns: /athletic bilbao|بيلباو|athletic club/ },

  // === ENGLAND ===
  { tla: "LIV", patterns: /liverpool|ليفربول|the reds|أنفيلد|anfield/ },
  { tla: "MCI", patterns: /man(chester)? city|مان(شستر)? سيتي|citizens|السيتيزنز|etihad/ },
  { tla: "MUN", patterns: /man(chester)? united|مان(شستر)? يونايتد|red devils|الشياطين الحمر|old trafford/ },
  { tla: "CHE", patterns: /chelsea|تشيلسي|the blues|stamford bridge/ },
  { tla: "ARS", patterns: /arsenal|آرسنال|أرسنال|gunners|المدفعجية|emirates stadium/ },
  { tla: "TOT", patterns: /tottenham|توتنهام|spurs|سبيرز/ },
  { tla: "NEW", patterns: /newcastle|نيوكاسل|magpies|st james/ },
  { tla: "AVL", patterns: /aston villa|أستون فيلا|villa park/ },
  { tla: "WHU", patterns: /west ham|وست هام|hammers/ },
  { tla: "BHA", patterns: /brighton|برايتون/ },
  { tla: "NFO", patterns: /nott(ingham|\.)? forest|نوتنغهام|فوريست/ },
  { tla: "FUL", patterns: /fulham|فولهام/ },
  { tla: "WOL", patterns: /wolves|wolverhampton|وولفرهامبتون/ },
  { tla: "EVE", patterns: /everton|إيفرتون/ },
  { tla: "CRY", patterns: /crystal palace|كريستال بالاس/ },

  // === GERMANY ===
  { tla: "BAY", patterns: /bayern|بايرن|die roten|fc bayern/ },
  { tla: "BVB", patterns: /dortmund|دورتموند|borussia dortmund|bvb/ },
  { tla: "RBL", patterns: /rb leipzig|لايبزيغ|leipzig/ },
  { tla: "LEV", patterns: /leverkusen|ليفركوزن|bayer 04|werkself/ },
  { tla: "SGE", patterns: /eintracht frankfurt|فرانكفورت|eintracht/ },
  { tla: "FRE", patterns: /sc freiburg|فرايبورغ/ },
  { tla: "STU", patterns: /stuttgart|شتوتغارت|vfb/ },

  // === ITALY ===
  { tla: "JUV", patterns: /juventus|يوفنتوس|juve|bianconeri|la vecchia signora/ },
  { tla: "INT", patterns: /inter milan|إنتر ميلان|internazionale|nerazzurri|الإنتر/ },
  { tla: "MIL", patterns: /ac milan|ميلان|rossoneri|إي سي ميلان/ },
  { tla: "NAP", patterns: /napoli|نابولي|partenopei/ },
  { tla: "ROM", patterns: /as roma|روما|giallorossi/ },
  { tla: "LAZ", patterns: /lazio|لاتسيو/ },
  { tla: "ATA", patterns: /atalanta|أتالانتا/ },
  { tla: "FIO", patterns: /fiorentina|فيورنتينا/ },

  // === FRANCE ===
  { tla: "PSG", patterns: /paris saint.germain|باريس سان جيرمان|psg|باريس/ },
  { tla: "OLY", patterns: /olympique lyonnais|\blyon\b|ليون/ },
  { tla: "OM",  patterns: /olympique de marseille|marseille|مارسيليا/ },
  { tla: "MON", patterns: /as monaco|monaco|موناكو/ },
  { tla: "LIL", patterns: /lille|ليل/ },

  // === PORTUGAL ===
  { tla: "BEN", patterns: /benfica|بنفيكا/ },
  { tla: "POR", patterns: /fc porto|بورتو|porto/ },
  { tla: "SPO", patterns: /sporting cp|سبورتينغ|sporting lisbon/ },

  // === NETHERLANDS ===
  { tla: "AJA", patterns: /ajax|أياكس/ },
  { tla: "PSV", patterns: /psv eindhoven|آيندهوفن/ },
  { tla: "FEY", patterns: /feyenoord|فاينورد/ },

  // === WORLD CUP NATIONS (selection of major teams) ===
  { tla: "BRA", patterns: /brazil|البرازيل|seleção|brasilien|brésil/ },
  { tla: "ARG", patterns: /argentina|الأرجنتين|albiceleste|argentinien/ },
  { tla: "FRA", patterns: /\bfrance\b|فرنسا|les bleus|frankreich|équipe de france/ },
  { tla: "GER", patterns: /\bgermany\b|ألمانيا|die mannschaft|deutschland/ },
  { tla: "ENG", patterns: /\bengland\b|إنجلترا|three lions|angleterr/ },
  { tla: "ESP", patterns: /\bspain\b|إسبانيا|la roja|spanien|espagne/ },
  { tla: "ITA", patterns: /\bitaly\b|إيطاليا|gli azzurri|italien|italie/ },
  { tla: "POR", patterns: /\bportugal\b|البرتغال/ },
  { tla: "NED", patterns: /netherlands|هولندا|oranje|niederlande|pays.bas/ },
  { tla: "BEL", patterns: /belgium|بلجيكا|belgien|belgique|rode duivels/ },
  { tla: "CRO", patterns: /croatia|كرواتيا|kroatien|croatie|vatreni/ },
  { tla: "URU", patterns: /uruguay|أوروغواي|la celeste/ },
  { tla: "MEX", patterns: /\bmexico\b|المكسيك|el tri|mexiko|mexique/ },
  { tla: "USA", patterns: /\busa\b|أمريكا|usmnt|united states|états.unis/ },
  { tla: "CAN", patterns: /\bcanada\b|كندا|canucks/ },
  { tla: "JPN", patterns: /\bjapan\b|اليابان|samurai blue/ },
  { tla: "KOR", patterns: /south korea|كوريا|taegeuk/ },
  { tla: "AUS", patterns: /\baustralia\b|أستراليا|socceroos/ },
  { tla: "MAR", patterns: /morocco|المغرب|atlas lions|marokko|maroc/ },
  { tla: "SEN", patterns: /senegal|السنغال|sénégal/ },
  { tla: "NGA", patterns: /nigeria|نيجيريا|super eagles/ },
  { tla: "GHA", patterns: /\bghana\b|غانا|black stars/ },
  { tla: "CMR", patterns: /cameroon|الكاميرون|cameroun|kamerun/ },
  { tla: "EGY", patterns: /\begypt\b|مصر|pharaohs|الفراعنة/ },
  { tla: "KSA", patterns: /saudi arabia|السعودية|الأخضر/ },
  { tla: "QAT", patterns: /\bqatar\b|قطر/ },
  { tla: "COL", patterns: /colombia|كولومبيا|colombie|kolumbien/ },
];

function detectTeamTags(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const { tla, patterns } of TEAM_NAMES) {
    if (patterns.test(lower)) found.add(tla);
  }
  return [...found];
}

/** Fetch and parse a single RSS feed */
async function fetchRSSFeed(feed: RSSFeedConfig): Promise<RSSArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "YancoCup/1.0 (RSS Reader)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    // Handle encoding: some feeds (e.g. Record.pt) use ISO-8859-1/Windows-1252
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "";
    // Peek at first 200 bytes to check XML encoding declaration
    const peek = new TextDecoder("ascii").decode(buf.slice(0, 200));
    const xmlEnc = peek.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const isLatin = /iso-8859|latin|windows-1252/i.test(contentType) || /iso-8859|latin|windows-1252/i.test(xmlEnc);
    const xml = new TextDecoder(isLatin ? "iso-8859-1" : "utf-8").decode(buf);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: true,
      htmlEntities: true,
      cdataPropName: "__cdata",
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

      // Title — handle string, object with #text, or CDATA-wrapped
      let title = "";
      if (typeof i.title === "string") {
        title = i.title;
      } else if (i.title && typeof i.title === "object") {
        const titleObj = i.title as Record<string, unknown>;
        title = (titleObj["#text"] as string) ?? (titleObj["__cdata"] as string) ?? "";
      }
      // Strip any residual CDATA wrappers and HTML entities
      title = title.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&#0*39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
      if (!title) continue;

      // Link
      let link = "";
      if (typeof i.link === "string") {
        link = i.link;
      } else if (i.link && typeof i.link === "object") {
        const linkObj = i.link as Record<string, unknown>;
        link = (linkObj["@_href"] as string) ?? (linkObj["#text"] as string) ?? "";
      }
      link = link.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (!link) continue;

      // Filter non-football articles from generic sports feeds
      const GENERIC_FEEDS = ["Al Jazeera", "Sky Sports", "ESPN", "Marca", "Kicker", "Record"];
      if (GENERIC_FEEDS.includes(feed.sourceName)) {
        const category = JSON.stringify(i.category ?? "").toLowerCase();
        const titleLower = title.toLowerCase();
        const linkLower = link.toLowerCase();
        const isFootball =
          // URL path hints
          linkLower.includes("/football") || linkLower.includes("/soccer") ||
          linkLower.includes("/futbol") || linkLower.includes("/calcio") ||
          linkLower.includes("/fussball") || linkLower.includes("/futebol") ||
          // Category hints
          category.includes("football") || category.includes("soccer") ||
          category.includes("fútbol") || category.includes("كرة") ||
          category.includes("رياضة") || category.includes("fußball") ||
          // Title keyword hints (football terms in various languages)
          /\b(goal|match|league|cup|transfer|manager|coach|striker|midfielder|defender|premier|champions|europa|la liga|bundesliga|serie a|ligue 1|world cup)\b/.test(titleLower) ||
          /\b(gol|partido|fichaje|entrenador|portero|delantero|jornada)\b/.test(titleLower) ||
          /\b(tor|spiel|trainer|spieltag|meisterschaft|pokal)\b/.test(titleLower) ||
          /كرة|هدف|مباراة|دوري|مدرب|لاعب/.test(title);
        if (!isFootball) continue;
      }

      // Description — handle string, CDATA, or nested objects
      let rawDesc = "";
      if (typeof i.description === "string") {
        rawDesc = i.description;
      } else if (i.description && typeof i.description === "object") {
        const descObj = i.description as Record<string, unknown>;
        rawDesc = (descObj["#text"] as string) ?? (descObj["__cdata"] as string) ?? "";
      }
      if (!rawDesc) rawDesc = (i["content:encoded"] as string) ?? (i.summary as string) ?? "";
      if (typeof rawDesc !== "string") rawDesc = "";
      const desc = rawDesc
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/<[^>]+>/g, "") // strip HTML tags
        .replace(/&#0*39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

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

// ---------------------------------------------------------------------------
// Article full-text scraper — fetch source URL, extract article body
// ---------------------------------------------------------------------------

/** Fetch a URL and extract the main article text from HTML */
async function scrapeArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; YancoCup/1.0; +https://yamanaddas.github.io/YancoCup/)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Best strategy: extract <p> tags from narrowest container (article > main > body)
    const articleHtml = extractTag(html, "article");
    const mainHtml = extractTag(html, "main");
    let container = articleHtml ?? mainHtml ?? html;

    // Clean container: remove script, style, nav, aside, figure, iframe, noscript tags
    container = container.replace(/<(script|style|nav|aside|figure|figcaption|header|footer|button|form|iframe|noscript|svg|video|audio)[^>]*>[\s\S]*?<\/\1>/gi, "");

    const paragraphs = extractParagraphs(container);
    if (paragraphs.length >= 3) {
      const text = paragraphs.join("\n\n");
      // Cap at 15KB to avoid storing entire page dumps
      return text.length > 15000 ? text.slice(0, 15000) : text;
    }

    // Fallback: try common article body CSS class selectors
    for (const cls of [
      "article-body", "article__body", "article-content", "article__content",
      "story-body", "story__body", "story-content",
      "entry-content", "post-content", "post-body",
      "ssrcss-", "article_body", "text--article",
    ]) {
      const match = html.match(new RegExp(`<div[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</div>\\s*(?:<div|</article|</section|</main)`, "i"));
      if (match?.[1] && match[1].length > 200) {
        const fallbackParagraphs = extractParagraphs(match[1]);
        if (fallbackParagraphs.length >= 2) {
          return fallbackParagraphs.join("\n\n").slice(0, 15000);
        }
        const cleaned = htmlToText(match[1]);
        return cleaned ? cleaned.slice(0, 15000) : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Extract content between an opening and closing tag (greedy to capture nested content) */
function extractTag(html: string, tag: string): string | null {
  const openIdx = html.search(new RegExp(`<${tag}[\\s>]`, "i"));
  if (openIdx === -1) return null;
  const afterOpen = html.indexOf(">", openIdx);
  if (afterOpen === -1) return null;
  const closeIdx = html.lastIndexOf(`</${tag}>`) ?? html.lastIndexOf(`</${tag.toUpperCase()}>`);
  if (closeIdx === -1 || closeIdx <= afterOpen) return null;
  const content = html.slice(afterOpen + 1, closeIdx);
  return content.length > 100 ? content : null;
}

/** Extract all <p> text content from HTML */
function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]!).trim();
    // Skip short paragraphs (likely UI text, captions, etc.)
    if (text.length < 40) continue;
    // Skip junk: script imports, code, timestamps, navigation
    if (/^(import |require\(|function |var |const |let |window\.|document\.)/.test(text)) continue;
    if (/^(vor \d|il y a|hace \d|ago$|min\.$)/i.test(text)) continue;
    // Skip paragraphs that are mostly non-letter (e.g. data attributes, URLs)
    const letters = text.replace(/[^a-zA-ZÀ-ÿ\u0600-\u06FF]/g, "").length;
    if (letters < text.length * 0.4) continue;
    paragraphs.push(text);
  }
  return paragraphs;
}

/** Convert HTML fragment to clean plain text */
function htmlToText(html: string): string {
  // Remove script, style, nav, aside, figure, figcaption tags entirely
  let text = html.replace(/<(script|style|nav|aside|figure|figcaption|header|footer|button|form|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Extract paragraphs for proper formatting
  const paragraphs = extractParagraphs(text);
  if (paragraphs.length >= 2) {
    return paragraphs.join("\n\n");
  }

  // Fallback: strip all HTML and clean up
  text = stripHtml(text);
  // Collapse multiple newlines/spaces and trim each line
  text = text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();

  return text.length > 100 ? text : "";
}

/** Strip HTML tags and decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Decode hex entities: &#xDF; → ß, &#xF6; → ö, etc.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Decode decimal entities: &#39; → ', &#8217; → ', etc.
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

const SUPPORTED_LANGS = ["en", "ar", "es", "fr", "de", "pt"] as const;

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", es: "Spanish",
  fr: "French", de: "German", pt: "Portuguese", it: "Italian",
};

// ── m2m100 language codes (differ from our 2-letter codes) ──
const M2M100_LANG: Record<string, string> = {
  en: "english", ar: "arabic", es: "spanish",
  fr: "french", de: "german", pt: "portuguese", it: "italian",
};

// ---------------------------------------------------------------------------
// Translation quality validation
// ---------------------------------------------------------------------------

/** Check if text has repetitive loops or known hallucination patterns */
function hasRepetitionOrHallucination(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length >= 12) {
    const seen = new Map<string, number>();
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(" ").toLowerCase();
      const count = (seen.get(phrase) ?? 0) + 1;
      seen.set(phrase, count);
      if (count >= 3) return true;
    }
  }
  const lower = text.toLowerCase();
  if (/it is important to keep in mind/.test(lower)) return true;
  if (/the quality of the product/.test(lower)) return true;
  if (/as we can see/.test(lower)) return true;
  return false;
}

/** Validate a translation: check length ratio + repetition + hallucination */
function validateTranslation(input: string, output: string): boolean {
  if (!output || !output.trim()) return false;
  const inLen = input.length;
  const outLen = output.length;
  // Reject if output is suspiciously long or short relative to input
  if (inLen > 10 && outLen > inLen * 5) return false;
  if (inLen > 20 && outLen < inLen * 0.15) return false;
  return !hasRepetitionOrHallucination(output);
}

/** Validate an AI summary: only check for repetition/hallucination, not length ratio */
function validateSummary(text: string): boolean {
  if (!text || text.trim().length < 50) return false;
  return !hasRepetitionOrHallucination(text);
}

// ---------------------------------------------------------------------------
// Translation AI functions
// ---------------------------------------------------------------------------

/** Translate a single text using m2m100 (fast, purpose-built translator) — with retry */
async function m2m100Translate(
  ai: Ai,
  text: string,
  sourceLang: string,
  targetLang: string,
  retries = 2,
): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ai as any).run("@cf/meta/m2m100-1.2b", {
        text,
        source_lang: M2M100_LANG[sourceLang] ?? "english",
        target_lang: M2M100_LANG[targetLang] ?? "english",
      });
      const translated = (result as { translated_text?: string }).translated_text;
      if (translated && translated.trim().length > 0) return translated;
    } catch (err) {
      console.warn(`m2m100 attempt ${attempt + 1} failed for ${sourceLang}->${targetLang}: ${err}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

/** Translate a single paragraph using Llama 3.1 8B — returns plain text */
async function llamaTranslateParagraph(
  ai: Ai,
  text: string,
  targetLang: string,
  retries = 1,
): Promise<string | null> {
  const langName = LANG_NAMES[targetLang] ?? "English";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: `You are a professional sports translator. Translate the text into ${langName}. Output ONLY the translated text, nothing else.` },
          { role: "user", content: text },
        ],
        max_tokens: 512,
      });
      const output = (result as { response?: string }).response?.trim();
      if (output && output.length > 0) return output;
    } catch (err) {
      console.warn(`Llama paragraph translate attempt ${attempt + 1} failed: ${err}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800));
    }
  }
  return null;
}

/** Translate using Llama 3.1 8B — with retry and JSON extraction */
async function llamaTranslate(
  ai: Ai,
  title: string,
  summary: string,
  targetLang: string,
  retries = 2,
): Promise<{ title: string; summary: string } | null> {
  const langName = LANG_NAMES[targetLang] ?? "English";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const prompt = `Translate this sports news into ${langName}. Output ONLY valid JSON: {"title":"...","summary":"..."}\n\nTitle: ${title}\n\nSummary: ${summary}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: `You are a professional sports translator. Translate accurately into ${langName}. Output ONLY valid JSON.` },
          { role: "user", content: prompt },
        ],
        max_tokens: 768,
      });
      const text = (result as { response?: string }).response?.trim();
      if (!text) { continue; }
      let jsonStr = text;
      jsonStr = jsonStr.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
      const jsonMatch = jsonStr.match(/\{[\s\S]*"title"[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr) as { title: string; summary: string };
      if (parsed.title?.trim() && parsed.summary?.trim()) return parsed;
    } catch (err) {
      console.warn(`Llama translate attempt ${attempt + 1} failed for ${targetLang}: ${err}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

/** Hybrid translate with quality validation: m2m100 for longer text, Llama for short text or fallback */
async function aiTranslate(
  ai: Ai,
  title: string,
  summary: string,
  targetLang: string,
  sourceLang: string = "en",
): Promise<{ title: string; summary: string } | null> {
  const wordCount = (title + " " + summary).split(/\s+/).length;

  // Short text (<25 words): m2m100 hallucinates, use Llama directly
  if (wordCount < 25) {
    return llamaTranslate(ai, title, summary, targetLang);
  }

  // Normal: m2m100 first with quality validation, Llama fallback
  const [tTitle, tSummary] = await Promise.all([
    m2m100Translate(ai, title, sourceLang, targetLang),
    m2m100Translate(ai, summary, sourceLang, targetLang),
  ]);
  if (tTitle && tSummary
      && validateTranslation(title, tTitle)
      && validateTranslation(summary, tSummary)) {
    return { title: tTitle, summary: tSummary };
  }

  // m2m100 failed or produced garbage — fallback to Llama
  return llamaTranslate(ai, title, summary, targetLang);
}

// ---------------------------------------------------------------------------
// Full-content translation (on-demand, paragraph-by-paragraph)
// ---------------------------------------------------------------------------

/** Translate full article body text using Llama in a single call. */
async function translateFullContent(
  ai: Ai,
  fullContent: string,
  targetLang: string,
  _sourceLang: string,
): Promise<string | null> {
  // Take first ~1200 chars to stay well within Llama's token limits
  const text = fullContent.slice(0, 1200).trim();
  if (text.length < 20) return null;

  const langName = LANG_NAMES[targetLang] ?? "English";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: `Translate this sports article into ${langName}. Output ONLY the translation. Keep paragraph breaks.`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 1500,
      });
      const output = (result as { response?: string }).response?.trim();
      console.log(`translateFullContent attempt ${attempt + 1}: output length=${output?.length ?? 0}`);
      if (output && output.length > 30 && !hasRepetitionOrHallucination(output)) {
        return output;
      }
      if (output) {
        console.warn(`translateFullContent: rejected output (len=${output.length}, hallucination=${hasRepetitionOrHallucination(output)})`);
      }
    } catch (err) {
      console.warn(`translateFullContent attempt ${attempt + 1} failed: ${err}`);
      if (attempt < 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Translation entry & article translation
// ---------------------------------------------------------------------------

interface TranslationEntry {
  title: string;
  summary: string;
  full_content?: string;
}

/** Translate an article into missing languages and save to Supabase */
async function translateArticleMissing(
  env: Env,
  articleId: string,
  title: string,
  summary: string,
  originalLang: string,
  existingTranslations: Record<string, TranslationEntry> | null,
  aiSummary?: string | null,
): Promise<{ translated: number; failed: number }> {
  const translations: Record<string, TranslationEntry> = {
    ...(existingTranslations ?? {}),
  };

  // Use AI summary for translation when available (richer context = better translation)
  const textToTranslate = aiSummary || summary;

  // Original language entry
  translations[originalLang] = { title, summary: textToTranslate };

  const missing = SUPPORTED_LANGS.filter((l) => !translations[l]);
  if (missing.length === 0) return { translated: 0, failed: 0 };

  let translated = 0;
  let failed = 0;
  for (const lang of missing) {
    const result = await aiTranslate(env.AI, title, textToTranslate, lang, originalLang);
    if (result) {
      translations[lang] = { title: result.title, summary: result.summary };
      translated++;
    } else {
      failed++;
      console.warn(`Translation failed: article=${articleId} lang=${lang}`);
    }
    // Small delay between calls
    if (missing.indexOf(lang) < missing.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Save merged translations
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${articleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ translations }),
  });
  if (!res.ok) {
    console.error(`Failed to save translations for ${articleId}: ${res.status}`);
  }

  return { translated, failed };
}

/** Split text into chunks at paragraph boundaries, staying under maxLen chars */
function splitTextChunks(text: string, maxLen: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Insert articles into Supabase yc_articles table. Returns inserted rows (with IDs). */
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
    translations?: Record<string, { title: string; summary: string }>;
  }>,
): Promise<Array<{ id: string; slug: string }>> {
  if (!articles.length || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return [];

  // Upsert — skip if source_url already exists, return inserted rows
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?on_conflict=source_url&select=id,slug`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(articles),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("Supabase insert failed:", res.status, body);
    return [];
  }

  try {
    return JSON.parse(body) as Array<{ id: string; slug: string }>;
  } catch {
    console.error("Supabase insert parse error:", body.slice(0, 200));
    return [];
  }
}

// ---------------------------------------------------------------------------
// News pipeline — 4 phases, one per cron tick (each gets full 30s budget)
// Phase 0: RSS fetch + insert + expire old articles
// Phase 1: Scrape full_content for articles missing it
// Phase 2: AI summarize (Llama generates 3-5 sentence summary from full_content)
// Phase 3: Translate title + AI summary into 6 languages
// ---------------------------------------------------------------------------

/** Title similarity check — Jaccard on normalized words, threshold 0.65 */
function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 && intersection / union > 0.65;
}

/** Supabase helper — common headers */
function sbHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

/** Phase 0: Fetch RSS feeds, deduplicate, insert, expire old articles */
async function newsPhaseRSS(env: Env): Promise<void> {
  console.log("News phase 0: RSS fetch + insert");

  const allArticles = await fetchAllFeeds();
  if (!allArticles.length) return;
  console.log(`News phase 0: fetched ${allArticles.length} articles from RSS`);

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allArticles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  // Title-similarity dedup: fetch recent titles from DB
  let recentTitles: string[] = [];
  try {
    const recentRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/yc_articles?order=published_at.desc&limit=200&select=title`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
    );
    if (recentRes.ok) {
      recentTitles = ((await recentRes.json()) as Array<{ title: string }>).map((r) => r.title);
    }
  } catch { /* ignore */ }

  const deduped = unique.filter((a) => !recentTitles.some((t) => isSimilarTitle(a.title, t)));
  console.log(`News phase 0: ${unique.length} unique, ${deduped.length} after title-dedup`);

  // Prepare articles for insert
  const rawArticles = deduped.map((a) => {
    const combinedText = `${a.title} ${a.description}`;
    return {
      slug: slugify(a.title) + "-" + Date.now().toString(36).slice(-4),
      title: a.title,
      summary: a.description || "",
      source_name: a.sourceName,
      source_url: a.link,
      image_url: a.imageUrl,
      language: a.language,
      competition_id: detectCompetition(combinedText) ?? SOURCE_COMPETITION_HINT[a.sourceName] ?? null,
      team_tags: detectTeamTags(combinedText),
      is_featured: false,
      published_at: (() => { try { return new Date(a.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
    };
  });

  // Insert in batches of 25
  for (let i = 0; i < rawArticles.length; i += 25) {
    await insertArticles(env, rawArticles.slice(i, i + 25));
  }
  console.log(`News phase 0: inserted up to ${rawArticles.length} articles`);

  // Expire articles older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?published_at=lt.${thirtyDaysAgo}`,
    { method: "DELETE", headers: sbHeaders(env.SUPABASE_SERVICE_KEY) },
  );
}

/** Phase 1: Scrape full_content for articles that don't have it yet */
async function newsPhaseScrape(env: Env): Promise<void> {
  console.log("News phase 1: scrape full content");

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?full_content=is.null&scrape_failures=lt.3&order=published_at.desc&limit=10&select=id,source_url,scrape_failures`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
  );
  if (!res.ok) return;

  const toScrape = (await res.json()) as Array<{ id: string; source_url: string; scrape_failures: number }>;
  console.log(`News phase 1: ${toScrape.length} articles to scrape`);

  let scraped = 0;
  for (const row of toScrape) {
    const fullText = await scrapeArticleText(row.source_url);
    if (fullText && fullText.length > 100) {
      // Success: save content
      await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
        method: "PATCH",
        headers: sbHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ full_content: fullText }),
      });
      scraped++;
    } else {
      // Failure: increment counter (will retry until 3 failures)
      await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
        method: "PATCH",
        headers: sbHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ scrape_failures: (row.scrape_failures ?? 0) + 1 }),
      });
    }
  }
  console.log(`News phase 1: scraped ${scraped}/${toScrape.length}`);
}

/** Phase 2: AI summarize — use Llama to generate 3-5 sentence summary from full_content */
async function newsPhaseSummarize(env: Env): Promise<void> {
  console.log("News phase 2: AI summarize");

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?full_content=not.is.null&full_content=neq.&ai_summary=is.null&order=published_at.desc&limit=2&select=id,title,full_content,language`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
  );
  if (!res.ok) return;

  const articles = (await res.json()) as Array<{ id: string; title: string; full_content: string; language: string }>;
  console.log(`News phase 2: ${articles.length} articles to summarize`);

  let summarized = 0;
  for (const article of articles) {
    const excerpt = article.full_content.slice(0, 3000);
    const langName = LANG_NAMES[article.language] ?? "English";

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (env.AI as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: `You are a sports journalist. Write a concise summary in ${langName}. Output ONLY the summary text, no commentary or labels.` },
          { role: "user", content: `Summarize this football article in 3-5 sentences. Be factual and specific. Include key names, scores, and events.\n\nTitle: ${article.title}\n\nArticle:\n${excerpt}` },
        ],
        max_tokens: 400,
      });

      const summary = (result as { response?: string }).response?.trim();
      if (!summary || summary.length < 50 || summary.length > 800) {
        console.warn(`News phase 2: bad summary length for ${article.id}: ${summary?.length ?? 0}`);
        continue;
      }

      // Validate: check for repetition and hallucination
      if (!validateSummary(summary)) {
        console.warn(`News phase 2: summary failed validation for ${article.id}`);
        continue;
      }

      await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${article.id}`, {
        method: "PATCH",
        headers: sbHeaders(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ ai_summary: summary, is_featured: true }),
      });
      summarized++;
      console.log(`News phase 2: summarized ${article.id} — "${article.title.slice(0, 40)}..."`);
    } catch (err) {
      console.warn(`News phase 2: Llama failed for ${article.id}: ${err}`);
    }
  }
  console.log(`News phase 2: summarized ${summarized}/${articles.length}`);
}

/** Phase 3: Translate title + AI summary into all supported languages */
async function newsPhaseTranslate(env: Env): Promise<void> {
  console.log("News phase 3: translate");

  // Fetch untranslated articles (NULL translations)
  const nullRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?translations=is.null&order=published_at.desc&limit=50&select=id,title,summary,ai_summary,language,translations`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
  );

  // Fetch partially translated articles
  const partialRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/yc_articles?translations=not.is.null&order=published_at.desc&limit=200&select=id,title,summary,ai_summary,language,translations`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
  );

  type TranslateRow = {
    id: string; title: string; summary: string; ai_summary: string | null;
    language: string; translations: Record<string, TranslationEntry> | null;
  };

  const nullArticles = nullRes.ok ? ((await nullRes.json()) as TranslateRow[]) : [];
  const partialRaw = partialRes.ok ? ((await partialRes.json()) as TranslateRow[]) : [];
  const partialArticles = partialRaw.filter((a) => {
    const langCount = a.translations ? Object.keys(a.translations).length : 0;
    return langCount < SUPPORTED_LANGS.length;
  });

  const allNeedWork = [...nullArticles, ...partialArticles].slice(0, 3);
  console.log(`News phase 3: ${nullArticles.length} untranslated + ${partialArticles.length} partial — processing ${allNeedWork.length}`);

  let totalTranslated = 0;
  let totalFailed = 0;

  for (const row of allNeedWork) {
    const { translated, failed } = await translateArticleMissing(
      env, row.id, row.title, row.summary, row.language, row.translations, row.ai_summary,
    );
    totalTranslated += translated;
    totalFailed += failed;
  }

  console.log(`News phase 3: ${totalTranslated} translated, ${totalFailed} failed across ${allNeedWork.length} articles`);
}

/** News phase dispatcher */
async function handleNewsPhase(env: Env, phase: number): Promise<void> {
  try {
    switch (phase) {
      case 0: return await newsPhaseRSS(env);
      case 1: return await newsPhaseScrape(env);
      case 2: return await newsPhaseSummarize(env);
      case 3: return await newsPhaseTranslate(env);
      default: return await newsPhaseRSS(env);
    }
  } catch (err) {
    console.error(`News phase ${phase} failed:`, err);
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

    const byComp = new Map<string, MatchScore[]>();

    if (res.ok) {
      const data = (await res.json()) as { matches: FDMatch[] };

      // Group by competition code
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

        // Store individual match detail (24h TTL — cron refreshes frequently)
        await kvPut(env.SCORES_KV,kvMatch(m.id), JSON.stringify(score), {
          expirationTtl: 86400,
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
          expirationTtl: 86400,
        });
      }

      // Store all live matches (short TTL — ephemeral by nature)
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

          // Store individual match detail (24h TTL)
          await kvPut(env.SCORES_KV,kvMatch(m.id), JSON.stringify(score), {
            expirationTtl: 86400,
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
            expirationTtl: 86400,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Every 10th tick (~50 min): pre-enrich upcoming matches (lineups, events)
    // Lineups typically drop ~24h before kickoff. Pre-cache via API-Football
    // so users see lineups immediately when opening match detail page.
    // Budget: max 3 enrichments per tick to stay within API-Football 100 req/day.
    // -----------------------------------------------------------------------
    if (tick % 10 === 0 && env.API_FOOTBALL_KEY) {
      const now = Date.now();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      let enrichCount = 0;
      const MAX_ENRICH_PER_TICK = 3;

      for (const [, scores] of byComp) {
        if (enrichCount >= MAX_ENRICH_PER_TICK) break;
        for (const score of scores) {
          if (enrichCount >= MAX_ENRICH_PER_TICK) break;
          const kickoff = new Date(score.utcDate).getTime();
          const diff = kickoff - now;

          // Pre-enrich matches within 24 hours of kickoff (or currently live)
          const isUpcoming = diff > 0 && diff <= twentyFourHoursMs;
          const isLive = score.status === "IN_PLAY" || score.status === "PAUSED";
          if (!isUpcoming && !isLive) continue;

          // Skip if already enriched in KV
          const enrichedKey = `matchenriched:${score.apiId}`;
          const existing = await env.SCORES_KV.get(enrichedKey);
          if (existing) continue;

          // Need team TLAs and competition code to find API-Football fixture
          if (!score.homeTeam || !score.awayTeam) continue;
          const matchDate = score.utcDate.slice(0, 10);

          try {
            const afFixture = await findApiFootballFixture(env, score.competitionCode, matchDate, score.homeTeam, score.awayTeam);
            if (afFixture) {
              const fixtureId = ((afFixture.fixture as Record<string, unknown>)?.id as number);
              if (fixtureId) {
                const detail = await fetchApiFootballDetail(env, fixtureId);
                if (detail) {
                  // Fetch basic data from football-data.org to merge
                  const basicKey = `matchdetail:${score.apiId}`;
                  let basicData: Record<string, unknown> = {};
                  const basicCached = await env.SCORES_KV.get(basicKey);
                  if (basicCached) {
                    basicData = safeParse(basicCached) ?? {};
                  } else {
                    const fdRes = await fetchFromFootballData(`/matches/${score.apiId}`, env.FOOTBALL_DATA_API_KEY);
                    if (fdRes.ok) {
                      basicData = (await fdRes.json()) as Record<string, unknown>;
                      await kvPut(env.SCORES_KV, basicKey, JSON.stringify(basicData), { expirationTtl: 3600 });
                    }
                  }

                  const enriched = { ...basicData, events: detail.events ?? [], lineups: detail.lineups ?? [], statistics: detail.statistics ?? [] };
                  const ttl = isLive ? 120 : 3600;
                  await kvPut(env.SCORES_KV, enrichedKey, JSON.stringify(enriched), { expirationTtl: ttl });
                  console.log(`Cron: pre-enriched match ${score.apiId} (${score.homeTeam} vs ${score.awayTeam})`);
                  enrichCount++;
                }
              }
            }
          } catch (err) {
            console.error(`Cron: enrich failed for ${score.apiId}:`, err);
          }
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
            { expirationTtl: 86400 },
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
          expirationTtl: 86400,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Every 24th tick (~2 hours): run one news phase (cycles 0-3)
    // Full cycle = 96 ticks = ~8 hours. ~3 cycles/day saves neuron budget.
    // -----------------------------------------------------------------------
    if (tick % 24 === 0) {
      const phaseStr = await env.SCORES_KV.get("news:phase");
      const phase = phaseStr ? parseInt(phaseStr, 10) : 0;
      console.log(`Cron: running news phase ${phase}`);
      await handleNewsPhase(env, phase % 4);
      await kvPut(env.SCORES_KV, "news:phase", String((phase + 1) % 4));
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
      "http://localhost:5175",
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
// Admin routes — MUST be before /api/:comp/* to avoid wildcard match
// ---------------------------------------------------------------------------

app.get("/api/admin/trigger-news", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const phase = c.req.query("phase");
  try {
    if (phase !== undefined) {
      await handleNewsPhase(c.env, parseInt(phase, 10));
      return c.json({ status: "ok", message: `News phase ${phase} triggered` });
    }
    // Run all 4 phases sequentially
    for (let p = 0; p < 4; p++) {
      await handleNewsPhase(c.env, p);
    }
    return c.json({ status: "ok", message: "All 4 news phases completed" });
  } catch (err) {
    return c.json({ status: "error", message: String(err) }, 500);
  }
});

// Admin: backfill scrape full article content
app.get("/api/admin/backfill-scrape", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const res = await fetch(
    `${c.env.SUPABASE_URL}/rest/v1/yc_articles?full_content=is.null&scrape_failures=lt.3&order=published_at.desc&limit=${limit}&offset=${offset}&select=id,source_url,source_name,scrape_failures`,
    { headers: { apikey: c.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}` } },
  );
  if (!res.ok) return c.json({ error: "Failed to fetch articles" }, 500);

  const articles = (await res.json()) as Array<{ id: string; source_url: string; source_name: string; scrape_failures: number }>;
  let scraped = 0;
  let failed = 0;
  const results: Array<{ source: string; len: number }> = [];

  for (const row of articles) {
    const fullText = await scrapeArticleText(row.source_url);
    if (fullText && fullText.length > 100) {
      await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
        method: "PATCH",
        headers: sbHeaders(c.env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ full_content: fullText }),
      });
      scraped++;
      results.push({ source: row.source_name, len: fullText.length });
    } else {
      await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
        method: "PATCH",
        headers: sbHeaders(c.env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ scrape_failures: (row.scrape_failures ?? 0) + 1 }),
      });
      failed++;
    }
  }

  return c.json({ status: "ok", checked: articles.length, scraped, failed, results });
});

// Admin: backfill AI summaries
app.get("/api/admin/backfill-summarize", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") ?? "10", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const res = await fetch(
    `${c.env.SUPABASE_URL}/rest/v1/yc_articles?full_content=not.is.null&full_content=neq.&ai_summary=is.null&order=published_at.desc&limit=${limit}&offset=${offset}&select=id,title,full_content,language`,
    { headers: { apikey: c.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}` } },
  );
  if (!res.ok) return c.json({ error: "Failed to fetch articles" }, 500);

  const articles = (await res.json()) as Array<{ id: string; title: string; full_content: string; language: string }>;
  let summarized = 0;
  let failed = 0;

  for (const article of articles) {
    const excerpt = article.full_content.slice(0, 3000);
    const langName = LANG_NAMES[article.language] ?? "English";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (c.env.AI as any).run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: `You are a sports journalist. Write a concise summary in ${langName}. Output ONLY the summary text, no commentary or labels.` },
          { role: "user", content: `Summarize this football article in 3-5 sentences. Be factual and specific. Include key names, scores, and events.\n\nTitle: ${article.title}\n\nArticle:\n${excerpt}` },
        ],
        max_tokens: 400,
      });
      const summary = (result as { response?: string }).response?.trim();
      if (summary && summary.length >= 50 && summary.length <= 800 && validateSummary(summary)) {
        await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${article.id}`, {
          method: "PATCH",
          headers: sbHeaders(c.env.SUPABASE_SERVICE_KEY),
          body: JSON.stringify({ ai_summary: summary, is_featured: true }),
        });
        summarized++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return c.json({ status: "ok", checked: articles.length, summarized, failed });
});

// Admin: backfill missing translations
app.get("/api/admin/backfill-translate", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") ?? "200", 10);
  const maxTranslate = parseInt(c.req.query("max") ?? "5", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const res = await fetch(
    `${c.env.SUPABASE_URL}/rest/v1/yc_articles?order=published_at.desc&limit=${limit}&offset=${offset}&select=id,title,summary,ai_summary,language,translations`,
    { headers: { apikey: c.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}` } },
  );
  if (!res.ok) return c.json({ error: "Failed to fetch articles" }, 500);

  const articles = (await res.json()) as Array<{
    id: string; title: string; summary: string; ai_summary: string | null;
    language: string; translations: Record<string, TranslationEntry> | null;
  }>;

  const incomplete = articles.filter((a) => {
    const langCount = a.translations ? Object.keys(a.translations).length : 0;
    return langCount < SUPPORTED_LANGS.length;
  });

  const toProcess = incomplete.slice(0, maxTranslate);
  let totalTranslated = 0;
  let totalFailed = 0;

  for (const row of toProcess) {
    const { translated, failed } = await translateArticleMissing(
      c.env, row.id, row.title, row.summary, row.language, row.translations, row.ai_summary,
    );
    totalTranslated += translated;
    totalFailed += failed;
  }

  return c.json({
    status: "ok",
    checked: articles.length,
    incomplete: incomplete.length,
    processed: toProcess.length,
    translated: totalTranslated,
    failed: totalFailed,
    remaining: incomplete.length - toProcess.length,
  });
});

app.get("/api/admin/populate", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const results: Record<string, string> = {};
  const apiKey = c.env.FOOTBALL_DATA_API_KEY;
  const nonWC = STANDINGS_COMPS.filter((comp) => comp !== "WC");

  // 1. Fetch today's matches (all competitions, single call)
  // NOTE: Skip individual match KV writes to conserve daily write quota
  try {
    const res = await fetchFromFootballData("/matches", apiKey);
    if (res.ok) {
      const data = (await res.json()) as { matches: FDMatch[] };
      const byComp = new Map<string, MatchScore[]>();
      for (const m of data.matches) {
        const score = transformMatch(m);
        if (!(score.competitionCode in COMPETITIONS)) continue;
        if (!byComp.has(score.competitionCode)) byComp.set(score.competitionCode, []);
        byComp.get(score.competitionCode)!.push(score);
      }
      for (const [code, scores] of byComp) {
        await kvPut(c.env.SCORES_KV, kvScores(code), JSON.stringify(scores), { expirationTtl: 86400 });
      }
      results.todayMatches = `${data.matches.length} matches across ${byComp.size} competitions`;
    } else {
      results.todayMatches = `FAILED (${res.status})`;
    }
  } catch (e) { results.todayMatches = `ERROR: ${e}`; }

  // 2. Fetch upcoming week (merge with today's scores)
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const from = today.toISOString().slice(0, 10);
    const to = nextWeek.toISOString().slice(0, 10);
    const res = await fetchFromFootballData(`/matches?dateFrom=${from}&dateTo=${to}`, apiKey);
    if (res.ok) {
      const data = (await res.json()) as { matches: FDMatch[] };
      const byComp = new Map<string, MatchScore[]>();
      for (const m of data.matches) {
        const score = transformMatch(m);
        if (!(score.competitionCode in COMPETITIONS)) continue;
        if (!byComp.has(score.competitionCode)) byComp.set(score.competitionCode, []);
        byComp.get(score.competitionCode)!.push(score);
      }
      for (const [code, scores] of byComp) {
        const existing = await c.env.SCORES_KV.get(kvScores(code));
        let merged = scores;
        if (existing) {
          const prev = safeParse<MatchScore[]>(existing) ?? [];
          const newIds = new Set(scores.map((s) => s.apiId));
          merged = [...prev.filter((p) => !newIds.has(p.apiId)), ...scores];
        }
        await kvPut(c.env.SCORES_KV, kvScores(code), JSON.stringify(merged), { expirationTtl: 86400 });
      }
      results.upcomingWeek = `${data.matches.length} matches`;
    } else {
      results.upcomingWeek = `FAILED (${res.status})`;
    }
  } catch (e) { results.upcomingWeek = `ERROR: ${e}`; }

  // 3. Fetch standings for competitions missing from KV
  for (const comp of STANDINGS_COMPS) {
    const cached = await c.env.SCORES_KV.get(kvStandings(comp));
    if (cached) { results[`standings:${comp}`] = "CACHED"; continue; }
    try {
      const res = await fetchFromFootballData(`/competitions/${comp}/standings`, apiKey);
      if (res.ok) {
        const data = (await res.json()) as { standings: GroupStanding[] };
        await kvPut(c.env.SCORES_KV, kvStandings(comp), JSON.stringify(data.standings), { expirationTtl: 86400 });
        results[`standings:${comp}`] = "OK";
      } else {
        results[`standings:${comp}`] = `FAILED (${res.status})`;
      }
    } catch (e) { results[`standings:${comp}`] = `ERROR: ${e}`; }
  }

  // 4. Fetch full schedules for league competitions missing from KV
  for (const comp of nonWC) {
    const cached = await c.env.SCORES_KV.get(kvSchedule(comp));
    if (cached) { results[`schedule:${comp}`] = "CACHED"; continue; }
    try {
      const res = await fetchFromFootballData(`/competitions/${comp}/matches`, apiKey);
      if (res.ok) {
        const data = (await res.json()) as { matches: FDMatch[] };
        const matches = data.matches.map(transformMatch);
        await kvPut(c.env.SCORES_KV, kvSchedule(comp), JSON.stringify(matches), { expirationTtl: 86400 });
        results[`schedule:${comp}`] = `${matches.length} matches`;
      } else {
        results[`schedule:${comp}`] = `FAILED (${res.status})`;
      }
    } catch (e) { results[`schedule:${comp}`] = `ERROR: ${e}`; }
  }

  return c.json({ status: "ok", results });
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
  let scores: MatchScore[];

  if (cached) {
    scores = safeParse<MatchScore[]>(cached) ?? [];
  } else {
    // KV miss — fetch today's matches from upstream
    try {
      const res = await fetchFromFootballData("/matches", c.env.FOOTBALL_DATA_API_KEY);
      if (res.ok) {
        const data = (await res.json()) as { matches: FDMatch[] };
        scores = data.matches.map(transformMatch).filter((s) => s.competitionCode === comp);
      } else {
        return c.json({ matches: [], message: `No score data for ${comp} yet.` });
      }
    } catch {
      return c.json({ matches: [], message: `No score data for ${comp} yet.` });
    }
  }

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
  if (cached) {
    return c.json({ standings: safeParse(cached) ?? [] });
  }

  // KV miss — fetch directly from upstream
  try {
    const res = await fetchFromFootballData(`/competitions/${comp}/standings`, c.env.FOOTBALL_DATA_API_KEY);
    if (res.ok) {
      const data = (await res.json()) as { standings: GroupStanding[] };
      // Try to cache (may fail if write limit exceeded)
      await kvPut(c.env.SCORES_KV, kvStandings(comp), JSON.stringify(data.standings), { expirationTtl: 86400 });
      return c.json({ standings: data.standings });
    }
  } catch { /* fall through */ }

  return c.json({ standings: [], message: `No standings data for ${comp} yet.` });
});

// ---------------------------------------------------------------------------
// GET /api/:comp/match/:id — single match detail (from KV)
// ---------------------------------------------------------------------------

app.get("/api/:comp/match/:id", async (c) => {
  const apiId = c.req.param("id");
  const cached = await c.env.SCORES_KV.get(kvMatch(parseInt(apiId, 10)));
  if (cached) {
    return c.json({ match: safeParse(cached) ?? null });
  }

  // KV miss — fetch from upstream
  try {
    const res = await fetchFromFootballData(`/matches/${apiId}`, c.env.FOOTBALL_DATA_API_KEY);
    if (res.ok) {
      const data = (await res.json()) as FDMatch;
      const match = transformMatch(data);
      await kvPut(c.env.SCORES_KV, kvMatch(parseInt(apiId, 10)), JSON.stringify(match), { expirationTtl: 86400 });
      return c.json({ match });
    }
  } catch { /* fall through */ }

  return c.json({ error: "Match not found or data not yet available." }, 404);
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

  let matches: MatchScore[];

  if (cached) {
    matches = safeParse<MatchScore[]>(cached) ?? [];
  } else {
    // KV miss — fetch directly from upstream (WC uses static JSON on frontend)
    if (comp === "WC") return c.json({ matches: [] });
    try {
      const res = await fetchFromFootballData(`/competitions/${comp}/matches`, c.env.FOOTBALL_DATA_API_KEY);
      if (res.ok) {
        const data = (await res.json()) as { matches: FDMatch[] };
        matches = data.matches.map(transformMatch);
        await kvPut(c.env.SCORES_KV, kvSchedule(comp), JSON.stringify(matches), { expirationTtl: 86400 });
      } else {
        return c.json({ matches: [] });
      }
    } catch {
      return c.json({ matches: [] });
    }
  }

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
// GET /api/team/:teamId/photos — player headshots from API-Football (30-day cache)
// ---------------------------------------------------------------------------

app.get("/api/team/:teamId/photos", async (c) => {
  const fdTeamId = c.req.param("teamId");
  if (!fdTeamId || !/^\d+$/.test(fdTeamId)) {
    return c.json({ error: "Invalid team ID" }, 400);
  }

  // 1. Check KV cache
  const cacheKey = `photos:${fdTeamId}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) {
    const parsed = safeParse(cached);
    if (parsed) return c.json(parsed);
  }

  if (!c.env.API_FOOTBALL_KEY) {
    return c.json({ photos: {} });
  }

  // 2. Find team name from any cached competition team data
  let teamName = "";
  for (const compCode of Object.keys(COMPETITIONS)) {
    const teamsCached = await c.env.SCORES_KV.get(`${compCode}:teams`);
    if (!teamsCached) continue;
    const teamsData = safeParse<{ teams: Array<{ id: number; name: string; shortName: string }> }>(teamsCached);
    const found = teamsData?.teams?.find((t) => String(t.id) === fdTeamId);
    if (found) {
      teamName = found.name;
      break;
    }
  }

  if (!teamName) {
    // Fallback: fetch team directly from football-data.org
    try {
      const fdRes = await fetchFromFootballData(`/teams/${fdTeamId}`, c.env.FOOTBALL_DATA_API_KEY);
      if (fdRes.ok) {
        const fdData = (await fdRes.json()) as { name?: string };
        teamName = fdData.name ?? "";
      }
    } catch { /* */ }
  }

  if (!teamName) {
    return c.json({ photos: {} });
  }

  // 3. Search API-Football for this team to get their AF team ID
  // Try multiple name variants: full name, then stripped suffixes
  const nameVariants = [teamName];
  const stripped = teamName.replace(/\s+(FC|CF|SC|AC|AS|SS|SV|BSC|1\..*|SK|FK|RC|SE|SL)$/i, "").trim();
  if (stripped !== teamName) nameVariants.push(stripped);

  let afTeamId: number | null = null;
  for (const searchName of nameVariants) {
    if (afTeamId) break;
    try {
      const searchRes = await fetchFromApiFootball(
        `/teams?search=${encodeURIComponent(searchName)}`,
        c.env.API_FOOTBALL_KEY,
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          response: Array<{ team: { id: number; name: string } }>;
        };
        if (searchData.response?.length > 0) {
          // Pick best match (exact name match or first result)
          const exact = searchData.response.find(
            (r) => r.team.name.toLowerCase() === searchName.toLowerCase(),
          );
          afTeamId = exact?.team.id ?? searchData.response[0]?.team.id ?? null;
        }
      }
    } catch { /* */ }
  }

  if (!afTeamId) {
    console.log(`[photos] No AF team found for "${teamName}" (fd:${fdTeamId}), tried: ${nameVariants.join(", ")}`);
    // Cache empty result for 1 day to avoid re-searching
    const empty = { photos: {} };
    await kvPut(c.env.SCORES_KV, cacheKey, JSON.stringify(empty), { expirationTtl: 86400 });
    return c.json(empty);
  }

  // 4. Fetch squad photos from API-Football
  const photos: Record<string, string> = {};
  try {
    const squadRes = await fetchFromApiFootball(
      `/players/squads?team=${afTeamId}`,
      c.env.API_FOOTBALL_KEY,
    );
    if (squadRes.ok) {
      const squadData = (await squadRes.json()) as {
        response: Array<{
          players: Array<{ id: number; name: string; photo: string }>;
        }>;
      };
      const players = squadData.response?.[0]?.players ?? [];
      for (const p of players) {
        if (p.photo) {
          photos[p.name] = p.photo;
        }
      }
    }
  } catch { /* */ }

  console.log(`[photos] Found ${Object.keys(photos).length} photos for "${teamName}" (fd:${fdTeamId}, af:${afTeamId})`);
  const result = { photos };

  // Cache for 30 days (squad photos rarely change)
  await kvPut(c.env.SCORES_KV, cacheKey, JSON.stringify(result), {
    expirationTtl: 2592000,
  });

  return c.json(result);
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

/** Article row from Supabase */
interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  ai_summary: string | null;
  full_content: string | null;
  scrape_failures: number;
  source_name: string;
  source_url: string;
  image_url: string | null;
  language: string;
  competition_id: string | null;
  team_tags: string[];
  is_featured: boolean;
  published_at: string;
  created_at: string;
  translations: Record<string, TranslationEntry> | null;
}

/** Overlay translation onto an article if available for the target language */
function applyTranslation(article: ArticleRow, targetLang: string): ArticleRow & { translated: boolean; original_language: string; has_full_content: boolean } {
  const original_language = article.language;
  const has_full_content = !!(article.full_content && article.full_content.trim().length > 0);
  // If article is already in target language, no translation needed
  if (article.language === targetLang) {
    return { ...article, translated: false, original_language, has_full_content };
  }
  // Check if translation exists
  const t = article.translations?.[targetLang];
  if (t) {
    return {
      ...article,
      title: t.title,
      summary: t.summary,
      // Only use translated full_content if it exists — do NOT fall back to original language
      full_content: t.full_content ?? null,
      translated: true,
      original_language,
      has_full_content,
    };
  }
  // No translation available — return original
  return { ...article, translated: false, original_language, has_full_content };
}

/** Helper: fetch articles from Supabase with filters */
async function fetchArticles(
  env: Env,
  params: {
    competitionId?: string;
    teamId?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    slug?: string;
    targetLang?: string; // language to translate results into
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

  const rows = (await res.json()) as ArticleRow[];
  const countHeader = res.headers.get("content-range");
  const count = countHeader ? parseInt(countHeader.split("/")[1] ?? "0", 10) : rows.length;

  // Enrich: prefer ai_summary over raw RSS summary for display
  const enriched = rows.map((r) => ({ ...r, summary: r.ai_summary || r.summary }));

  // Apply translations if target language specified
  const targetLang = params.targetLang;
  const data = targetLang
    ? enriched.map((r) => applyTranslation(r, targetLang))
    : enriched.map((r) => ({ ...r, translated: false, original_language: r.language, has_full_content: !!(r.full_content && r.full_content.trim().length > 0) }));

  return { data, count };
}

// GET /api/news — global news feed (lang = user's display language for translations)
app.get("/api/news", async (c) => {
  const lang = c.req.query("lang") ?? "en";
  const featured = c.req.query("featured") === "true";
  const limit = parseInt(c.req.query("limit") ?? "30", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const { data, count } = await fetchArticles(c.env, {
    featured: featured || undefined,
    limit,
    offset,
    targetLang: lang,
  });

  return c.json({ articles: data, total: count });
});

// GET /api/news/:slug — single article by slug
app.get("/api/news/:slug", async (c) => {
  const slug = c.req.param("slug");
  const lang = c.req.query("lang") ?? "en";
  const { data } = await fetchArticles(c.env, { slug, targetLang: lang });

  if (!data.length) {
    return c.json({ error: "Article not found" }, 404);
  }

  return c.json({ article: data[0] });
});

// GET /api/news/:slug/translate — on-demand full article translation
app.get("/api/news/:slug/translate", async (c) => {
  const slug = c.req.param("slug");
  const lang = c.req.query("lang");
  if (!lang) return c.json({ error: "lang parameter required" }, 400);

  // Fetch the article (no targetLang — we want the raw row)
  const { data } = await fetchArticles(c.env, { slug });
  if (!data.length) return c.json({ error: "Article not found" }, 404);

  const article = data[0] as ArticleRow & { translated: boolean };

  // If article is already in the target language, return as-is
  if (article.language === lang) {
    return c.json({
      title: article.title,
      summary: article.ai_summary || article.summary,
      full_content: article.full_content || null,
      cached: true,
    });
  }

  // Check if a complete translation already exists (including full_content if needed)
  const existing = article.translations?.[lang];
  const originalHasFullContent = !!(article.full_content && article.full_content.trim().length > 0);

  if (existing && (existing.full_content || !originalHasFullContent)) {
    // Translation is complete — return cached
    return c.json({
      title: existing.title,
      summary: existing.summary,
      full_content: existing.full_content ?? null,
      cached: true,
    });
  }

  // Reuse existing title+summary translation if available, only translate what's missing
  let translatedTitle: string;
  let translatedSummary: string;
  if (existing?.title && existing?.summary) {
    translatedTitle = existing.title;
    translatedSummary = existing.summary;
  } else {
    const summaryText = article.ai_summary || article.summary;
    const translated = await aiTranslate(c.env.AI, article.title, summaryText, lang, article.language);
    if (!translated) {
      return c.json({ error: "Translation failed" }, 500);
    }
    translatedTitle = translated.title;
    translatedSummary = translated.summary;
  }

  // Translate full_content paragraph-by-paragraph if it exists
  let translatedFullContent: string | null = null;
  if (originalHasFullContent) {
    translatedFullContent = await translateFullContent(
      c.env.AI, article.full_content!, lang, article.language,
    );
  }

  // Cache the complete translation in Supabase
  const entry: TranslationEntry = {
    title: translatedTitle,
    summary: translatedSummary,
    full_content: translatedFullContent ?? undefined,
  };
  const updatedTranslations = { ...(article.translations ?? {}), [lang]: entry };
  await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${article.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: c.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ translations: updatedTranslations }),
  });

  return c.json({
    title: translatedTitle,
    summary: translatedSummary,
    full_content: translatedFullContent,
    cached: false,
  });
});

// GET /api/:comp/news — competition-specific news
app.get("/api/:comp/news", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  const lang = c.req.query("lang") ?? "en";
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const { data, count } = await fetchArticles(c.env, {
    competitionId: comp,
    limit,
    offset,
    targetLang: lang,
  });

  return c.json({ articles: data, total: count });
});

// GET /api/team/:teamId/news — team-specific news
app.get("/api/team/:teamId/news", async (c) => {
  const teamId = c.req.param("teamId").toUpperCase();
  const lang = c.req.query("lang") ?? "en";
  const limit = parseInt(c.req.query("limit") ?? "15", 10);

  const { data, count } = await fetchArticles(c.env, {
    teamId,
    limit,
    targetLang: lang,
  });

  return c.json({ articles: data, total: count });
});

// ---------------------------------------------------------------------------
// GET /api/diag — temporary diagnostic endpoint
// ---------------------------------------------------------------------------

app.get("/api/diag", async (c) => {
  const results: Record<string, unknown> = {};

  // Check what's in KV
  const kvKeys = ["all:live", KV_TICK, KV_LAST_POLL];
  for (const comp of Object.keys(COMPETITIONS)) {
    kvKeys.push(kvScores(comp), kvStandings(comp), kvSchedule(comp));
  }
  const kvData: Record<string, string | null> = {};
  for (const k of kvKeys) {
    const v = await c.env.SCORES_KV.get(k);
    kvData[k] = v ? `${v.length} chars` : null;
  }
  results.kv = kvData;

  // Test KV write
  try {
    await c.env.SCORES_KV.put("diag:test", "ok", { expirationTtl: 60 });
    const readBack = await c.env.SCORES_KV.get("diag:test");
    results.kvWrite = readBack === "ok" ? "WORKING" : `READ_MISMATCH: ${readBack}`;
  } catch (e) {
    results.kvWrite = `FAILED: ${e}`;
  }

  // Test upstream API
  try {
    const testRes = await fetchFromFootballData("/matches", c.env.FOOTBALL_DATA_API_KEY);
    const status = testRes.status;
    if (testRes.ok) {
      const data = (await testRes.json()) as { matches: unknown[] };
      results.upstream = { status, matchCount: data.matches?.length ?? 0 };
    } else {
      const text = await testRes.text();
      results.upstream = { status, error: text.slice(0, 200) };
    }
  } catch (e) {
    results.upstream = { error: String(e) };
  }

  return c.json(results);
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
        "GET /api/news?lang=en",
        "GET /api/news/:slug?lang=en",
        "GET /api/news/:slug/translate?lang=fr",
        "GET /api/:comp/news?lang=en",
        "GET /api/team/:teamId/news?lang=en",
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
