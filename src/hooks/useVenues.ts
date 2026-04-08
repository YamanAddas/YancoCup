import venuesData from "../data/venues.json";
import type { Venue } from "../types";

const venues = venuesData as Venue[];

export function useVenues(): Venue[] {
  return venues;
}

export function useVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

export function useVenueMap(): Map<string, Venue> {
  return new Map(venues.map((v) => [v.id, v]));
}
