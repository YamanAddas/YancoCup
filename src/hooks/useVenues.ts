import { useMemo } from "react";
import venuesData from "../data/venues.json";
import type { Venue } from "../types";

const venues = venuesData as Venue[];

export function useVenues(): Venue[] {
  return useMemo(() => venues, []);
}

export function useVenue(id: string): Venue | undefined {
  return useMemo(() => venues.find((v) => v.id === id), [id]);
}

export function useVenueMap(): Map<string, Venue> {
  return useMemo(() => new Map(venues.map((v) => [v.id, v])), []);
}
