import { useMemo } from "react";
import scheduleData from "../data/schedule.json";
import type { Match } from "../types";

const matches = scheduleData as Match[];

export interface ScheduleFilters {
  group?: string;
  team?: string;
  date?: string;
  venueId?: string;
  round?: Match["round"];
}

export function useSchedule(filters?: ScheduleFilters): Match[] {
  return useMemo(() => {
    if (!filters) return matches;

    return matches.filter((m) => {
      if (filters.group && m.group !== filters.group) return false;
      if (filters.team && m.homeTeam !== filters.team && m.awayTeam !== filters.team) return false;
      if (filters.date && m.date !== filters.date) return false;
      if (filters.venueId && m.venueId !== filters.venueId) return false;
      if (filters.round && m.round !== filters.round) return false;
      return true;
    });
  }, [filters?.group, filters?.team, filters?.date, filters?.venueId, filters?.round]);
}

export function useMatch(id: number): Match | undefined {
  return useMemo(() => matches.find((m) => m.id === id), [id]);
}
