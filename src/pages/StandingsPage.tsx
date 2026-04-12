import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { fetchScorers } from "../lib/api";
import type { Scorer } from "../lib/api";
import TeamCrest from "../components/match/TeamCrest";
import type { StandingsZones } from "../lib/competitions";
import { Target, ArrowUp, ArrowDown, Info } from "lucide-react";
import { WORKER_URL } from "../lib/api";
import StateError from "../components/shared/StateError";

type SortKey = "position" | "playedGames" | "won" | "draw" | "lost" | "goalsFor" | "goalsAgainst" | "goalDifference" | "points";
type SortDir = "asc" | "desc";

interface StandingRow {
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

interface MatchScore {
  apiId: number;
  utcDate: string;
  status: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

function FormDot({ result }: { result: string }) {
  const colors: Record<string, string> = {
    W: "bg-yc-green",
    D: "bg-yc-text-tertiary",
    L: "bg-red-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[result] ?? "bg-yc-bg-elevated"}`}
      title={result}
    />
  );
}

function FormGuide({ form }: { form: string | null }) {
  if (!form) return <span className="text-yc-text-tertiary text-xs">—</span>;
  const results = (form.includes(",") ? form.split(",") : form.split("")).slice(-5);
  return (
    <div className="flex items-center gap-0.5">
      {results.map((r, i) => (
        <FormDot key={i} result={r.trim()} />
      ))}
    </div>
  );
}

function getZoneStyle(position: number, zones?: StandingsZones) {
  if (!zones) return {};
  if (zones.cl.includes(position))
    return { borderLeft: "3px solid #00ff88", background: "rgba(0,255,136,0.04)" };
  if (zones.el.includes(position))
    return { borderLeft: "3px solid #f59e0b", background: "rgba(245,158,11,0.04)" };
  if (zones.ecl.includes(position))
    return { borderLeft: "3px solid #38bdf8", background: "rgba(56,189,248,0.04)" };
  if (zones.relegation.includes(position))
    return { borderLeft: "3px solid #ef4444", background: "rgba(239,68,68,0.04)" };
  return {};
}

function SortHeader({ k, label, current, dir, onClick, className }: {
  k: SortKey; label: string; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void; className?: string;
}) {
  const active = current === k;
  return (
    <th
      className={`${className ?? ""} cursor-pointer select-none hover:text-yc-text-secondary transition-colors`}
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  );
}

export default function StandingsPage() {
  const comp = useCompetition();
  const { t, tTeam } = useI18n();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadStandings(silent = false) {
    let cancelled = false;

    async function doLoad() {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [standingsRes, scoresRes] = await Promise.all([
          globalThis.fetch(`${WORKER_URL}/api/${comp.id}/standings`),
          globalThis.fetch(`${WORKER_URL}/api/${comp.id}/scores`),
        ]);

        if (cancelled) return;

        if (standingsRes.ok) {
          const data = (await standingsRes.json()) as {
            standings: Array<{ table: StandingRow[] }>;
          };
          const first = data.standings?.[0];
          if (first) setStandings(first.table ?? []);
        } else if (!silent) {
          setError(`Failed to load standings (${standingsRes.status})`);
        }

        if (scoresRes.ok) {
          const data = (await scoresRes.json()) as { matches: MatchScore[] };
          setMatchScores(data.matches ?? []);
        }
      } catch {
        if (!cancelled && !silent) setError("Could not reach server");
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Fetch scorers (non-blocking)
      if (!cancelled) fetchScorers(comp.id).then((s) => { if (!cancelled) setScorers(s); });
    }

    doLoad();
    return () => { cancelled = true; };
  }

  useEffect(() => {
    const cancel = loadStandings();

    // Auto-refresh standings every 5 minutes
    const interval = setInterval(() => loadStandings(true), 5 * 60_000);
    return () => { cancel(); clearInterval(interval); };
  }, [comp.id]);

  // Calculate form per team from match results
  const formMap = useMemo(() => {
    const map = new Map<string, string>();
    if (matchScores.length === 0) return map;

    const finished = matchScores
      .filter((m) => m.status === "FINISHED" && m.homeScore !== null && m.awayScore !== null)
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

    // Collect all TLAs from standings
    const tlas = new Set(standings.map((r) => r.team.tla));

    for (const tla of tlas) {
      const teamMatches = finished
        .filter((m) => m.homeTeam === tla || m.awayTeam === tla)
        .slice(0, 5);

      const results = teamMatches.map((m) => {
        const isHome = m.homeTeam === tla;
        const gf = (isHome ? m.homeScore : m.awayScore) ?? 0;
        const ga = (isHome ? m.awayScore : m.homeScore) ?? 0;
        return gf > ga ? "W" : gf < ga ? "L" : "D";
      });

      if (results.length > 0) {
        map.set(tla, results.join(","));
      }
    }
    return map;
  }, [matchScores, standings]);

  const zones = comp.zones;

  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "position" ? "asc" : "desc");
    }
  }, [sortKey]);

  const sortedStandings = useMemo(() => {
    if (sortKey === "position" && sortDir === "asc") return standings;
    return [...standings].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [standings, sortKey, sortDir]);

  // Points gap to nearest zone boundary (for title/safety indicators)
  const gapMap = useMemo(() => {
    const map = new Map<number, { label: string; gap: number }>();
    if (!zones || standings.length === 0) return map;

    // Find zone boundary positions
    const clLast = Math.max(...zones.cl, 0);
    const relFirst = zones.relegation.length > 0 ? Math.min(...zones.relegation) : 0;

    for (const row of standings) {
      if (clLast > 0 && row.position > clLast && row.position <= clLast + 3) {
        // Teams just below CL zone
        const targetPts = standings.find((r) => r.position === clLast)?.points ?? 0;
        const gap = targetPts - row.points;
        if (gap > 0) map.set(row.position, { label: "CL", gap });
      }
      if (relFirst > 0 && row.position >= relFirst - 3 && row.position < relFirst) {
        // Teams just above relegation
        const targetPts = standings.find((r) => r.position === relFirst)?.points ?? 0;
        const gap = row.points - targetPts;
        if (gap >= 0) map.set(row.position, { label: "safe", gap });
      }
    }
    return map;
  }, [standings, zones]);

  // "If season ended today" banner data
  const seasonBanner = useMemo(() => {
    if (!zones || standings.length === 0) return null;
    const totalRounds = comp.type === "league" ? (standings.length - 1) * 2 : 0;
    if (totalRounds === 0) return null;
    const maxPlayed = Math.max(...standings.map((r) => r.playedGames));
    if (maxPlayed < 3 || maxPlayed >= totalRounds) return null; // too early or season over
    const pct = Math.round((maxPlayed / totalRounds) * 100);
    return { matchday: maxPlayed, total: totalRounds, pct };
  }, [standings, zones, comp.type]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {loading ? (
        <div className="yc-card rounded-xl overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-yc-border/30"
            >
              <div className="w-5 h-4 bg-yc-bg-elevated rounded animate-pulse" />
              <div className="w-6 h-6 bg-yc-bg-elevated rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-yc-bg-elevated rounded animate-pulse max-w-[140px]" />
              <div className="w-8 h-4 bg-yc-bg-elevated rounded animate-pulse" />
              <div className="w-8 h-4 bg-yc-bg-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="yc-card rounded-xl">
          <StateError onRetry={() => loadStandings()} />
        </div>
      ) : standings.length === 0 ? (
        <div className="yc-card p-12 rounded-xl text-center">
          <p className="text-yc-text-tertiary">{t("standings.noData")}</p>
        </div>
      ) : (
        <>
          {/* "If season ended today" banner */}
          {seasonBanner && zones && (
            <div className="yc-card rounded-xl p-4 mb-4 flex items-center gap-3">
              <Info size={16} className="text-yc-info shrink-0" />
              <div className="text-sm">
                <span className="text-yc-text-primary font-medium">
                  {t("standings.ifEnded")}
                </span>
                <span className="text-yc-text-secondary ms-2">
                  {t("standings.matchdayProgress", { current: seasonBanner.matchday, total: seasonBanner.total, pct: seasonBanner.pct })}
                </span>
              </div>
            </div>
          )}

          <div className="yc-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                  <SortHeader k="position" label="#" current={sortKey} dir={sortDir} onClick={handleSort} className="text-start py-3 px-3 w-8" />
                  <th className="text-start py-3 px-2">{t("groupTable.team")}</th>
                  <SortHeader k="playedGames" label={t("groupTable.played")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-8" />
                  <SortHeader k="won" label={t("groupTable.won")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-8" />
                  <SortHeader k="draw" label={t("groupTable.drawn")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-8" />
                  <SortHeader k="lost" label={t("groupTable.lost")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-8" />
                  <SortHeader k="goalsFor" label={t("standings.gf")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-10 hidden sm:table-cell" />
                  <SortHeader k="goalsAgainst" label={t("standings.ga")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-10 hidden sm:table-cell" />
                  <SortHeader k="goalDifference" label={t("groupTable.gd")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-10" />
                  <SortHeader k="points" label={t("groupTable.pts")} current={sortKey} dir={sortDir} onClick={handleSort} className="text-center py-3 px-2 w-10 font-bold" />
                  <th className="text-center py-3 px-2 w-20 hidden md:table-cell">{t("stats.form")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((row) => (
                  <tr
                    key={row.position}
                    className="border-b border-yc-border/30 hover:bg-white/[0.02] transition-colors"
                    style={getZoneStyle(row.position, zones)}
                  >
                    <td className="py-2.5 px-3 text-yc-text-tertiary font-mono text-xs">
                      {row.position}
                    </td>
                    <td className="py-2.5 px-2">
                      <Link
                        to={`/${comp.id}/team/${row.team.id}`}
                        className="flex items-center gap-2 hover:text-yc-green transition-colors"
                      >
                        <TeamCrest
                          tla={row.team.tla}
                          crest={row.team.crest}
                          size="sm"
                        />
                        <span className="font-medium truncate">
                          {(() => { const n = tTeam(row.team.name); return n !== row.team.name ? n : tTeam(row.team.tla); })()}
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                      {row.playedGames}
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                      {row.won}
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                      {row.draw}
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                      {row.lost}
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary hidden sm:table-cell">
                      {row.goalsFor}
                    </td>
                    <td className="py-2.5 px-2 text-center text-yc-text-secondary hidden sm:table-cell">
                      {row.goalsAgainst}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      <span className={row.goalDifference > 0 ? "text-yc-green" : row.goalDifference < 0 ? "text-red-400" : "text-yc-text-secondary"}>
                        {row.goalDifference > 0 ? "+" : ""}{row.goalDifference}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-yc-green">
                      <span>{row.points}</span>
                      {gapMap.has(row.position) && (
                        <span className={`ms-1 text-[9px] font-normal ${
                          gapMap.get(row.position)!.label === "CL" ? "text-yc-text-tertiary" : "text-yc-warning"
                        }`} title={
                          gapMap.get(row.position)!.label === "CL"
                            ? `${gapMap.get(row.position)!.gap} pts from CL`
                            : `${gapMap.get(row.position)!.gap} pts above relegation`
                        }>
                          {gapMap.get(row.position)!.label === "CL" ? `-${gapMap.get(row.position)!.gap}` : `+${gapMap.get(row.position)!.gap}`}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center hidden md:table-cell">
                      <FormGuide form={formMap.get(row.team.tla) ?? row.form} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Zone legend */}
          {zones && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-yc-text-tertiary">
              {zones.cl.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yc-green" />
                  {t("standings.clZone")}
                </span>
              )}
              {zones.el.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t("standings.elZone")}
                </span>
              )}
              {zones.ecl.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  {t("standings.eclZone")}
                </span>
              )}
              {zones.relegation.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {t("standings.relegation")}
                </span>
              )}
            </div>
          )}
          {/* Top Scorers */}
          {scorers.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-yc-green" />
                <h3 className="font-heading text-lg font-bold">{t("stats.topScorers")}</h3>
              </div>
              <div className="yc-card rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                      <th className="text-start py-3 px-3 w-8">#</th>
                      <th className="text-start py-3 px-2">{t("stats.player")}</th>
                      <th className="text-start py-3 px-2 hidden sm:table-cell">{t("stats.team")}</th>
                      <th className="text-center py-3 px-2 w-10">{t("stats.mp")}</th>
                      <th className="text-center py-3 px-2 w-10 font-bold">{t("stats.goals")}</th>
                      <th className="text-center py-3 px-2 w-10">{t("stats.assists")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorers.slice(0, 10).map((s, i) => (
                      <tr
                        key={s.player.id}
                        className="border-b border-yc-border/30 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 px-3 text-yc-text-tertiary font-mono text-xs">
                          {i + 1}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-yc-text-primary">{s.player.name}</span>
                        </td>
                        <td className="py-2.5 px-2 hidden sm:table-cell">
                          <Link
                            to={`/${comp.id}/team/${s.team.id}`}
                            className="flex items-center gap-1.5 hover:text-yc-green transition-colors"
                          >
                            <TeamCrest tla={s.team.tla} crest={s.team.crest} size="xs" />
                            <span className="text-yc-text-secondary text-xs truncate">{(() => { const n = tTeam(s.team.name); return n !== s.team.name ? n : tTeam(s.team.tla); })()}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                          {s.playedMatches}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-yc-green">
                          {s.goals ?? 0}
                        </td>
                        <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                          {s.assists ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
