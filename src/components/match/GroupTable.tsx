import { useI18n } from "../../lib/i18n";
import TeamCrest from "./TeamCrest";
import type { Team } from "../../types";

interface GroupTableProps {
  groupId: string;
  teams: Team[];
}

export default function GroupTable({ groupId, teams }: GroupTableProps) {
  const { t } = useI18n();

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-yc-border">
        <h3 className="font-heading text-base font-bold">
          {t("match.group", { id: "" })} <span className="text-yc-green">{groupId}</span>
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
          {teams.map((team, i) => (
            <tr
              key={team.id}
              className={`border-t border-yc-border/50 ${i < 2 ? "bg-yc-green-dark/10" : ""}`}
            >
              <td className="pl-4 pr-2 py-2.5">
                <div className="flex items-center gap-2">
                  <TeamCrest
                    tla={team.fifaCode}
                    isoCode={team.isoCode}
                    size="sm"
                  />
                  <span className="text-yc-text-primary font-medium truncate">
                    {team.name}
                  </span>
                </div>
              </td>
              <td className="text-center text-yc-text-secondary">0</td>
              <td className="text-center text-yc-text-secondary">0</td>
              <td className="text-center text-yc-text-secondary">0</td>
              <td className="text-center text-yc-text-secondary">0</td>
              <td className="text-center text-yc-text-secondary">0</td>
              <td className="text-center pr-4 text-yc-text-primary font-bold">0</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-2 border-t border-yc-border/50">
        <p className="text-yc-text-tertiary text-[10px]">
          {t("groups.advanceNote")}
        </p>
      </div>
    </div>
  );
}
