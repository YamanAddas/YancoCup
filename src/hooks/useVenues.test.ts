import { describe, it, expect } from "vitest";
import venuesData from "../data/venues.json";
import scheduleData from "../data/schedule.json";

interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  isoCode: string;
  capacity: number;
  lat: number;
  lng: number;
}

interface Match {
  venueId: string;
}

const venues = venuesData as Venue[];
const matches = scheduleData as Match[];

function getVenues(): Venue[] {
  return venues;
}

function getVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

function getVenueMap(): Map<string, Venue> {
  return new Map(venues.map((v) => [v.id, v]));
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("getVenues (useVenues logic)", () => {
  it("returns 16 venues", () => {
    expect(getVenues()).toHaveLength(16);
  });

  it("each venue has all required fields", () => {
    getVenues().forEach((v) => {
      expect(v.id).toBeTruthy();
      expect(v.name).toBeTruthy();
      expect(v.city).toBeTruthy();
      expect(v.country).toBeTruthy();
      expect(v.isoCode).toBeTruthy();
      expect(v.capacity).toBeGreaterThan(0);
      expect(v.lat).toBeGreaterThanOrEqual(-90);
      expect(v.lat).toBeLessThanOrEqual(90);
      expect(v.lng).toBeGreaterThanOrEqual(-180);
      expect(v.lng).toBeLessThanOrEqual(180);
    });
  });

  it("venues span three host countries", () => {
    const countries = new Set(venues.map((v) => v.country));
    expect(countries).toContain("Mexico");
    expect(countries).toContain("Canada");
    expect(countries).toContain("USA");
    expect(countries.size).toBe(3);
  });
});

describe("getVenue (useVenue logic)", () => {
  it("finds Estadio Akron by id", () => {
    const v = getVenue("guadalajara");
    expect(v).toBeDefined();
    expect(v!.name).toBe("Estadio Akron");
    expect(v!.city).toBe("Guadalajara");
    expect(v!.country).toBe("Mexico");
  });

  it("returns undefined for non-existent venue", () => {
    expect(getVenue("nonexistent")).toBeUndefined();
  });
});

describe("getVenueMap (useVenueMap logic)", () => {
  it("creates a map with 16 entries", () => {
    expect(getVenueMap().size).toBe(16);
  });

  it("all venue ids are unique", () => {
    const ids = venues.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("venue ↔ schedule consistency", () => {
  it("every schedule venueId exists in venues data", () => {
    const venueIds = new Set(venues.map((v) => v.id));
    matches.forEach((m) => {
      expect(venueIds.has(m.venueId)).toBe(true);
    });
  });

  it("every venue hosts at least one match", () => {
    const usedVenues = new Set(matches.map((m) => m.venueId));
    venues.forEach((v) => {
      expect(usedVenues.has(v.id)).toBe(true);
    });
  });
});
