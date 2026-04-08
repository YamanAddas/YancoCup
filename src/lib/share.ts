import type { Match, Team } from "../types";

/** Build share text for a prediction */
export function buildShareText(
  match: Match,
  homeTeam: Team,
  awayTeam: Team,
  homeScore: number,
  awayScore: number,
): string {
  return [
    `My prediction for ${homeTeam.name} vs ${awayTeam.name}`,
    `${homeTeam.fifaCode} ${homeScore} - ${awayScore} ${awayTeam.fifaCode}`,
    "",
    `${match.group ? `Group ${match.group}` : match.round} | FIFA World Cup 2026`,
    "",
    "Predict yours at YancoCup",
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
