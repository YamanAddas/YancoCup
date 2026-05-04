import { describe, it, expect } from "vitest";
import {
  COMPETITIONS,
  COMPETITION_LIST,
  getCompetition,
  isValidCompetition,
} from "./competitions";

describe("COMPETITIONS registry", () => {
  it("has all 7 expected competitions", () => {
    const ids = Object.keys(COMPETITIONS);
    expect(ids).toEqual(
      expect.arrayContaining(["WC", "CL", "PL", "PD", "BL1", "SA", "FL1"]),
    );
    expect(ids).toHaveLength(7);
  });

  it("each competition has required fields", () => {
    for (const comp of Object.values(COMPETITIONS)) {
      expect(comp.id).toBeTruthy();
      expect(comp.fdCode).toBeTruthy();
      expect(comp.fdId).toBeGreaterThan(0);
      expect(comp.name).toBeTruthy();
      expect(comp.shortName).toBeTruthy();
      expect(["tournament", "league"]).toContain(comp.type);
      expect(typeof comp.hasGroups).toBe("boolean");
      expect(typeof comp.staticSchedule).toBe("boolean");
      expect(comp.seasonLabel).toBeTruthy();
      expect(comp.emblem).toBeTruthy();
    }
  });

  it("WC is tournament with groups and static schedule", () => {
    const wc = COMPETITIONS.WC;
    expect(wc.type).toBe("tournament");
    expect(wc.hasGroups).toBe(true);
    expect(wc.staticSchedule).toBe(true);
  });

  it("CL is tournament without groups (Swiss model)", () => {
    const cl = COMPETITIONS.CL;
    expect(cl.type).toBe("tournament");
    expect(cl.hasGroups).toBe(false);
  });

  it("leagues have zones defined", () => {
    const leagues = ["PL", "PD", "BL1", "SA", "FL1"];
    for (const id of leagues) {
      const comp = COMPETITIONS[id];
      expect(comp.type).toBe("league");
      expect(comp.zones).toBeDefined();
      expect(comp.zones!.cl.length).toBeGreaterThan(0);
      expect(comp.zones!.relegation.length).toBeGreaterThan(0);
    }
  });

  it("tournaments don't have zones", () => {
    expect(COMPETITIONS.WC.zones).toBeUndefined();
    expect(COMPETITIONS.CL.zones).toBeUndefined();
  });

  it("PL has 4 CL spots", () => {
    expect(COMPETITIONS.PL.zones!.cl).toEqual([1, 2, 3, 4]);
  });

  it("FL1 has 3 CL spots", () => {
    expect(COMPETITIONS.FL1.zones!.cl).toEqual([1, 2, 3]);
  });

  it("BL1 relegation is positions 16-18", () => {
    expect(COMPETITIONS.BL1.zones!.relegation).toEqual([16, 17, 18]);
  });
});

describe("COMPETITION_LIST", () => {
  it("has same length as COMPETITIONS", () => {
    expect(COMPETITION_LIST).toHaveLength(Object.keys(COMPETITIONS).length);
  });

  it("contains all competition configs", () => {
    const ids = COMPETITION_LIST.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["WC", "CL", "PL", "PD", "BL1", "SA", "FL1"]));
  });
});

describe("getCompetition", () => {
  it("returns config for valid ID", () => {
    expect(getCompetition("WC")?.name).toBe("FIFA World Cup 2026");
    expect(getCompetition("PL")?.name).toBe("Premier League");
  });

  it("is case-insensitive", () => {
    expect(getCompetition("wc")?.id).toBe("WC");
    expect(getCompetition("pl")?.id).toBe("PL");
    expect(getCompetition("Bl1")?.id).toBe("BL1");
  });

  it("returns undefined for invalid ID", () => {
    expect(getCompetition("INVALID")).toBeUndefined();
    expect(getCompetition("")).toBeUndefined();
    expect(getCompetition("NFL")).toBeUndefined();
  });
});

describe("isValidCompetition", () => {
  it("returns true for valid IDs", () => {
    expect(isValidCompetition("WC")).toBe(true);
    expect(isValidCompetition("CL")).toBe(true);
    expect(isValidCompetition("PL")).toBe(true);
    expect(isValidCompetition("PD")).toBe(true);
    expect(isValidCompetition("BL1")).toBe(true);
    expect(isValidCompetition("SA")).toBe(true);
    expect(isValidCompetition("FL1")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidCompetition("wc")).toBe(true);
    expect(isValidCompetition("pl")).toBe(true);
  });

  it("returns false for invalid IDs", () => {
    expect(isValidCompetition("INVALID")).toBe(false);
    expect(isValidCompetition("")).toBe(false);
    expect(isValidCompetition("NBA")).toBe(false);
  });
});
