import { useState, useEffect } from "react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ??
  "https://yancocup-api.catbyte1985.workers.dev";

interface StandingRow {
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

export default function StandingsPage() {
  const comp = useCompetition();
  const { t } = useI18n();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
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
    fetch();
  }, [comp.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="font-heading text-2xl font-bold mb-6">
        {comp.shortName} — {t("nav.standings")}
      </h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin" />
        </div>
      ) : standings.length === 0 ? (
        <p className="text-yc-text-tertiary text-center py-16">
          {t("standings.noData")}
        </p>
      ) : (
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
                <th className="text-center py-3 px-2 w-10">GF</th>
                <th className="text-center py-3 px-2 w-10">GA</th>
                <th className="text-center py-3 px-2 w-10">{t("groupTable.gd")}</th>
                <th className="text-center py-3 px-2 w-10 font-bold">{t("groupTable.pts")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr
                  key={row.position}
                  className="border-b border-yc-border/50 hover:bg-yc-bg-elevated/30 transition-colors"
                >
                  <td className="py-2.5 px-2 text-yc-text-tertiary">
                    {row.position}
                  </td>
                  <td className="py-2.5 px-2 font-medium">
                    <span className="text-yc-text-secondary text-xs mr-2 font-mono">
                      {row.team.tla}
                    </span>
                    {row.team.shortName}
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
                  <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                    {row.goalsFor}
                  </td>
                  <td className="py-2.5 px-2 text-center text-yc-text-secondary">
                    {row.goalsAgainst}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono">
                    {row.goalDifference > 0 ? "+" : ""}
                    {row.goalDifference}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-yc-green">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
