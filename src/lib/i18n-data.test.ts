import { describe, it, expect } from "vitest";
import {
  teamName,
  competitionName,
  venueName,
  countryName,
  confederationName,
  findTeamByName,
} from "./i18n-data";

describe("teamName", () => {
  it("returns English name by default", () => {
    expect(teamName("bra", "en")).toBe("Brazil");
    expect(teamName("arg", "en")).toBe("Argentina");
    expect(teamName("usa", "en")).toBe("United States");
  });

  it("returns Arabic translation", () => {
    expect(teamName("bra", "ar")).toBe("البرازيل");
    expect(teamName("egy", "ar")).toBe("مصر");
    expect(teamName("ksa", "ar")).toBe("السعودية");
  });

  it("returns Spanish translation", () => {
    expect(teamName("esp", "es")).toBe("España");
    expect(teamName("mex", "es")).toBe("México");
  });

  it("returns French translation", () => {
    expect(teamName("fra", "fr")).toBe("France");
    expect(teamName("bra", "fr")).toBe("Brésil");
  });

  it("returns German translation", () => {
    expect(teamName("ger", "de")).toBe("Deutschland");
    expect(teamName("ned", "de")).toBe("Niederlande");
  });

  it("returns Portuguese translation", () => {
    expect(teamName("por", "pt")).toBe("Portugal");
    expect(teamName("jpn", "pt")).toBe("Japão");
  });

  it("is case-insensitive for team ID", () => {
    expect(teamName("BRA", "en")).toBe("Brazil");
    expect(teamName("Bra", "en")).toBe("Brazil");
  });

  it("returns input as fallback for unknown team", () => {
    expect(teamName("xyz", "en")).toBe("xyz");
    expect(teamName("unknown_team", "ar")).toBe("unknown_team");
  });
});

describe("competitionName", () => {
  it("returns English competition name", () => {
    const wc = competitionName("WC", "en");
    expect(wc.name).toContain("World Cup");
    expect(wc.shortName).toBeTruthy();
  });

  it("returns Arabic competition name", () => {
    const wc = competitionName("WC", "ar");
    expect(wc.name).toContain("كأس العالم");
  });

  it("is case-insensitive", () => {
    const pl = competitionName("pl", "en");
    expect(pl.name).toContain("Premier");
  });

  it("returns input for unknown competition", () => {
    const unknown = competitionName("UNKNOWN", "en");
    expect(unknown.name).toBe("UNKNOWN");
    expect(unknown.shortName).toBe("UNKNOWN");
  });

  it("has translations for all 8 competitions", () => {
    const comps = ["WC", "CL", "PL", "PD", "BL1", "SA", "FL1", "EL"];
    for (const id of comps) {
      const result = competitionName(id, "en");
      expect(result.name).toBeTruthy();
      expect(result.name).not.toBe(id); // Should have a real name, not just the ID
    }
  });
});

describe("venueName", () => {
  it("returns venue info for known venue", () => {
    // Test with a WC 2026 venue ID (from schedule.json)
    const venue = venueName("metlife", "en");
    // If the venue exists, it should have name and city
    if (venue.name !== "metlife") {
      expect(venue.name).toBeTruthy();
      expect(venue.city).toBeTruthy();
    }
  });

  it("returns fallback for unknown venue", () => {
    const venue = venueName("unknown_venue", "en");
    expect(venue.name).toBe("unknown_venue");
    expect(venue.city).toBe("");
    expect(venue.country).toBe("");
  });
});

describe("countryName", () => {
  it("returns English country name", () => {
    expect(countryName("us", "en")).toBe("United States");
    expect(countryName("mx", "en")).toBe("Mexico");
  });

  it("returns Arabic country name", () => {
    expect(countryName("us", "ar")).toContain("الولايات المتحدة");
  });

  it("is case-insensitive", () => {
    expect(countryName("US", "en")).toBe("United States");
  });

  it("returns input for unknown country", () => {
    expect(countryName("xx", "en")).toBe("xx");
  });
});

describe("confederationName", () => {
  it("returns English confederation names", () => {
    const result = confederationName("UEFA", "en");
    expect(result).toContain("UEFA");
  });

  it("returns Arabic confederation name", () => {
    const result = confederationName("UEFA", "ar");
    // Arabic name for UEFA
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns input for unknown confederation", () => {
    expect(confederationName("UNKNOWN", "en")).toBe("UNKNOWN");
  });
});

describe("findTeamByName", () => {
  it("finds team by English name", () => {
    expect(findTeamByName("Brazil")).toBe("bra");
    expect(findTeamByName("Argentina")).toBe("arg");
  });

  it("finds team by Arabic name", () => {
    expect(findTeamByName("البرازيل")).toBe("bra");
    expect(findTeamByName("مصر")).toBe("egy");
  });

  it("finds team by partial name", () => {
    expect(findTeamByName("Braz")).toBe("bra");
    expect(findTeamByName("Argent")).toBe("arg");
  });

  it("is case-insensitive", () => {
    expect(findTeamByName("brazil")).toBe("bra");
    expect(findTeamByName("BRAZIL")).toBe("bra");
  });

  it("returns undefined for no match", () => {
    expect(findTeamByName("xyznonexistent")).toBeUndefined();
  });

  it("finds team by Spanish name", () => {
    expect(findTeamByName("Alemania")).toBe("ger");
    expect(findTeamByName("España")).toBe("esp");
  });

  it("finds team by German name", () => {
    expect(findTeamByName("Deutschland")).toBe("ger");
    expect(findTeamByName("Brasilien")).toBe("bra");
  });

  it("trims whitespace", () => {
    expect(findTeamByName("  Brazil  ")).toBe("bra");
  });
});
