/**
 * Badge definitions and check logic.
 * Badges are earned client-side (same pattern as scoring — no Edge Functions).
 * Badge catalog is in Supabase yc_badges table.
 */

import { supabase } from "./supabase";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;        // Lucide icon name
  category: "activity" | "skill" | "loyalty" | "special";
  threshold: number;
}

export interface UserBadge {
  badge_id: string;
  earned_at: string;
  competition_id: string | null;
}

/** Fetch all badge definitions */
export async function fetchBadges(): Promise<Badge[]> {
  const { data } = await supabase
    .from("yc_badges")
    .select("id, name, description, icon, category, threshold")
    .order("category");
  return (data ?? []) as Badge[];
}

/** Fetch badges earned by a specific user */
export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  const { data } = await supabase
    .from("yc_user_badges")
    .select("badge_id, earned_at, competition_id")
    .eq("user_id", userId);
  return (data ?? []) as UserBadge[];
}

/** Award a badge to a user (idempotent — conflict ignored) */
export async function awardBadge(
  userId: string,
  badgeId: string,
  competitionId?: string,
): Promise<void> {
  await supabase
    .from("yc_user_badges")
    .upsert(
      { user_id: userId, badge_id: badgeId, competition_id: competitionId ?? null },
      { onConflict: "user_id,badge_id" },
    );
}

/**
 * Check and award activity badges based on prediction count.
 * Call after saving a prediction.
 */
export async function checkActivityBadges(
  userId: string,
  totalPredictions: number,
): Promise<string[]> {
  const awarded: string[] = [];
  const thresholds: [string, number][] = [
    ["first_prediction", 1],
    ["ten_predictions", 10],
    ["fifty_predictions", 50],
    ["century_club", 100],
  ];

  for (const [badgeId, threshold] of thresholds) {
    if (totalPredictions >= threshold) {
      await awardBadge(userId, badgeId);
      awarded.push(badgeId);
    }
  }
  return awarded;
}

/**
 * Check and award skill badges based on scoring results.
 * Call after scoring predictions.
 */
export async function checkSkillBadges(
  userId: string,
  stats: { exactScores: number; currentStreak: number },
): Promise<string[]> {
  const awarded: string[] = [];

  if (stats.exactScores >= 1) { await awardBadge(userId, "first_exact"); awarded.push("first_exact"); }
  if (stats.exactScores >= 5) { await awardBadge(userId, "five_exact"); awarded.push("five_exact"); }
  if (stats.currentStreak >= 3) { await awardBadge(userId, "streak_3"); awarded.push("streak_3"); }
  if (stats.currentStreak >= 5) { await awardBadge(userId, "streak_5"); awarded.push("streak_5"); }
  if (stats.currentStreak >= 10) { await awardBadge(userId, "streak_10"); awarded.push("streak_10"); }

  return awarded;
}

/**
 * Check and award loyalty badges.
 * Call periodically (e.g., after saving a prediction or on profile load).
 */
export async function checkLoyaltyBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  // Night Owl: predicted after midnight local time
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) {
    await awardBadge(userId, "night_owl");
    awarded.push("night_owl");
  }

  // Social Butterfly: joined 3+ pools
  const { count: poolCount } = await supabase
    .from("yc_pool_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((poolCount ?? 0) >= 3) {
    await awardBadge(userId, "social_butterfly");
    awarded.push("social_butterfly");
  }

  // Globe Trotter: predicted in 3+ competitions
  const { data: compData } = await supabase
    .from("yc_predictions")
    .select("competition_id")
    .eq("user_id", userId);
  if (compData) {
    const comps = new Set(compData.map((r) => r.competition_id));
    if (comps.size >= 3) {
      await awardBadge(userId, "multi_comp");
      awarded.push("multi_comp");
    }
  }

  return awarded;
}

/** Fetch streak data for a user in a competition */
export async function fetchStreak(
  userId: string,
  competitionId: string,
): Promise<{ current_streak: number; best_streak: number } | null> {
  const { data } = await supabase
    .from("yc_streaks")
    .select("current_streak, best_streak")
    .eq("user_id", userId)
    .eq("competition_id", competitionId)
    .single();
  return data;
}

/** Update streak after a prediction is scored */
export async function updateStreak(
  userId: string,
  competitionId: string,
  matchId: number,
  correct: boolean,
): Promise<{ current_streak: number; best_streak: number }> {
  const existing = await fetchStreak(userId, competitionId);

  const currentStreak = correct ? (existing?.current_streak ?? 0) + 1 : 0;
  const bestStreak = Math.max(currentStreak, existing?.best_streak ?? 0);

  await supabase
    .from("yc_streaks")
    .upsert(
      {
        user_id: userId,
        competition_id: competitionId,
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_match_id: matchId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,competition_id" },
    );

  // Check streak badges
  await checkSkillBadges(userId, { exactScores: 0, currentStreak });

  return { current_streak: currentStreak, best_streak: bestStreak };
}
