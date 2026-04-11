import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useGroups } from "../hooks/useGroups";
import { useTeams } from "../hooks/useTeams";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { fetchStandings } from "../lib/api";
import type { StandingTeam } from "../lib/api";
import GroupTable from "../components/match/GroupTable";
import type { Team } from "../types";

export default function GroupsPage() {
  const groups = useGroups();
  const allTeams = useTeams();
  const comp = useCompetition();
  const { t } = useI18n();

  // Guard: redirect to standings if competition doesn't have groups
  if (!comp.hasGroups) {
    return <Navigate to={`/${comp.id}/standings`} replace />;
  }
  const [groupStandings, setGroupStandings] = useState<Map<string, StandingTeam[]>>(new Map());

  useEffect(() => {
    async function load() {
      const standings = await fetchStandings(comp.id);
      if (standings.length === 0) return;

      const map = new Map<string, StandingTeam[]>();
      for (const g of standings) {
        // API returns group as "GROUP_A" etc — extract the letter
        const groupId = g.group?.replace(/^GROUP_/, "") ?? "";
        if (groupId) {
          map.set(groupId, g.table);
        }
      }
      setGroupStandings(map);
    }
    load();
  }, [comp.id]);

  const teamsByGroup = new Map<string, Team[]>();
  for (const team of allTeams) {
    const existing = teamsByGroup.get(team.group);
    if (existing) existing.push(team);
    else teamsByGroup.set(team.group, [team]);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <p className="text-yc-text-tertiary text-sm mb-4">
        {t("groups.subtitle")}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((g) => (
          <GroupTable
            key={g.id}
            groupId={g.id}
            teams={teamsByGroup.get(g.id) ?? []}
            standings={groupStandings.get(g.id)}
          />
        ))}
      </div>
    </div>
  );
}
