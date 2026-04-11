import { describe, it, expect } from "vitest";
import { stageToRound } from "./useCompetitionSchedule";

describe("stageToRound", () => {
  // Group/league stages
  it("maps GROUP_STAGE to group", () => {
    expect(stageToRound("GROUP_STAGE")).toBe("group");
  });

  it("maps LEAGUE_STAGE to group (CL Swiss model)", () => {
    expect(stageToRound("LEAGUE_STAGE")).toBe("group");
  });

  it("maps LEAGUE_STAGE_MATCHDAY to group", () => {
    expect(stageToRound("LEAGUE_STAGE_MATCHDAY")).toBe("group");
  });

  it("maps REGULAR_SEASON to group (leagues)", () => {
    expect(stageToRound("REGULAR_SEASON")).toBe("group");
  });

  // Playoff stages
  it("maps PLAYOFF to playoff", () => {
    expect(stageToRound("PLAYOFF")).toBe("playoff");
  });

  it("maps PLAYOFF_ROUND to playoff", () => {
    expect(stageToRound("PLAYOFF_ROUND")).toBe("playoff");
  });

  it("maps KNOCKOUT_ROUND_PLAY_OFFS to playoff", () => {
    expect(stageToRound("KNOCKOUT_ROUND_PLAY_OFFS")).toBe("playoff");
  });

  it("maps QUALIFICATION stages to playoff", () => {
    expect(stageToRound("QUALIFICATION")).toBe("playoff");
    expect(stageToRound("QUALIFICATION_ROUND_1")).toBe("playoff");
    expect(stageToRound("QUALIFICATION_ROUND_2")).toBe("playoff");
    expect(stageToRound("QUALIFICATION_ROUND_3")).toBe("playoff");
  });

  it("maps PRELIMINARY rounds to playoff", () => {
    expect(stageToRound("PRELIMINARY_ROUND")).toBe("playoff");
    expect(stageToRound("PRELIMINARY_SEMI_FINALS")).toBe("playoff");
    expect(stageToRound("PRELIMINARY_FINAL")).toBe("playoff");
  });

  it("maps ROUND_OF_16_PLAY_OFFS to playoff", () => {
    expect(stageToRound("ROUND_OF_16_PLAY_OFFS")).toBe("playoff");
  });

  // Knockout rounds
  it("maps LAST_32 / ROUND_OF_32 to round-of-32", () => {
    expect(stageToRound("LAST_32")).toBe("round-of-32");
    expect(stageToRound("ROUND_OF_32")).toBe("round-of-32");
  });

  it("maps LAST_16 / ROUND_OF_16 to round-of-16", () => {
    expect(stageToRound("LAST_16")).toBe("round-of-16");
    expect(stageToRound("ROUND_OF_16")).toBe("round-of-16");
  });

  it("maps QUARTER_FINALS to quarterfinal", () => {
    expect(stageToRound("QUARTER_FINALS")).toBe("quarterfinal");
  });

  it("maps SEMI_FINALS to semifinal", () => {
    expect(stageToRound("SEMI_FINALS")).toBe("semifinal");
  });

  it("maps THIRD_PLACE to third-place", () => {
    expect(stageToRound("THIRD_PLACE")).toBe("third-place");
  });

  it("maps FINAL to final", () => {
    expect(stageToRound("FINAL")).toBe("final");
  });

  // Default
  it("defaults unknown stage to group", () => {
    expect(stageToRound("UNKNOWN_STAGE")).toBe("group");
    expect(stageToRound("")).toBe("group");
  });
});
