import type { Match, Team } from "../types";

/** Build share text for a prediction */
export function buildShareText(
  match: Match,
  homeTeam: Team,
  awayTeam: Team,
  homeScore: number,
  awayScore: number,
  t?: (key: string, params?: Record<string, string | number>) => string,
): string {
  const myPrediction = t ? t("share.myPrediction") : "My prediction for";
  const predictYours = t ? t("share.predictYours") : "Predict yours at YancoCup";
  const groupLabel = t ? t("share.groupLabel") : "Group";
  const vs = t ? t("match.vs") : "vs";

  return [
    `${myPrediction} ${homeTeam.name} ${vs} ${awayTeam.name}`,
    `${homeTeam.fifaCode} ${homeScore} - ${awayScore} ${awayTeam.fifaCode}`,
    "",
    `${match.group ? `${groupLabel} ${match.group}` : match.round} | FIFA World Cup 2026`,
    "",
    predictYours,
    `${window.location.origin}${window.location.pathname}#/predictions`,
  ].join("\n");
}

/** Share via Web Share API or fall back to clipboard */
export async function sharePrediction(text: string): Promise<"shared" | "copied" | "failed"> {
  // Try Web Share API (mainly mobile)
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // User cancelled or error — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
