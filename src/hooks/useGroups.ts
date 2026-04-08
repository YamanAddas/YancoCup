import groupsData from "../data/groups.json";
import type { Group } from "../types";

const groups = groupsData as Group[];

export function useGroups(): Group[] {
  return groups;
}

export function useGroup(id: string): Group | undefined {
  return groups.find((g) => g.id === id);
}
