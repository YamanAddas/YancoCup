import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, User, MapPin, Calendar, Shield, TrendingUp, Home, Plane, Newspaper, Clock, ExternalLink, Languages, Star } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { formatTimeWithTZ, getLocale } from "../lib/formatDate";
import TeamCrest from "../components/match/TeamCrest";
import { fetchTeamNews, WORKER_URL, type NewsArticle } from "../lib/api";

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

    for (const m of finishedAll) {
      const isHome = m.homeTeam === tla;
      const gf = isHome ? m.homeScore! : m.awayScore!;
      const ga = isHome ? m.awayScore! : m.homeScore!;
      totalGoals += gf;
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

    return {
      cleanSheets,
      homeRecord: `${homeW}W ${homeD}D ${homeL}L`,
      awayRecord: `${awayW}W ${awayD}D ${awayL}L`,
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Back */}
      <Link
        to={`/${comp.id}/standings`}
        className="flex items-center gap-1.5 text-yc-text-tertiary hover:text-yc-text-primary text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        {comp.shortName} — {t("nav.standings")}
      </Link>

      {/* Team header */}
      <div className="flex items-center gap-4 mb-8">
        <TeamCrest tla={team.tla} crest={team.crest} size="xl" />
        <div>
          <h2 className="font-heading text-2xl font-bold">{(() => { const n = tTeam(team.name); return n !== team.name ? n : tTeam(team.tla); })()}</h2>
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

      {/* Stats cards */}
      {(leaguePosition || stats) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {leaguePosition && (
            <div className="yc-card p-3 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-yc-green" />
                <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider">Position</span>
              </div>
              <span className="font-heading text-xl font-bold text-yc-green">#{leaguePosition.position}</span>
              <span className="text-xs text-yc-text-tertiary ml-1">{leaguePosition.points} pts</span>
            </div>
          )}
          {stats && (
            <>
              <div className="yc-card p-3 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield size={12} className="text-yc-text-tertiary" />
                  <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider">Clean Sheets</span>
                </div>
                <span className="font-heading text-xl font-bold text-yc-text-primary">{stats.cleanSheets}</span>
                <span className="text-xs text-yc-text-tertiary ml-1">/ {stats.played}</span>
              </div>
              <div className="yc-card p-3 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Home size={12} className="text-yc-text-tertiary" />
                  <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider">Home</span>
                </div>
                <span className="font-mono text-sm font-bold text-yc-text-primary">{stats.homeRecord}</span>
              </div>
              <div className="yc-card p-3 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Plane size={12} className="text-yc-text-tertiary" />
                  <span className="text-[10px] text-yc-text-tertiary uppercase tracking-wider">Away</span>
                </div>
                <span className="font-mono text-sm font-bold text-yc-text-primary">{stats.awayRecord}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Streak + goals/match */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-6">
          {stats.streak && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              stats.streak.endsWith("W") ? "bg-yc-green/10 text-yc-green border-yc-green/20" :
              stats.streak.endsWith("L") ? "bg-red-500/10 text-red-400 border-red-500/20" :
              "bg-yc-bg-elevated text-yc-text-secondary border-yc-border"
            }`}>
              {stats.streak.endsWith("W") ? "🔥" : stats.streak.endsWith("L") ? "📉" : "➡️"} {stats.streak} streak
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yc-bg-elevated text-yc-text-secondary border border-yc-border">
            {stats.goalsPerMatch} goals/match
          </span>
        </div>
      )}

      {/* Form guide */}
      {form.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
            Recent Form
          </h3>
          <div className="flex gap-1 mb-3">
            {form.map((m, i) => (
              <FormDot key={i} result={m.result} />
            ))}
          </div>
          <div className="space-y-1">
            {form.slice(0, 5).map((m) => {
              const date = new Date(m.utcDate);
              return (
                <div key={m.apiId} className="flex items-center gap-3 px-3 py-2 bg-yc-bg-surface border border-yc-border/50 rounded-lg text-sm">
                  <FormDot result={m.result} />
                  <span className="text-xs text-yc-text-tertiary w-16 shrink-0">
                    {date.toLocaleDateString(getLocale(lang), { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-yc-text-secondary text-xs w-6 text-center">{m.isHome ? "H" : "A"}</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {m.opponentCrest && (
                      <TeamCrest tla={m.opponentTla ?? "?"} crest={m.opponentCrest} size="xs" />
                    )}
                    <span className="text-yc-text-primary truncate">{(() => { if (m.opponentName) { const n = tTeam(m.opponentName); if (n !== m.opponentName) return n; } return tTeam(m.opponentTla ?? "?"); })()}</span>
                  </div>
                  <span className="font-mono font-bold text-yc-text-primary shrink-0">
                    {m.goalsFor}-{m.goalsAgainst}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming fixtures */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
            Upcoming Fixtures
          </h3>
          <div className="space-y-1">
            {upcoming.map((m) => {
              const isHome = m.homeTeam === team.tla;
              const opCrest = isHome ? m.awayCrest : m.homeCrest;
              const opName = isHome ? m.awayTeamName : m.homeTeamName;
              const opTla = isHome ? m.awayTeam : m.homeTeam;
              const date = new Date(m.utcDate);
              return (
                <div key={m.apiId} className="flex items-center gap-3 px-3 py-2 bg-yc-bg-surface border border-yc-border/50 rounded-lg text-sm">
                  <span className="text-xs text-yc-text-tertiary w-16 shrink-0">
                    {date.toLocaleDateString(getLocale(lang), { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-yc-text-secondary text-xs w-6 text-center">{isHome ? "H" : "A"}</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {opCrest && <TeamCrest tla={opTla ?? "?"} crest={opCrest} size="xs" />}
                    <span className="text-yc-text-primary truncate">{(() => { if (opName) { const n = tTeam(opName); if (n !== opName) return n; } return tTeam(opTla ?? "?"); })()}</span>
                  </div>
                  <span className="text-xs text-yc-text-tertiary">
                    {formatTimeWithTZ(date, lang)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Newspaper — AI-curated news */}
      <TeamNewspaper teamTla={team.tla} teamName={(() => { const n = tTeam(team.name); return n !== team.name ? n : tTeam(team.tla); })()} teamCrest={team.crest} />

      {/* Squad */}
      {team.squad.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
            Squad ({team.squad.length} players)
          </h3>
          {[...squadByPosition.entries()].map(([position, players]) => (
            <div key={position} className="mb-4">
              <p className={`text-xs font-medium uppercase tracking-wider mb-1.5 ${POS_COLORS[position] ?? "text-yc-text-tertiary"}`}>
                {POS_LABELS[position] ?? position}
              </p>
              <div className="space-y-1">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-yc-bg-elevated/30 transition-colors"
                  >
                    <PlayerAvatar name={p.name} position={position} photoUrl={findPhoto(p.name, playerPhotos)} />
                    <span className="text-xs font-mono text-yc-text-tertiary w-6 text-center shrink-0">
                      {p.shirtNumber ?? "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-yc-text-primary font-medium truncate block">{p.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <NationalityFlag nationality={p.nationality} />
                        <span className="text-[11px] text-yc-text-tertiary">{p.nationality}</span>
                        {p.dateOfBirth && (
                          <span className="text-[11px] text-yc-text-tertiary">
                            · {new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()} yrs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
