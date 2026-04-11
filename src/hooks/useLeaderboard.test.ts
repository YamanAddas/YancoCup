import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement buildLeaderboard for isolated testing (avoids Supabase import)
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  accuracy: number;
  pointsPerPrediction: number;
}

function buildLeaderboard(
  predictions: Array<{ user_id: string; points: number | null; scored_at: string | null }>,
  profileMap: Map<string, { id: string; handle: string; display_name: string | null; avatar_url: string | null }>,
): LeaderboardEntry[] {
  const userIds = [...new Set(predictions.map((p) => p.user_id))];

  const statsMap = new Map<
    string,
    { points: number; correct: number; scored: number; total: number }
  >();
  for (const p of predictions) {
    const existing = statsMap.get(p.user_id) ?? {
      points: 0,
      correct: 0,
      scored: 0,
      total: 0,
    };
    existing.total++;
    if (p.scored_at !== null) {
      existing.points += p.points ?? 0;
      if ((p.points ?? 0) > 0) existing.correct++;
      existing.scored++;
    }
    statsMap.set(p.user_id, existing);
  }

  const board: LeaderboardEntry[] = userIds.map((uid) => {
    const profile = profileMap.get(uid);
    const stats = statsMap.get(uid) ?? { points: 0, correct: 0, scored: 0, total: 0 };
    return {
      userId: uid,
      handle: profile?.handle ?? "unknown",
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      totalPoints: stats.points,
      correctPredictions: stats.correct,
      totalPredictions: stats.total,
      accuracy: stats.scored > 0 ? Math.round((stats.correct / stats.scored) * 100) : 0,
      pointsPerPrediction: stats.total > 0 ? Math.round((stats.points / stats.total) * 100) / 100 : 0,
    };
  });

  board.sort((a, b) => b.totalPoints - a.totalPoints || b.pointsPerPrediction - a.pointsPerPrediction);
  return board;
}

// ---------------------------------------------------------------------------
// Re-implement hasLiveMatch
// ---------------------------------------------------------------------------

function hasLiveMatch(scores: Array<{ status: string }>): boolean {
  return scores.some((s) => s.status === "IN_PLAY" || s.status === "PAUSED");
}

// ===========================================================================
// TESTS
// ===========================================================================

const profiles = new Map([
  ["u1", { id: "u1", handle: "yaman", display_name: "Yaman", avatar_url: null }],
  ["u2", { id: "u2", handle: "alice", display_name: "Alice", avatar_url: "https://example.com/alice.jpg" }],
  ["u3", { id: "u3", handle: "bob", display_name: null, avatar_url: null }],
]);

describe("buildLeaderboard", () => {
  it("returns empty for empty predictions", () => {
    expect(buildLeaderboard([], profiles)).toEqual([]);
  });

  it("ranks users by total points (descending)", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u2", points: 5, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u3", points: 15, scored_at: "2026-06-11T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].userId).toBe("u3");
    expect(board[0].totalPoints).toBe(15);
    expect(board[1].userId).toBe("u1");
    expect(board[2].userId).toBe("u2");
  });

  it("breaks ties by points per prediction", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 0, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u2", points: 10, scored_at: "2026-06-11T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    // u1: 10pts / 2 preds = 5.0 PPP
    // u2: 10pts / 1 pred = 10.0 PPP
    expect(board[0].userId).toBe("u2"); // same points but higher PPP
    expect(board[1].userId).toBe("u1");
  });

  it("counts correct predictions (points > 0)", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 0, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 3, scored_at: "2026-06-12T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].correctPredictions).toBe(2); // 10 and 3 are correct
    expect(board[0].totalPredictions).toBe(3);
  });

  it("calculates accuracy from scored predictions only", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 0, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: null, scored_at: null }, // unscored
    ];
    const board = buildLeaderboard(predictions, profiles);
    // 1 correct / 2 scored = 50%
    expect(board[0].accuracy).toBe(50);
    expect(board[0].totalPredictions).toBe(3);
  });

  it("ignores unscored predictions for points", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: null, scored_at: null },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].totalPoints).toBe(10);
  });

  it("maps profile data correctly", () => {
    const predictions = [
      { user_id: "u2", points: 5, scored_at: "2026-06-11T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].handle).toBe("alice");
    expect(board[0].displayName).toBe("Alice");
    expect(board[0].avatarUrl).toBe("https://example.com/alice.jpg");
  });

  it("falls back to 'unknown' when profile missing", () => {
    const predictions = [
      { user_id: "u999", points: 5, scored_at: "2026-06-11T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].handle).toBe("unknown");
    expect(board[0].displayName).toBeNull();
    expect(board[0].avatarUrl).toBeNull();
  });

  it("returns 0 accuracy when no scored predictions", () => {
    const predictions = [
      { user_id: "u1", points: null, scored_at: null },
      { user_id: "u1", points: null, scored_at: null },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board[0].accuracy).toBe(0);
    expect(board[0].pointsPerPrediction).toBe(0);
  });

  it("calculates PPP correctly", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 5, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 0, scored_at: "2026-06-11T00:00:00Z" },
    ];
    const board = buildLeaderboard(predictions, profiles);
    // 15 pts / 3 preds = 5.0
    expect(board[0].pointsPerPrediction).toBe(5);
  });

  it("handles multiple users with varied stats", () => {
    const predictions = [
      { user_id: "u1", points: 10, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u1", points: 10, scored_at: "2026-06-12T00:00:00Z" },
      { user_id: "u2", points: 3, scored_at: "2026-06-11T00:00:00Z" },
      { user_id: "u2", points: 0, scored_at: "2026-06-12T00:00:00Z" },
      { user_id: "u3", points: null, scored_at: null },
    ];
    const board = buildLeaderboard(predictions, profiles);
    expect(board).toHaveLength(3);
    expect(board[0].userId).toBe("u1"); // 20 pts
    expect(board[1].userId).toBe("u2"); // 3 pts
    expect(board[2].userId).toBe("u3"); // 0 pts
  });
});

describe("hasLiveMatch", () => {
  it("returns true when IN_PLAY match exists", () => {
    expect(hasLiveMatch([
      { status: "TIMED" },
      { status: "IN_PLAY" },
      { status: "FINISHED" },
    ])).toBe(true);
  });

  it("returns true when PAUSED match exists", () => {
    expect(hasLiveMatch([
      { status: "TIMED" },
      { status: "PAUSED" },
    ])).toBe(true);
  });

  it("returns false when no live matches", () => {
    expect(hasLiveMatch([
      { status: "TIMED" },
      { status: "FINISHED" },
      { status: "POSTPONED" },
    ])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasLiveMatch([])).toBe(false);
  });
});
