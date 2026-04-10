export interface Team {
  id: string;
  name: string;
  fifaCode: string;
  isoCode: string;
  confederation: string;
  group: string;
}

export interface Group {
  id: string;
  teams: string[];
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  isoCode: string;
  capacity: number;
  lat: number;
  lng: number;
}

export interface Match {
  id: number;
  date: string;
  time: string;
  homeTeam: string | null;
  awayTeam: string | null;
  /** football-data.org numeric team ID (for linking to team pages) */
  homeTeamId?: number | null;
  /** football-data.org numeric team ID (for linking to team pages) */
  awayTeamId?: number | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  /** football-data.org crest URL for home team (clubs only) */
  homeCrest?: string | null;
  /** football-data.org crest URL for away team (clubs only) */
  awayCrest?: string | null;
  /** Full display name for home team (e.g., "Arsenal") */
  homeTeamName?: string | null;
  /** Full display name for away team (e.g., "Chelsea") */
  awayTeamName?: string | null;
  /** Match status from API (TIMED, FINISHED, IN_PLAY, etc.) */
  status?: string;
  /** Full-time home score (league matches from Worker) */
  homeScore?: number | null;
  /** Full-time away score (league matches from Worker) */
  awayScore?: number | null;
  venueId: string;
  group: string | null;
  round: "group" | "playoff" | "round-of-32" | "round-of-16" | "quarterfinal" | "semifinal" | "third-place" | "final";
  matchday: number | null;
}
