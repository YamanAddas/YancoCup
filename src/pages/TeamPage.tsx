import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, User, MapPin, Calendar, Home, Plane, Newspaper, Clock, ExternalLink, Languages, Star, Activity, Users, ChevronDown } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { formatTimeWithTZ, getLocale } from "../lib/formatDate";
import TeamCrest from "../components/match/TeamCrest";
import { fetchTeamNews, WORKER_URL, type NewsArticle } from "../lib/api";
import { ArabesqueLattice, GeometricBand, StarDivider, CornerAccent } from "../components/ui/ArabesquePatterns";
import { Accordion } from "../components/ui/Accordion";

// ---------------------------------------------------------------------------
// Types — football-data.org /v4/competitions/{code}/teams response
// ---------------------------------------------------------------------------

interface Player {
  id: number;
  name: string;
  position: string | null;
  dateOfBirth: string | null;
  nationality: string;
  shirtNumber: number | null;
}

interface Coach {
  id: number;
  name: string;
  nationality: string;
}

interface TeamData {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  squad: Player[];
  coach: Coach | null;
}

interface MatchResult {
  apiId: number;
  utcDate: string;
  status: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

/** Country flag for player nationality — maps common names to ISO codes */
const NATIONALITY_MAP: Record<string, string> = {
  "England": "gb-eng", "Scotland": "gb-sct", "Wales": "gb-wls",
  "Northern Ireland": "gb-nir", "Spain": "es", "France": "fr",
  "Germany": "de", "Italy": "it", "Portugal": "pt", "Brazil": "br",
  "Argentina": "ar", "Netherlands": "nl", "Belgium": "be",
  "Croatia": "hr", "Uruguay": "uy", "Colombia": "co", "Mexico": "mx",
  "United States": "us", "Japan": "jp", "South Korea": "kr",
  "Australia": "au", "Canada": "ca", "Norway": "no", "Sweden": "se",
  "Denmark": "dk", "Switzerland": "ch", "Austria": "at", "Poland": "pl",
  "Czech Republic": "cz", "Czechia": "cz", "Turkey": "tr", "Greece": "gr",
  "Serbia": "rs", "Romania": "ro", "Ukraine": "ua", "Russia": "ru",
  "Nigeria": "ng", "Senegal": "sn", "Ghana": "gh", "Cameroon": "cm",
  "Egypt": "eg", "Morocco": "ma", "Algeria": "dz", "Tunisia": "tn",
  "Ivory Coast": "ci", "Côte d'Ivoire": "ci", "Mali": "ml",
  "DR Congo": "cd", "Guinea": "gn", "Burkina Faso": "bf",
  "Ireland": "ie", "Finland": "fi", "Hungary": "hu", "Slovakia": "sk",
  "Slovenia": "si", "Bulgaria": "bg", "Albania": "al", "Montenegro": "me",
  "North Macedonia": "mk", "Bosnia and Herzegovina": "ba", "Kosovo": "xk",
  "Iceland": "is", "Luxembourg": "lu", "Georgia": "ge", "Armenia": "am",
  "Israel": "il", "Chile": "cl", "Peru": "pe", "Ecuador": "ec",
  "Paraguay": "py", "Venezuela": "ve", "Bolivia": "bo", "Jamaica": "jm",
  "Costa Rica": "cr", "Honduras": "hn", "Panama": "pa", "El Salvador": "sv",
  "China PR": "cn", "Iran": "ir", "Saudi Arabia": "sa", "Qatar": "qa",
  "Iraq": "iq", "Uzbekistan": "uz",
};

function NationalityFlag({ nationality }: { nationality: string }) {
  const code = NATIONALITY_MAP[nationality];
  if (!code) return <span className="text-[9px] text-yc-text-tertiary">{nationality.slice(0, 3)}</span>;
  return <img src={`${FLAG_BASE}/${code}.svg`} alt={nationality} className="w-4 h-4 rounded-full" loading="lazy" />;
}

/** Normalize granular API positions to 4 broad groups */
function normalizePosition(pos: string): string {
  const p = pos.toLowerCase();
  if (p === "goalkeeper") return "Goalkeeper";
  if (p.includes("back") || p.includes("centre-back") || p.includes("defence")) return "Defence";
  if (p.includes("midfield") || p.includes("midfielder")) return "Midfield";
  if (p.includes("forward") || p.includes("winger") || p.includes("offence") || p.includes("striker")) return "Offence";
  return "Unknown";
}

const POS_ORDER: Record<string, number> = {
  Goalkeeper: 0, Defence: 1, Midfield: 2, Offence: 3, Unknown: 4,
};
const POS_LABELS: Record<string, string> = {
  Goalkeeper: "Goalkeepers", Defence: "Defenders", Midfield: "Midfielders", Offence: "Forwards", Unknown: "Other",
};
const POS_COLORS: Record<string, string> = {
  Goalkeeper: "text-amber-400", Defence: "text-sky-400", Midfield: "text-yc-green", Offence: "text-red-400", Unknown: "text-yc-text-tertiary",
};
const POS_BG: Record<string, string> = {
  Goalkeeper: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  Defence: "bg-sky-400/15 text-sky-400 border-sky-400/30",
  Midfield: "bg-yc-green/15 text-yc-green border-yc-green/30",
  Offence: "bg-red-400/15 text-red-400 border-red-400/30",
  Unknown: "bg-yc-bg-elevated text-yc-text-tertiary border-yc-border",
};

function PlayerAvatar({ name, position, photoUrl }: { name: string; position: string; photoUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colors = POS_BG[position] ?? POS_BG.Unknown!;

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-yc-border"
      />
    );
  }

  return (
    <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${colors}`}>
      <span className="text-[11px] font-bold font-mono leading-none">{initials}</span>
    </div>
  );
}

/**
 * Find a player photo by fuzzy name matching.
 * API-Football uses short names ("B. Saka", "Kepa") while football-data.org
 * uses full names ("Bukayo Saka", "Kepa Arrizabalaga"). We try multiple strategies.
 */
function findPhoto(name: string, photos: Record<string, string>): string | undefined {
  if (!name || Object.keys(photos).length === 0) return undefined;
  // Exact match
  if (photos[name]) return photos[name];
  const lower = name.toLowerCase();
  const entries = Object.entries(photos);
  // Case-insensitive exact
  for (const [k, v] of entries) {
    if (k.toLowerCase() === lower) return v;
  }
  const fdParts = lower.split(" ").filter(Boolean);
  if (fdParts.length === 0) return undefined;
  const fdLast = fdParts[fdParts.length - 1]!;
  const fdFirst = fdParts[0]!;
  for (const [k, v] of entries) {
    const afLower = k.toLowerCase();
    const afParts = afLower.split(" ").filter(Boolean);
    if (afParts.length === 0) continue;
    const afLast = afParts[afParts.length - 1]!;
    const afFirst = afParts[0]!;
    // Last name match: "Bukayo Saka" ↔ "B. Saka"
    if (fdLast.length > 2 && afLast === fdLast) return v;
    // AF single name is fd first name: "Kepa" ↔ "Kepa Arrizabalaga"
    if (afParts.length === 1 && afLower === fdFirst) return v;
    // FD single name is AF first name: "Gabriel" ↔ "Gabriel Magalhães"
    if (fdParts.length === 1 && lower === afFirst) return v;
    // AF "X. LastName" pattern: check initial matches fd first name
    if (afParts.length >= 2 && afFirst.length <= 2 && afFirst.endsWith(".")) {
      if (afLast === fdLast && fdFirst[0] === afFirst[0]) return v;
    }
  }
  return undefined;
}

function FormDot({ result }: { result: "W" | "D" | "L" }) {
  const colors = { W: "bg-yc-green", D: "bg-yc-text-tertiary", L: "bg-red-500" };
  return <span className={`inline-block w-3 h-3 rounded-full ${colors[result]}`} title={result} />;
}

/** Tiny line chart: W=top, D=mid, L=bottom. Replaces flat dots with a sparkline. */
function FormSparkline({ results }: { results: Array<"W" | "D" | "L"> }) {
  if (results.length < 2) return null;
  const h = 32;
  const pad = 6;
  const yMap = { W: pad, D: h / 2, L: h - pad };
  const n = results.length;
  const viewW = (n - 1) * 28 + pad * 2;
  const gap = (viewW - pad * 2) / (n - 1);
  const pts = results.map((r, i) => ({ x: pad + i * gap, y: yMap[r], r }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const fill = { W: "var(--color-yc-green)", D: "var(--color-yc-text-tertiary)", L: "var(--color-yc-danger)" };

  return (
    <svg viewBox={`0 0 ${viewW} ${h}`} className="w-full h-8" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--color-yc-border-hover)" strokeWidth="1.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={fill[p.r]} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface StandingEntry {
  position: number;
  team: { id: number; tla: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
}

// ---------------------------------------------------------------------------
// Team Newspaper — AI-curated news for this team
// ---------------------------------------------------------------------------

const LANG_LABELS: Record<string, string> = {
  en: "EN", ar: "AR", es: "ES", de: "DE", it: "IT", fr: "FR", pt: "PT",
};

// timeAgo removed — use relTime from useI18n() instead

function TeamNewspaper({ teamTla, teamName }: { teamTla: string; teamName: string; teamCrest: string }) {
  const { t, lang } = useI18n();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchTeamNews(teamTla, lang, { limit: 6 });
        setArticles(result.articles);
      } catch { /* */ }
      setLoading(false);
    }
    load();
  }, [teamTla, lang]);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="h-5 w-40 bg-yc-bg-elevated rounded animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-yc-bg-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  const heroArticle = articles[0]!;
  const sideArticles = articles.slice(1, 6);

  return (
    <div className="mb-8">
      {/* Newspaper header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[var(--yc-accent-dim)] flex items-center justify-center">
          <Newspaper size={14} className="text-yc-green" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-yc-text-primary font-heading">
            {teamName} — {t("news.title")}
          </h3>
          <p className="text-[10px] text-yc-text-tertiary">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hero article — left column */}
        <TeamNewsHero article={heroArticle} />

        {/* Side articles — right column */}
        <div className="space-y-2">
          {sideArticles.map((article) => (
            <TeamNewsCompact key={article.id} article={article} />
          ))}
        </div>
      </div>

      {/* Attribution */}
      <div className="flex items-center gap-1 text-[10px] text-yc-text-tertiary mt-3">
        <ExternalLink size={10} />
        {t("news.attribution")}
      </div>
    </div>
  );
}

function TeamNewsHero({ article }: { article: NewsArticle }) {
  const { relTime } = useI18n();
  const localTitle = article.title;
  const localSummary = article.summary;
  const isTranslated = article.translated;

  return (
    <Link to={`/news/${article.slug}`} className="block group">
      <div className="yc-card p-0 overflow-hidden h-full transition-all hover:border-[var(--yc-border-accent-bright)]">
        {article.image_url ? (
          <div className="h-36 overflow-hidden">
            <img
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        ) : (
          <div className="h-36 bg-gradient-to-br from-yc-bg-elevated to-yc-bg-surface flex items-center justify-center">
            <Newspaper size={28} className="text-yc-text-tertiary" />
          </div>
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isTranslated && (
              <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-yc-info bg-yc-bg-elevated px-1.5 py-0.5 rounded-full">
                <Languages size={9} /> {LANG_LABELS[article.original_language] ?? article.original_language}
              </span>
            )}
            {article.is_featured && (
              <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-semibold text-yc-green bg-[var(--yc-accent-dim)] px-1.5 py-0.5 rounded-full">
                <Star size={9} /> AI
              </span>
            )}
          </div>
          <h4 className="font-semibold text-sm text-yc-text-primary leading-snug line-clamp-2 group-hover:text-yc-green transition-colors">
            {localTitle}
          </h4>
          <p className="text-xs text-yc-text-secondary leading-relaxed line-clamp-3">{localSummary}</p>
          <div className="flex items-center justify-between text-[11px] text-yc-text-tertiary pt-0.5">
            <span>{article.source_name}</span>
            <span className="flex items-center gap-0.5"><Clock size={10} /> {relTime(article.published_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TeamNewsCompact({ article }: { article: NewsArticle }) {
  const { relTime } = useI18n();
  const localTitle = article.title;
  const isTranslated = article.translated;

  return (
    <Link to={`/news/${article.slug}`} className="block group">
      <div className="flex gap-3 p-2.5 rounded-xl bg-yc-bg-surface border border-yc-border/50 hover:border-[var(--yc-border-accent-bright)] transition-colors">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="w-16 h-16 rounded-lg object-cover shrink-0"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-yc-bg-elevated flex items-center justify-center shrink-0">
            <Newspaper size={14} className="text-yc-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isTranslated && (
              <span className="text-[8px] uppercase tracking-wider text-yc-info bg-yc-bg-elevated px-1 py-0.5 rounded">
                {LANG_LABELS[article.original_language]}
              </span>
            )}
          </div>
          <h4 className="text-xs font-medium text-yc-text-primary leading-snug line-clamp-2 group-hover:text-yc-green transition-colors">
            {localTitle}
          </h4>
          <div className="flex items-center gap-2 text-[10px] text-yc-text-tertiary">
            <span>{article.source_name}</span>
            <span className="flex items-center gap-0.5"><Clock size={9} /> {relTime(article.published_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Hero helpers
// ---------------------------------------------------------------------------

const TEAM_COLOR_MAP: Record<string, string> = {
  red: "#dc2626", blue: "#2563eb", "navy blue": "#1e3a5f", "royal blue": "#4169e1",
  white: "#94a3b8", black: "#334155", yellow: "#eab308", green: "#22c55e",
  orange: "#ea580c", claret: "#7b2e3b", purple: "#7c3aed", "sky blue": "#38bdf8",
  gold: "#d4a520", maroon: "#800000", crimson: "#b91c1c", scarlet: "#dc2626",
  violet: "#7c3aed", amber: "#f59e0b", pink: "#ec4899",
};

function parseTeamColor(clubColors: string | null): string | null {
  if (!clubColors) return null;
  const first = clubColors.split("/")[0]!.trim().toLowerCase();
  for (const [name, hex] of Object.entries(TEAM_COLOR_MAP)) {
    if (first.includes(name)) return hex;
  }
  return null;
}

const TEAM_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "fixtures", label: "Fixtures" },
  { id: "news", label: "News" },
  { id: "squad", label: "Squad" },
] as const;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const comp = useCompetition();
  const { t, lang, tTeam } = useI18n();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [leaguePosition, setLeaguePosition] = useState<StandingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string>>({});
  const [fixtureFilter, setFixtureFilter] = useState<"all" | "upcoming" | "results">("all");
  const [expandedPlayer, setExpandedPlayer] = useState<Record<string, number | null>>({});
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");

  // Fetch team data from /api/:comp/teams
  useEffect(() => {
    async function load() {
      if (!teamId) return;
      try {
        const res = await fetch(`${WORKER_URL}/api/${comp.id}/teams`);
        if (!res.ok) { setLoading(false); return; }
        const data = (await res.json()) as { teams: TeamData[] };
        const found = data.teams?.find((t) => String(t.id) === teamId);
        if (found) setTeam(found);
      } catch { /* */ }

      // Fetch matches for form guide + stats
      try {
        const res = await fetch(`${WORKER_URL}/api/${comp.id}/scores`);
        if (res.ok) {
          const data = (await res.json()) as { matches: MatchResult[] };
          setMatches(data.matches ?? []);
        }
      } catch { /* */ }

      // Fetch player photos from API-Football (non-blocking)
      fetch(`${WORKER_URL}/api/team/${teamId}/photos`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const photos = (d as { photos?: Record<string, string> })?.photos;
          if (photos && Object.keys(photos).length > 0) setPlayerPhotos(photos);
        })
        .catch(() => {});

      // Fetch standings for league position
      try {
        const res = await fetch(`${WORKER_URL}/api/${comp.id}/standings`);
        if (res.ok) {
          const data = (await res.json()) as { standings: Array<{ table: StandingEntry[] }> };
          const table = data.standings?.[0]?.table;
          if (table) {
            const entry = table.find((r) => String(r.team.id) === teamId);
            if (entry) setLeaguePosition(entry);
          }
        }
      } catch { /* */ }

      setLoading(false);
    }
    load();
  }, [teamId, comp.id]);

  // Hero visibility — show mini crest in sticky nav when hero scrolls out
  useEffect(() => {
    if (loading) return;
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setHeroVisible(!!e?.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  // Section scroll tracking — highlights active nav pill
  useEffect(() => {
    if (loading || !team) return;
    const els = TEAM_SECTIONS.map(s => document.getElementById(`section-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActiveSection(e.target.id.replace("section-", "")); } },
      { rootMargin: "-60px 0px -50% 0px", threshold: 0 },
    );
    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [loading, team]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  // Calculate form from recent matches
  const form = useMemo(() => {
    if (!team) return [];
    const tla = team.tla;
    const teamMatches = matches
      .filter((m) => m.status === "FINISHED" && (m.homeTeam === tla || m.awayTeam === tla))
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      .slice(0, 10);

    return teamMatches.map((m) => {
      const isHome = m.homeTeam === tla;
      const goalsFor = isHome ? m.homeScore : m.awayScore;
      const goalsAgainst = isHome ? m.awayScore : m.homeScore;
      const opponentTla = isHome ? m.awayTeam : m.homeTeam;
      const opponentCrest = isHome ? m.awayCrest : m.homeCrest;
      const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
      const result: "W" | "D" | "L" =
        goalsFor !== null && goalsAgainst !== null
          ? goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D"
          : "D";
      return { ...m, result, goalsFor, goalsAgainst, opponentTla, opponentCrest, opponentName, isHome };
    });
  }, [team, matches]);

  // Computed stats from match results
  const stats = useMemo(() => {
    if (!team || form.length === 0) return null;
    const tla = team.tla;
    const finishedAll = matches
      .filter((m) => m.status === "FINISHED" && (m.homeTeam === tla || m.awayTeam === tla))
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

    let cleanSheets = 0;
    let homeW = 0, homeD = 0, homeL = 0;
    let awayW = 0, awayD = 0, awayL = 0;
    let totalGoals = 0;
    let totalConceded = 0;

    for (const m of finishedAll) {
      const isHome = m.homeTeam === tla;
      const gf = isHome ? m.homeScore! : m.awayScore!;
      const ga = isHome ? m.awayScore! : m.homeScore!;
      totalGoals += gf;
      totalConceded += ga;
      if (ga === 0) cleanSheets++;
      const result = gf > ga ? "W" : gf < ga ? "L" : "D";
      if (isHome) { if (result === "W") homeW++; else if (result === "D") homeD++; else homeL++; }
      else { if (result === "W") awayW++; else if (result === "D") awayD++; else awayL++; }
    }

    // Current streak
    let streakResult = form[0]?.result;
    let streakCount = 0;
    for (const f of form) {
      if (f.result === streakResult) streakCount++;
      else break;
    }

    const totalWins = homeW + awayW;
    return {
      cleanSheets,
      homeRecord: `${homeW}W ${homeD}D ${homeL}L`,
      awayRecord: `${awayW}W ${awayD}D ${awayL}L`,
      goalsFor: totalGoals,
      goalsConceded: totalConceded,
      winRate: finishedAll.length > 0 ? Math.round((totalWins / finishedAll.length) * 100) : 0,
      goalsPerMatch: finishedAll.length > 0 ? (totalGoals / finishedAll.length).toFixed(1) : "0",
      streak: streakResult ? `${streakCount}${streakResult}` : null,
      played: finishedAll.length,
    };
  }, [team, matches, form]);

  // Upcoming matches
  const upcoming = useMemo(() => {
    if (!team) return [];
    const tla = team.tla;
    return matches
      .filter((m) => m.status === "TIMED" && (m.homeTeam === tla || m.awayTeam === tla))
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      .slice(0, 5);
  }, [team, matches]);

  // Played (finished) matches for fixtures section
  const played = useMemo(() => {
    if (!team) return [];
    const tla = team.tla;
    return matches
      .filter((m) => m.status === "FINISHED" && (m.homeTeam === tla || m.awayTeam === tla))
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
  }, [team, matches]);

  // Group squad by normalized position (4 broad groups)
  const squadByPosition = useMemo(() => {
    if (!team) return new Map<string, Player[]>();
    const map = new Map<string, Player[]>();
    for (const p of team.squad) {
      const pos = normalizePosition(p.position ?? "Unknown");
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    }
    // Sort by position order
    return new Map([...map.entries()].sort((a, b) =>
      (POS_ORDER[a[0]] ?? 99) - (POS_ORDER[b[0]] ?? 99)
    ));
  }, [team]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-6 w-24 bg-yc-bg-elevated rounded animate-pulse mb-6" />
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-yc-bg-elevated rounded-xl animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-40 bg-yc-bg-elevated rounded animate-pulse" />
            <div className="h-4 w-24 bg-yc-bg-elevated rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-yc-bg-elevated rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-yc-text-tertiary text-sm">Team not found.</p>
        <Link to={`/${comp.id}/standings`} className="mt-4 text-yc-green text-sm hover:underline inline-block">
          Back to standings
        </Link>
      </div>
    );
  }

  const displayName = (() => { const n = tTeam(team.name); return n !== team.name ? n : tTeam(team.tla); })();
  const teamColor = parseTeamColor(team.clubColors);

  return (
    <div>
      {/* ── Hero ── */}
      <div ref={heroRef} className="relative overflow-hidden">
        {teamColor && (
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 120% 80% at 50% 20%, ${teamColor}0a 0%, transparent 60%)` }} />
        )}
        <ArabesqueLattice className="absolute inset-0 text-yc-green opacity-[0.04] hidden sm:block" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-8 sm:pb-10">
          <Link
            to={`/${comp.id}/standings`}
            className="flex items-center gap-1.5 text-yc-text-tertiary hover:text-yc-text-primary text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            {comp.shortName} — {t("nav.standings")}
          </Link>

          <div className="flex items-center gap-5 mt-4">
            {/* Octagonal crest frame */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
              <div className="absolute inset-0 yc-octagonal" style={{ background: "var(--yc-border-accent)" }} />
              <div className="absolute inset-[2px] yc-octagonal bg-yc-bg-deep flex items-center justify-center overflow-hidden">
                <TeamCrest tla={team.tla} crest={team.crest} size="xl" />
              </div>
            </div>
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold">{displayName}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-yc-text-secondary">
                {team.coach && (
                  <span className="flex items-center gap-1">
                    <User size={14} className="text-yc-text-tertiary" />
                    {team.coach.name}
                  </span>
                )}
                {team.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-yc-text-tertiary" />
                    {team.venue}
                  </span>
                )}
                {team.founded && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-yc-text-tertiary" />
                    Est. {team.founded}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats bar with diamond dividers */}
          {leaguePosition && (
            <div className="flex items-center gap-2 sm:gap-3 mt-5 text-xs font-mono text-yc-text-secondary">
              <span className="text-yc-green font-bold text-sm">#{leaguePosition.position}</span>
              <StarDivider className="opacity-30 mx-0.5" />
              <span>{leaguePosition.points} pts</span>
              <StarDivider className="opacity-30 mx-0.5" />
              <span>{leaguePosition.playedGames}P</span>
              <StarDivider className="opacity-30 mx-0.5" />
              <span>{leaguePosition.won}W {leaguePosition.draw}D {leaguePosition.lost}L</span>
            </div>
          )}

          {/* Form dots */}
          {form.length > 0 && (
            <div className="flex gap-1.5 mt-3">
              {form.slice(0, 5).map((m, i) => (
                <FormDot key={i} result={m.result} />
              ))}
            </div>
          )}
        </div>

        <GeometricBand className="absolute bottom-0 left-0 w-full text-yc-green opacity-[0.06]" />
      </div>

      {/* ── Sticky section nav ── */}
      <nav className="sticky top-0 z-30 border-b border-yc-border" style={{ background: "var(--yc-bg-glass)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center h-12 overflow-x-auto">
          <div className={`shrink-0 mr-3 transition-all duration-200 overflow-hidden ${heroVisible ? "w-0 opacity-0" : "w-6 opacity-100"}`}>
            <TeamCrest tla={team.tla} crest={team.crest} size="xs" />
          </div>
          <div className="flex gap-1">
            {TEAM_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? "bg-yc-green/15 text-yc-green"
                    : "text-yc-text-secondary hover:text-yc-text-primary hover:bg-yc-bg-elevated/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Overview accordion (default open) ── */}
        <Accordion
          id="section-overview"
          icon={<Activity size={16} />}
          title="Overview"
          summary={leaguePosition ? `#${leaguePosition.position} · ${leaguePosition.points}pts` : undefined}
          defaultOpen
        >
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
            {/* Left column — next match + form */}
            <div className="lg:col-span-3 space-y-4">
              {/* Next Match card */}
              {upcoming.length > 0 && (() => {
                const nm = upcoming[0]!;
                const isHome = nm.homeTeam === team.tla;
                const opCrest = isHome ? nm.awayCrest : nm.homeCrest;
                const opName = isHome ? nm.awayTeamName : nm.homeTeamName;
                const opTla = isHome ? nm.awayTeam : nm.homeTeam;
                const date = new Date(nm.utcDate);
                return (
                  <Link
                    to={`/${comp.id}/match/${nm.apiId}`}
                    className="block relative overflow-hidden rounded-xl border border-yc-border/50 p-4 transition-all hover:border-[var(--yc-border-accent-bright)]"
                    style={{ background: "var(--yc-bg-glass-light)" }}
                  >
                    <CornerAccent position="top-right" className="text-yc-green opacity-[0.06]" />
                    <CornerAccent position="bottom-left" className="text-yc-green opacity-[0.06]" />
                    <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">Next Match</span>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TeamCrest tla={team.tla} crest={team.crest} size="sm" />
                        <span className="text-xs text-yc-text-secondary">{isHome ? "vs" : "@"}</span>
                        {opCrest && <TeamCrest tla={opTla ?? "?"} crest={opCrest} size="sm" />}
                        <span className="text-sm text-yc-text-primary font-medium truncate">
                          {(() => { if (opName) { const n = tTeam(opName); if (n !== opName) return n; } return tTeam(opTla ?? "?"); })()}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-yc-text-secondary">
                          {date.toLocaleDateString(getLocale(lang), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                        </div>
                        <div className="text-xs font-mono text-yc-green">{formatTimeWithTZ(date, lang)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-yc-green bg-yc-green/10 px-2.5 py-1 rounded-full">
                        Predict
                      </span>
                    </div>
                  </Link>
                );
              })()}

              {/* Form sparkline */}
              {form.length >= 2 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-yc-text-tertiary mb-2">Form</h4>
                  <FormSparkline results={form.slice(0, 10).map(f => f.result)} />
                  <div className="flex gap-1 mt-1.5">
                    {form.slice(0, 10).map((f, i) => <FormDot key={i} result={f.result} />)}
                  </div>
                </div>
              )}

              {/* Recent 3 results */}
              {form.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-yc-text-tertiary mb-2">Recent Results</h4>
                  <div className="space-y-1">
                    {form.slice(0, 3).map((m) => {
                      const date = new Date(m.utcDate);
                      return (
                        <div key={m.apiId} className="flex items-center gap-3 px-3 py-2 bg-yc-bg-surface border border-yc-border/50 rounded-lg text-sm">
                          <FormDot result={m.result} />
                          <span className="text-xs text-yc-text-tertiary w-16 shrink-0">
                            {date.toLocaleDateString(getLocale(lang), { month: "short", day: "numeric", timeZone: "UTC" })}
                          </span>
                          <span className="text-yc-text-secondary text-xs w-6 text-center">{m.isHome ? "H" : "A"}</span>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {m.opponentCrest && <TeamCrest tla={m.opponentTla ?? "?"} crest={m.opponentCrest} size="xs" />}
                            <span className="text-yc-text-primary truncate">{(() => { if (m.opponentName) { const n = tTeam(m.opponentName); if (n !== m.opponentName) return n; } return tTeam(m.opponentTla ?? "?"); })()}</span>
                          </div>
                          <span className="font-mono font-bold text-yc-text-primary shrink-0">{m.goalsFor}-{m.goalsAgainst}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — position + stats */}
            <div className="lg:col-span-2 space-y-4">
              {/* League position */}
              {leaguePosition && (
                <div className="yc-card p-4 rounded-xl text-center">
                  <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">League Position</span>
                  <div className={`font-heading text-4xl font-bold mt-1 ${
                    leaguePosition.position <= 4 ? "text-yc-green" :
                    leaguePosition.position <= 6 ? "text-yc-info" :
                    leaguePosition.position >= 18 ? "text-yc-danger" : "text-yc-text-primary"
                  }`}>
                    #{leaguePosition.position}
                  </div>
                  <div className="text-xs text-yc-text-secondary mt-1">
                    {leaguePosition.points} pts · {leaguePosition.playedGames} played
                  </div>
                </div>
              )}

              {/* Stats grid 2×2 */}
              {stats && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="yc-card p-3 rounded-xl">
                    <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider block">Scored</span>
                    <span className="font-heading text-xl font-bold text-yc-green">{stats.goalsFor}</span>
                  </div>
                  <div className="yc-card p-3 rounded-xl">
                    <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider block">Conceded</span>
                    <span className="font-heading text-xl font-bold text-yc-danger">{stats.goalsConceded}</span>
                  </div>
                  <div className="yc-card p-3 rounded-xl">
                    <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider block">Clean Sheets</span>
                    <span className="font-heading text-xl font-bold text-yc-text-primary">{stats.cleanSheets}</span>
                  </div>
                  <div className="yc-card p-3 rounded-xl">
                    <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider block">Win Rate</span>
                    <span className="font-heading text-xl font-bold text-yc-text-primary">{stats.winRate}%</span>
                  </div>
                </div>
              )}

              {/* Streak + H/A records */}
              {stats && (
                <div className="space-y-2">
                  {stats.streak && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                      stats.streak.endsWith("W") ? "bg-yc-green/10 text-yc-green border-yc-green/20" :
                      stats.streak.endsWith("L") ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-yc-bg-elevated text-yc-text-secondary border-yc-border"
                    }`}>
                      {stats.streak} streak
                    </span>
                  )}
                  <div className="flex gap-3 text-xs text-yc-text-secondary">
                    <span className="flex items-center gap-1"><Home size={12} className="text-yc-text-tertiary" /> {stats.homeRecord}</span>
                    <span className="flex items-center gap-1"><Plane size={12} className="text-yc-text-tertiary" /> {stats.awayRecord}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Accordion>

        {/* ── Fixtures accordion ── */}
        <Accordion
          id="section-fixtures"
          icon={<Calendar size={16} />}
          title="Fixtures"
          count={upcoming.length + played.length > 0 ? upcoming.length + played.length : undefined}
          summary={[upcoming.length > 0 && `${upcoming.length} upcoming`, played.length > 0 && `${played.length} played`].filter(Boolean).join(", ") || "No fixtures"}
        >
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 mb-3">
            {(["all", "upcoming", "results"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFixtureFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  fixtureFilter === f
                    ? "bg-yc-green/15 text-yc-green border border-yc-green/20"
                    : "text-yc-text-secondary border border-yc-border/50 hover:text-yc-text-primary hover:border-[var(--yc-border-accent)]"
                }`}
              >
                {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : "Results"}
              </button>
            ))}
          </div>

          {(() => {
            const showUpcoming = fixtureFilter === "all" || fixtureFilter === "upcoming";
            const showResults = fixtureFilter === "all" || fixtureFilter === "results";
            const upcomingList = showUpcoming ? upcoming : [];
            const resultsList = showResults ? played : [];
            const allFixtures = [...upcomingList.map(m => ({ ...m, type: "upcoming" as const })), ...resultsList.map(m => ({ ...m, type: "result" as const }))];

            if (allFixtures.length === 0) {
              return <p className="text-sm text-yc-text-tertiary">No fixtures to show.</p>;
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {allFixtures.map((m) => {
                  const isHome = m.homeTeam === team.tla;
                  const opCrest = isHome ? m.awayCrest : m.homeCrest;
                  const opName = isHome ? m.awayTeamName : m.homeTeamName;
                  const opTla = isHome ? m.awayTeam : m.homeTeam;
                  const date = new Date(m.utcDate);

                  // Result color for left border
                  let borderColor = "border-l-yc-border";
                  if (m.type === "result" && m.homeScore != null && m.awayScore != null) {
                    const gf = isHome ? m.homeScore : m.awayScore;
                    const ga = isHome ? m.awayScore : m.homeScore;
                    borderColor = gf > ga ? "border-l-yc-green" : gf < ga ? "border-l-yc-danger" : "border-l-yc-warning";
                  }

                  return (
                    <Link
                      key={m.apiId}
                      to={`/${comp.id}/match/${m.apiId}`}
                      className={`block rounded-xl border border-yc-border/50 border-l-[3px] ${borderColor} p-3 transition-all hover:border-[var(--yc-border-accent-bright)]`}
                      style={{ background: "var(--yc-bg-glass-light)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">
                          {date.toLocaleDateString(getLocale(lang), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                        </span>
                        <span className="text-[10px] text-yc-text-tertiary">{isHome ? "Home" : "Away"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <TeamCrest tla={team.tla} crest={team.crest} size="sm" />
                        <span className="text-xs text-yc-text-tertiary">vs</span>
                        {opCrest && <TeamCrest tla={opTla ?? "?"} crest={opCrest} size="sm" />}
                        <span className="text-sm text-yc-text-primary font-medium truncate flex-1">
                          {(() => { if (opName) { const n = tTeam(opName); if (n !== opName) return n; } return tTeam(opTla ?? "?"); })()}
                        </span>
                        {m.type === "result" && m.homeScore != null && m.awayScore != null ? (
                          <span className="font-mono font-bold text-sm text-yc-text-primary shrink-0">
                            {isHome ? m.homeScore : m.awayScore}–{isHome ? m.awayScore : m.homeScore}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-yc-green shrink-0">{formatTimeWithTZ(date, lang)}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </Accordion>

        {/* ── News accordion ── */}
        <Accordion
          id="section-news"
          icon={<Newspaper size={16} />}
          title="News"
          summary="Latest stories"
        >
          <TeamNewspaper teamTla={team.tla} teamName={displayName} teamCrest={team.crest} />
        </Accordion>

        {/* ── Squad accordion ── */}
        <Accordion
          id="section-squad"
          icon={<Users size={16} />}
          title="Squad"
          count={team.squad.length > 0 ? team.squad.length : undefined}
        >
          {team.squad.length > 0 ? (
            <div className="space-y-1">
              {[...squadByPosition.entries()].map(([position, players]) => {
                const isGroupOpen = expandedPlayer[position] !== undefined;
                return (
                  <div key={position}>
                    {/* Position group header with geometric left border */}
                    <button
                      onClick={() => setExpandedPlayer((prev) => {
                        const next = { ...prev };
                        if (position in next) { delete next[position]; } else { next[position] = null; }
                        return next;
                      })}
                      className="w-full flex items-center gap-2.5 py-2.5 cursor-pointer group"
                    >
                      {/* Geometric left accent — interlocking diamonds */}
                      <svg aria-hidden="true" width="4" height="20" viewBox="0 0 4 20" className={`shrink-0 ${POS_COLORS[position] ?? "text-yc-text-tertiary"} opacity-50`}>
                        <path d="M2 0L4 3L2 6L0 3Z M2 7L4 10L2 13L0 10Z M2 14L4 17L2 20L0 17Z" fill="currentColor" />
                      </svg>
                      <span className={`text-xs font-medium uppercase tracking-wider ${POS_COLORS[position] ?? "text-yc-text-tertiary"}`}>
                        {POS_LABELS[position] ?? position}
                      </span>
                      <span className="text-[10px] font-mono text-yc-text-tertiary">{players.length}</span>
                      <span className="flex-1" />
                      <ChevronDown size={14} className={`text-yc-text-tertiary transition-transform duration-200 ${isGroupOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Player list — collapsible */}
                    <div className={`grid ${isGroupOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]`}>
                      <div className={`overflow-hidden min-h-0 transition-opacity duration-150 ${isGroupOpen ? "opacity-100" : "opacity-0"}`}>
                        <div className="space-y-0.5 pb-2">
                          {players.map((p) => {
                            const isExpanded = expandedPlayer[position] === p.id;
                            const age = p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : null;
                            return (
                              <div key={p.id}>
                                <button
                                  onClick={() => setExpandedPlayer((prev) => ({
                                    ...prev,
                                    [position]: prev[position] === p.id ? null : p.id,
                                  }))}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                                    isExpanded ? "bg-yc-bg-elevated/50" : "hover:bg-yc-bg-elevated/30"
                                  }`}
                                >
                                  <PlayerAvatar name={p.name} position={position} photoUrl={findPhoto(p.name, playerPhotos)} />
                                  <span className="text-xs font-mono text-yc-text-tertiary w-6 text-center shrink-0">{p.shirtNumber ?? "—"}</span>
                                  <span className="text-sm text-yc-text-primary font-medium truncate flex-1 text-left">{p.name}</span>
                                  <NationalityFlag nationality={p.nationality} />
                                  {age != null && <span className="text-[11px] text-yc-text-tertiary font-mono shrink-0">{age}</span>}
                                </button>

                                {/* Expandable detail strip */}
                                <div className={`grid ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]`}>
                                  <div className={`overflow-hidden min-h-0 transition-opacity duration-150 ${isExpanded ? "opacity-100" : "opacity-0"}`}>
                                    <div className="flex items-center gap-4 px-3 py-2 ml-12 text-xs text-yc-text-secondary border-l-2 border-yc-border">
                                      <span className="flex items-center gap-1.5">
                                        <NationalityFlag nationality={p.nationality} />
                                        {p.nationality}
                                      </span>
                                      {p.position && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${POS_BG[position] ?? ""}`}>
                                          {p.position}
                                        </span>
                                      )}
                                      {p.dateOfBirth && (
                                        <span className="text-yc-text-tertiary">
                                          Born {new Date(p.dateOfBirth).toLocaleDateString(getLocale(lang), { year: "numeric", month: "short", day: "numeric" })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-yc-text-tertiary">Squad data unavailable.</p>
          )}
        </Accordion>

      </div>
    </div>
  );
}
