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
  homePlaceholder?: string;
  awayPlaceholder?: string;
  venueId: string;
  group: string | null;
  round: "group" | "round-of-32" | "round-of-16" | "quarterfinal" | "semifinal" | "third-place" | "final";
  matchday: number | null;
}
