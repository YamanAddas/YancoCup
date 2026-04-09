import { useGroups } from "../hooks/useGroups";
import { useTeams } from "../hooks/useTeams";
import { useI18n } from "../lib/i18n";
import GroupTable from "../components/match/GroupTable";
import type { Team } from "../types";

export default function GroupsPage() {
  const groups = useGroups();
  const allTeams = useTeams();
  const { t } = useI18n();

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
          />
        ))}
      </div>
    </div>
  );
}
