import { useMemo } from "react";
import teamsData from "../data/teams.json";
import type { Team } from "../types";

const teams = teamsData as Team[];

export function useTeams(groupId?: string): Team[] {
  return useMemo(
    () => (groupId ? teams.filter((t) => t.group === groupId) : teams),
    [groupId],
  );
}

export function useTeam(id: string): Team | undefined {
  return useMemo(() => teams.find((t) => t.id === id), [id]);
}

export function useTeamMap(): Map<string, Team> {
  return useMemo(() => new Map(teams.map((t) => [t.id, t])), []);
}
