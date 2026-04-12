import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { useCompetition } from "../../lib/CompetitionProvider";
import TeamCrest from "./TeamCrest";
import type { Team } from "../../types";
import type { StandingTeam } from "../../lib/api";

interface GroupTableProps {
  groupId: string;
  teams: Team[];
  standings?: StandingTeam[];
}

export default function GroupTable({ groupId, teams, standings }: GroupTableProps) {
  const { t, tTeam } = useI18n();
  const comp = useCompetition();

  // Build a lookup from TLA → standing row
  const standingMap = new Map<string, StandingTeam>();
  if (standings) {
    for (const s of standings) {
      standingMap.set(s.team.tla, s);
    }
  }

  // Sort teams by standing position when available
  const sorted = [...teams].sort((a, b) => {
    const sa = standingMap.get(a.fifaCode);
    const sb = standingMap.get(b.fifaCode);
    if (sa && sb) return sa.position - sb.position;
    return 0;
  });

  return (
    <div className="yc-card rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-yc-border flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-yc-green/10 flex items-center justify-center">
          <span className="text-yc-green text-xs font-bold font-mono">{groupId}</span>
        </div>
        <h3 className="font-heading text-base font-bold">
          {t("match.group", { id: "" })} {groupId}
        </h3>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider">
            <th className="text-left pl-4 pr-2 py-2">{t("groupTable.team")}</th>
            <th className="w-8 text-center py-2">{t("groupTable.played")}</th>
            <th className="w-8 text-center py-2">{t("groupTable.won")}</th>
            <th className="w-8 text-center py-2">{t("groupTable.drawn")}</th>
            <th className="w-8 text-center py-2">{t("groupTable.lost")}</th>
            <th className="w-10 text-center py-2">{t("groupTable.gd")}</th>
            <th className="w-10 text-center pr-4 py-2 font-bold">{t("groupTable.pts")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => {
            const s = standingMap.get(team.fifaCode);
            // Use numeric ID from standings for team page link (works with TeamPage)
            const teamPageId = s?.team.id;
            const teamUrl = teamPageId ? `/${comp.id}/team/${teamPageId}` : null;

            const row = (
              <div className="flex items-center gap-2">
                <TeamCrest
                  tla={team.fifaCode}
                  isoCode={team.isoCode}
                  size="sm"
                />
                <span className="text-yc-text-primary font-medium truncate">
                  {tTeam(team.id)}
                </span>
              </div>
            );

            return (
              <tr
                key={team.id}
                className={`border-t border-yc-border/30 transition-colors hover:bg-white/[0.02] ${i < 2 ? "bg-yc-green/[0.03]" : ""}`}
                style={i < 2 ? { borderInlineStart: "3px solid var(--yc-border-accent-bright)" } : undefined}
              >
                <td className="pl-4 pr-2 py-2.5">
                  {teamUrl ? (
                    <Link to={teamUrl} className="hover:text-yc-green transition-colors">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </td>
                <td className="text-center text-yc-text-secondary">{s?.playedGames ?? 0}</td>
                <td className="text-center text-yc-text-secondary">{s?.won ?? 0}</td>
                <td className="text-center text-yc-text-secondary">{s?.draw ?? 0}</td>
                <td className="text-center text-yc-text-secondary">{s?.lost ?? 0}</td>
                <td className="text-center text-yc-text-secondary">{s?.goalDifference ?? 0}</td>
                <td className="text-center pr-4 text-yc-green font-bold">{s?.points ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2 border-t border-yc-border/30">
        <p className="text-yc-text-tertiary text-[10px]">
          {t("groups.advanceNote")}
        </p>
      </div>
    </div>
  );
}
