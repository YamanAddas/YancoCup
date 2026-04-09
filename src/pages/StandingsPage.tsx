import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { fetchScorers } from "../lib/api";
import type { Scorer } from "../lib/api";
import TeamCrest from "../components/match/TeamCrest";
import type { StandingsZones } from "../lib/competitions";
import { Target } from "lucide-react";

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ??
  "https://yancocup-api.catbyte1985.workers.dev";

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

export default function StandingsPage() {
  const comp = useCompetition();
  const { t } = useI18n();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [standingsRes, scoresRes] = await Promise.all([
          globalThis.fetch(`${WORKER_URL}/api/${comp.id}/standings`),
          globalThis.fetch(`${WORKER_URL}/api/${comp.id}/scores`),
        ]);

        if (standingsRes.ok) {
          const data = (await standingsRes.json()) as {
            standings: Array<{ table: StandingRow[] }>;
          };
          const first = data.standings?.[0];
          if (first) setStandings(first.table ?? []);
        }

        if (scoresRes.ok) {
          const data = (await scoresRes.json()) as { matches: MatchScore[] };
          setMatchScores(data.matches ?? []);
        }
      } catch {
        // Worker unreachable
      } finally {
        setLoading(false);
      }

      // Fetch scorers (non-blocking)
      fetchScorers(comp.id).then((s) => setScorers(s));
    }
    load();
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
        const gf = isHome ? m.homeScore! : m.awayScore!;
        const ga = isHome ? m.awayScore! : m.homeScore!;
        return gf > ga ? "W" : gf < ga ? "L" : "D";
      });

      if (results.length > 0) {
        map.set(tla, results.join(","));
      }
    }
    return map;
  }, [matchScores, standings]);

  const zones = comp.zones;

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
      ) : standings.length === 0 ? (
        <div className="yc-card p-12 rounded-xl text-center">
          <p className="text-yc-text-tertiary">{t("standings.noData")}</p>
        </div>
      ) : (
        <>
          <div className="yc-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                  <th className="text-left py-3 px-3 w-8">#</th>
                  <th className="text-left py-3 px-2">{t("groupTable.team")}</th>
                  <th className="text-center py-3 px-2 w-8">{t("groupTable.played")}</th>
                  <th className="text-center py-3 px-2 w-8">{t("groupTable.won")}</th>
                  <th className="text-center py-3 px-2 w-8">{t("groupTable.drawn")}</th>
                  <th className="text-center py-3 px-2 w-8">{t("groupTable.lost")}</th>
                  <th className="text-center py-3 px-2 w-10 hidden sm:table-cell">GF</th>
                  <th className="text-center py-3 px-2 w-10 hidden sm:table-cell">GA</th>
                  <th className="text-center py-3 px-2 w-10">{t("groupTable.gd")}</th>
                  <th className="text-center py-3 px-2 w-10 font-bold">{t("groupTable.pts")}</th>
                  <th className="text-center py-3 px-2 w-20 hidden md:table-cell">Form</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
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
                          {row.team.shortName}
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
                      {row.points}
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
                  Champions League
                </span>
              )}
              {zones.el.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Europa League
                </span>
              )}
              {zones.ecl.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Conference League
                </span>
              )}
              {zones.relegation.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Relegation
                </span>
              )}
            </div>
          )}
          {/* Top Scorers */}
          {scorers.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-yc-green" />
                <h3 className="font-heading text-lg font-bold">Top Scorers</h3>
              </div>
              <div className="yc-card rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                      <th className="text-left py-3 px-3 w-8">#</th>
                      <th className="text-left py-3 px-2">Player</th>
                      <th className="text-left py-3 px-2 hidden sm:table-cell">Team</th>
                      <th className="text-center py-3 px-2 w-10">MP</th>
                      <th className="text-center py-3 px-2 w-10 font-bold">G</th>
                      <th className="text-center py-3 px-2 w-10">A</th>
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
                            <span className="text-yc-text-secondary text-xs truncate">{s.team.shortName}</span>
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
