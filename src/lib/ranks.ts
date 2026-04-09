/** Rank tier system — client-side calculation based on total points */

export interface RankTier {
  id: string;
  name: string;
  minPoints: number;
  color: string;       // Tailwind text color class
  bgColor: string;     // Tailwind bg color class
  borderColor: string; // Tailwind border color class
}

export const RANK_TIERS: RankTier[] = [
  { id: "diamond",  name: "Diamond",  minPoints: 1000, color: "text-cyan-300",   bgColor: "bg-cyan-500/15",   borderColor: "border-cyan-500/30" },
  { id: "platinum", name: "Platinum", minPoints: 600,  color: "text-slate-200",  bgColor: "bg-slate-400/15",  borderColor: "border-slate-400/30" },
  { id: "gold",     name: "Gold",     minPoints: 300,  color: "text-amber-400",  bgColor: "bg-amber-500/15",  borderColor: "border-amber-500/30" },
  { id: "silver",   name: "Silver",   minPoints: 100,  color: "text-gray-300",   bgColor: "bg-gray-400/15",   borderColor: "border-gray-400/30" },
  { id: "bronze",   name: "Bronze",   minPoints: 0,    color: "text-orange-400", bgColor: "bg-orange-500/15", borderColor: "border-orange-500/30" },
];

/** Get the rank tier for a given point total */
export function getRank(totalPoints: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (totalPoints >= tier.minPoints) return tier;
  }
  // Bronze is always the fallback (minPoints: 0)
  return RANK_TIERS[RANK_TIERS.length - 1] as RankTier;
}

/**
 * Stars within a tier (0-4). Shows progress toward the next tier.
 * 5 stars = about to promote.
 */
export function getRankStars(totalPoints: number): number {
  const rank = getRank(totalPoints);
  const tierIndex = RANK_TIERS.indexOf(rank);
  const nextTier = RANK_TIERS[tierIndex - 1]; // Higher tier is earlier in array

  if (!nextTier) return 5; // Max tier — full stars

  const range = nextTier.minPoints - rank.minPoints;
  const progress = totalPoints - rank.minPoints;
  return Math.min(4, Math.floor((progress / range) * 5));
}
