/** Competition configuration registry */

export interface StandingsZones {
  cl: number[];         // Champions League qualification spots
  el: number[];         // Europa League spots
  ecl: number[];        // Conference League spots
  relegation: number[]; // Relegation positions
}

export interface CompetitionConfig {
  id: string;
  fdCode: string;
  fdId: number;
  name: string;
  shortName: string;
  type: "tournament" | "league";
  hasGroups: boolean;
  staticSchedule: boolean;
  seasonLabel: string;
  emoji: string; // short text icon, not actual emoji
  accentColor: string; // subtle per-competition tint
  zones?: StandingsZones;
}

export const COMPETITIONS: Record<string, CompetitionConfig> = {
  WC: {
    id: "WC",
    fdCode: "WC",
    fdId: 2000,
    name: "FIFA World Cup 2026",
    shortName: "World Cup",
    type: "tournament",
    hasGroups: true,
    staticSchedule: true,
    seasonLabel: "2026",
    emoji: "WC",
    accentColor: "#00ff88",
  },
  CL: {
    id: "CL",
    fdCode: "CL",
    fdId: 2001,
    name: "UEFA Champions League",
    shortName: "Champions League",
    type: "tournament",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "CL",
    accentColor: "#1a56db",
  },
  PL: {
    id: "PL",
    fdCode: "PL",
    fdId: 2021,
    name: "Premier League",
    shortName: "Premier League",
    type: "league",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "PL",
    accentColor: "#37003c",
    zones: { cl: [1, 2, 3, 4], el: [5], ecl: [6], relegation: [18, 19, 20] },
  },
  PD: {
    id: "PD",
    fdCode: "PD",
    fdId: 2014,
    name: "La Liga",
    shortName: "La Liga",
    type: "league",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "PD",
    accentColor: "#ee8707",
    zones: { cl: [1, 2, 3, 4], el: [5, 6], ecl: [7], relegation: [18, 19, 20] },
  },
  BL1: {
    id: "BL1",
    fdCode: "BL1",
    fdId: 2002,
    name: "Bundesliga",
    shortName: "Bundesliga",
    type: "league",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "BL",
    accentColor: "#d20515",
    zones: { cl: [1, 2, 3, 4], el: [5], ecl: [6], relegation: [16, 17, 18] },
  },
  SA: {
    id: "SA",
    fdCode: "SA",
    fdId: 2019,
    name: "Serie A",
    shortName: "Serie A",
    type: "league",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "SA",
    accentColor: "#024494",
    zones: { cl: [1, 2, 3, 4], el: [5, 6], ecl: [7], relegation: [18, 19, 20] },
  },
  FL1: {
    id: "FL1",
    fdCode: "FL1",
    fdId: 2015,
    name: "Ligue 1",
    shortName: "Ligue 1",
    type: "league",
    hasGroups: false,
    staticSchedule: false,
    seasonLabel: "2025/26",
    emoji: "L1",
    accentColor: "#091c3e",
    zones: { cl: [1, 2, 3], el: [4], ecl: [5], relegation: [16, 17, 18] },
  },
  EC: {
    id: "EC",
    fdCode: "EC",
    fdId: 2018,
    name: "European Championship",
    shortName: "EURO",
    type: "tournament",
    hasGroups: true,
    staticSchedule: false,
    seasonLabel: "2028",
    emoji: "EC",
    accentColor: "#003399",
  },
};

/** Ordered list of competitions for display */
export const COMPETITION_LIST: CompetitionConfig[] =
  Object.values(COMPETITIONS);

/** Get a competition config by ID, or undefined */
export function getCompetition(id: string): CompetitionConfig | undefined {
  return COMPETITIONS[id.toUpperCase()];
}

/** Check if a competition ID is valid */
export function isValidCompetition(id: string): boolean {
  return id.toUpperCase() in COMPETITIONS;
}
