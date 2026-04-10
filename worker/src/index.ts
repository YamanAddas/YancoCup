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
        .replace(/&#0*39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
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

/** Translate using Llama 3.1 8B (better quality for Arabic) — with retry */
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
        max_tokens: 512,
      });
      const text = (result as { response?: string }).response?.trim();
      if (!text) { continue; }
      // Try multiple JSON extraction strategies
      let jsonStr = text;
      // Strip markdown fences
      jsonStr = jsonStr.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
      // Try to find JSON object in the response
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

/** Hybrid translate: m2m100 for all languages (purpose-built translator), Llama as fallback */
async function aiTranslate(
  ai: Ai,
  title: string,
  summary: string,
  targetLang: string,
  sourceLang: string = "en",
): Promise<{ title: string; summary: string } | null> {
  // m2m100 for all languages — it's a dedicated translation model with better quality
  const [tTitle, tSummary] = await Promise.all([
    m2m100Translate(ai, title, sourceLang, targetLang),
    m2m100Translate(ai, summary, sourceLang, targetLang),
  ]);
  if (tTitle && tSummary) return { title: tTitle, summary: tSummary };
  // Fallback to Llama if m2m100 fails
  return llamaTranslate(ai, title, summary, targetLang);
}

/** Translate an article into missing languages and merge with existing translations */
/** Translation entry — title + summary always, full_content when available */
interface TranslationEntry {
  title: string;
  summary: string;
  full_content?: string;
}

async function translateArticleMissing(
  env: Env,
  articleId: string,
  title: string,
  summary: string,
  originalLang: string,
  existingTranslations: Record<string, TranslationEntry> | null,
  fullContent?: string | null,
): Promise<{ translated: number; failed: number }> {
  const translations: Record<string, TranslationEntry> = {
    ...(existingTranslations ?? {}),
  };

  // Original language doesn't need translation
  translations[originalLang] = { title, summary, ...(fullContent ? { full_content: fullContent } : {}) };

  // Find which languages are missing title+summary translation
  const missing = SUPPORTED_LANGS.filter((l) => {
    if (!translations[l]) return true;
    return false;
  });
  if (missing.length === 0) return { translated: 0, failed: 0 };

  // Translate missing languages — sequentially for reliability, with delay between calls
  let translated = 0;
  let failed = 0;
  for (const lang of missing) {
    // Translate title + summary
    const result = await aiTranslate(env.AI, title, summary, lang, originalLang);
    if (result) {
      const entry: TranslationEntry = { title: result.title, summary: result.summary };
      // Note: full_content translation skipped — too expensive (15KB × 19 chunks × 5 langs).
      // Full article text displays in original language; title+summary are translated.
      translations[lang] = entry;
      translated++;
    } else {
      failed++;
      console.warn(`Translation failed: article=${articleId} lang=${lang}`);
    }
    // Small delay between translations to avoid rate limiting
    if (missing.indexOf(lang) < missing.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Save all translations (merged) to Supabase — always save even partial progress
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
        competition_id: detectCompetition(combinedText) ?? SOURCE_COMPETITION_HINT[a.sourceName] ?? null,
        team_tags: detectTeamTags(combinedText),
        is_featured: false,
        published_at: (() => { try { return new Date(a.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
      };
    });

    // 4. Insert all raw articles into Supabase
    // Batch in groups of 25 to avoid payload limits
    for (let i = 0; i < rawArticles.length; i += 25) {
      await insertArticles(env, rawArticles.slice(i, i + 25));
    }
    console.log(`News cron: inserted ${rawArticles.length} raw articles`);

    // 4b. Scrape full article content for articles that don't have it yet (limit 5 to leave CPU for translations)
    const scrapeRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/yc_articles?full_content=is.null&order=published_at.desc&limit=5&select=id,source_url`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    if (scrapeRes.ok) {
      const toScrape = (await scrapeRes.json()) as Array<{ id: string; source_url: string }>;
      console.log(`News cron: ${toScrape.length} articles need full content scraping`);

      let scraped = 0;
      for (const row of toScrape) {
        const fullText = await scrapeArticleText(row.source_url);
        // Save full_content (even empty string to mark as attempted, so we don't retry)
        await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ full_content: fullText ?? "" }),
        });
        if (fullText && fullText.length > 100) scraped++;
      }
      console.log(`News cron: scraped ${scraped}/${toScrape.length} full articles`);
    }

    // 5. Translate articles — both brand-new (NULL) and incomplete (missing languages)
    // Phase A: articles with no translations at all
    const nullRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/yc_articles?translations=is.null&order=published_at.desc&limit=50&select=id,title,summary,language,is_featured,translations,full_content`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    // Phase B: articles with partial translations (have translations but less than 6 keys)
    // Use RPC or filter for articles that exist but aren't complete
    const partialRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/yc_articles?translations=not.is.null&order=published_at.desc&limit=200&select=id,title,summary,language,is_featured,translations,full_content`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    const nullArticles = nullRes.ok ? ((await nullRes.json()) as Array<{
      id: string; title: string; summary: string;
      language: string; is_featured: boolean;
      translations: Record<string, TranslationEntry> | null;
      full_content: string | null;
    }>) : [];

    const partialArticlesRaw = partialRes.ok ? ((await partialRes.json()) as Array<{
      id: string; title: string; summary: string;
      language: string; is_featured: boolean;
      translations: Record<string, TranslationEntry> | null;
      full_content: string | null;
    }>) : [];

    // Filter to only articles missing at least one language
    const partialArticles = partialArticlesRaw.filter((a) => {
      const langCount = a.translations ? Object.keys(a.translations).length : 0;
      return langCount < SUPPORTED_LANGS.length;
    });

    // Cap per cron run to avoid CPU timeout (Worker free tier = 30s).
    // Prioritize new (null) articles, then oldest partial ones.
    const MAX_PER_CRON = 10;
    const allNeedWork = [...nullArticles, ...partialArticles].slice(0, MAX_PER_CRON);
    console.log(`News cron: ${nullArticles.length} untranslated + ${partialArticles.length} partial — processing ${allNeedWork.length} this run`);

    if (allNeedWork.length > 0) {
      // Mark top 8 new articles (by recency with description) as featured
      const featuredIds = new Set(
        nullArticles
          .filter((a) => a.summary.length > 80)
          .slice(0, 8)
          .map((a) => a.id),
      );

      let totalTranslated = 0;
      let totalFailed = 0;

      for (const row of allNeedWork) {
        // Mark as featured if in top 8
        if (featuredIds.has(row.id) && !row.is_featured) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: env.SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({ is_featured: true }),
          });
        }

        const { translated, failed } = await translateArticleMissing(
          env, row.id, row.title, row.summary, row.language, row.translations, row.full_content,
        );
        totalTranslated += translated;
        totalFailed += failed;

        const existing = row.translations ? Object.keys(row.translations).length : 0;
        console.log(`News cron: ${row.id} — had ${existing} langs, added ${translated}, failed ${failed} — "${row.title.slice(0, 40)}..."`);
      }

      console.log(`News cron: translation complete — ${totalTranslated} succeeded, ${totalFailed} failed across ${allNeedWork.length} articles`);
    }
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
  try {
    await handleNewsCron(c.env);
    return c.json({ status: "ok", message: "News cron triggered" });
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

  // Fetch articles that still need scraping
  const res = await fetch(
    `${c.env.SUPABASE_URL}/rest/v1/yc_articles?full_content=is.null&order=published_at.desc&limit=${limit}&offset=${offset}&select=id,source_url,source_name`,
    {
      headers: {
        apikey: c.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
      },
    },
  );

  if (!res.ok) return c.json({ error: "Failed to fetch articles" }, 500);

  const articles = (await res.json()) as Array<{ id: string; source_url: string; source_name: string }>;
  let scraped = 0;
  let failed = 0;
  const results: Array<{ source: string; len: number }> = [];

  for (const row of articles) {
    const fullText = await scrapeArticleText(row.source_url);
    await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: c.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ full_content: fullText ?? "" }),
    });
    if (fullText && fullText.length > 100) {
      scraped++;
      results.push({ source: row.source_name, len: fullText.length });
    } else {
      failed++;
    }
  }

  return c.json({ status: "ok", checked: articles.length, scraped, failed, results });
});

// Admin: backfill missing translations for all articles
app.get("/api/admin/backfill-translations", async (c) => {
  const key = c.req.query("key");
  if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") ?? "200", 10);
  const maxTranslate = parseInt(c.req.query("max") ?? "5", 10); // cap actual translations to avoid CPU timeout
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  // Fetch articles (up to limit) — use offset for paging through older articles
  const res = await fetch(
    `${c.env.SUPABASE_URL}/rest/v1/yc_articles?order=published_at.desc&limit=${limit}&offset=${offset}&select=id,title,summary,language,translations,full_content`,
    {
      headers: {
        apikey: c.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
      },
    },
  );

  if (!res.ok) return c.json({ error: "Failed to fetch articles" }, 500);

  const articles = (await res.json()) as Array<{
    id: string; title: string; summary: string; language: string;
    translations: Record<string, TranslationEntry> | null;
    full_content: string | null;
  }>;

  // Filter to articles missing at least one language
  const incomplete = articles.filter((a) => {
    const langCount = a.translations ? Object.keys(a.translations).length : 0;
    return langCount < SUPPORTED_LANGS.length;
  });

  // Only translate up to maxTranslate to stay within Worker CPU limits
  const toProcess = incomplete.slice(0, maxTranslate);

  let totalTranslated = 0;
  let totalFailed = 0;

  for (const row of toProcess) {
    const { translated, failed } = await translateArticleMissing(
      c.env, row.id, row.title, row.summary, row.language, row.translations, row.full_content,
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
  full_content: string | null;
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
function applyTranslation(article: ArticleRow, targetLang: string): ArticleRow & { translated: boolean; original_language: string } {
  const original_language = article.language;
  // If article is already in target language, no translation needed
  if (article.language === targetLang) {
    return { ...article, translated: false, original_language };
  }
  // Check if translation exists
  const t = article.translations?.[targetLang];
  if (t) {
    return {
      ...article,
      title: t.title,
      summary: t.summary,
      full_content: t.full_content ?? article.full_content,
      translated: true,
      original_language,
    };
  }
  // No translation available — return original
  return { ...article, translated: false, original_language };
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

  // Apply translations if target language specified
  const targetLang = params.targetLang;
  const data = targetLang
    ? rows.map((r) => applyTranslation(r, targetLang))
    : rows.map((r) => ({ ...r, translated: false, original_language: r.language }));

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

// POST /api/news/:slug/translate — on-demand translation for a single article
app.get("/api/news/:slug/translate", async (c) => {
  const slug = c.req.param("slug");
  const lang = c.req.query("lang");
  if (!lang) return c.json({ error: "lang parameter required" }, 400);

  // Fetch the article
  const { data } = await fetchArticles(c.env, { slug });
  if (!data.length) return c.json({ error: "Article not found" }, 404);

  const article = data[0] as ArticleRow & { translated: boolean };

  // Check if translation already exists
  const existing = article.translations?.[lang];
  if (existing) {
    return c.json({ title: existing.title, summary: existing.summary, cached: true });
  }

  // Translate on demand (hybrid: m2m100 for EU, Llama for Arabic)
  const translated = await aiTranslate(c.env.AI, article.title, article.summary, lang, article.language);
  if (!translated) {
    return c.json({ error: "Translation failed" }, 500);
  }

  // Cache the translation in Supabase
  const updatedTranslations = { ...(article.translations ?? {}), [lang]: translated };
  await fetch(`${c.env.SUPABASE_URL}/rest/v1/yc_articles?id=eq.${article.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: c.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ translations: updatedTranslations }),
  });

  return c.json({ title: translated.title, summary: translated.summary, cached: false });
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
