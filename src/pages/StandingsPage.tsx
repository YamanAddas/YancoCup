import { useState, useEffect } from "react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import TeamCrest from "../components/match/TeamCrest";
import type { StandingsZones } from "../lib/competitions";

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

/** Colored dot for a single W/D/L result */
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

/** Form guide: last 5 results as colored dots */
function FormGuide({ form }: { form: string | null }) {
  if (!form) return <span className="text-yc-text-tertiary text-xs">—</span>;
  const results = form.split(",").slice(-5);
  return (
    <div className="flex items-center gap-0.5">
      {results.map((r, i) => (
        <FormDot key={i} result={r.trim()} />
      ))}
    </div>
  );
}

/** Returns the zone color class for a position */
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await globalThis.fetch(
          `${WORKER_URL}/api/${comp.id}/standings`,
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          standings: Array<{ table: StandingRow[] }>;
        };
        // League standings: first entry is TOTAL table
        const first = data.standings?.[0];
        if (first) {
          setStandings(first.table ?? []);
        }
      } catch {
        // Worker unreachable
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [comp.id]);

  const zones = comp.zones;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="font-heading text-2xl font-bold mb-6">
        {comp.shortName} — {t("nav.standings")}
      </h2>

      {loading ? (
        /* Skeleton loading matching table layout */
        <div className="space-y-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-3 border-b border-yc-border/30"
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
        <p className="text-yc-text-tertiary text-center py-16">
          {t("standings.noData")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                  <th className="text-left py-3 px-2 w-8">#</th>
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
                    className="border-b border-yc-border/50 hover:bg-yc-bg-elevated/30 transition-colors"
                    style={getZoneStyle(row.position, zones)}
                  >
                    <td className="py-2.5 px-2 text-yc-text-tertiary font-mono text-xs">
                      {row.position}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <TeamCrest
                          tla={row.team.tla}
                          crest={row.team.crest}
                          size="sm"
                        />
                        <span className="text-yc-text-primary font-medium truncate">
                          {row.team.shortName}
                        </span>
                      </div>
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
                      <FormGuide form={row.form} />
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
        </>
      )}
    </div>
  );
}
