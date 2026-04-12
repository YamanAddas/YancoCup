/**
 * Generate a shareable prediction card image using Canvas API.
 * Returns a Blob that can be shared via Web Share API or downloaded.
 */

interface ShareCardData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  actualHome?: number | null;
  actualAway?: number | null;
  points?: number | null;
  competition: string;
  matchday?: string;
}

const CARD_WIDTH = 600;
const CARD_HEIGHT = 340;

export async function generateShareCard(
  data: ShareCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    bg.addColorStop(0, "#060b14");
    bg.addColorStop(1, "#0c1620");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Border
    ctx.strokeStyle = "#142035";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

    // Green accent line at top
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, 0, CARD_WIDTH, 3);

    // YancoCup branding
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("YANCOCUP", 24, 36);

    // Competition + matchday
    ctx.fillStyle = "#666666";
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${data.competition}${data.matchday ? ` · ${data.matchday}` : ""}`, CARD_WIDTH - 24, 36);

    // "My Prediction" label
    ctx.fillStyle = "#a0a0a0";
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t ? t("shareCard.myPrediction") : "MY PREDICTION", CARD_WIDTH / 2, 76);

    // Team names
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(data.homeTeam, CARD_WIDTH / 2 - 50, 120);
    ctx.textAlign = "left";
    ctx.fillText(data.awayTeam, CARD_WIDTH / 2 + 50, 120);

    // Predicted score (large)
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 48px 'Space Grotesk', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${data.homeScore} - ${data.awayScore}`, CARD_WIDTH / 2, 185);

    // Actual result (if available)
    if (data.actualHome !== null && data.actualHome !== undefined && data.actualAway !== null && data.actualAway !== undefined) {
      ctx.fillStyle = "#666666";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText(t ? t("shareCard.actualResult") : "ACTUAL RESULT", CARD_WIDTH / 2, 220);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px 'Space Grotesk', monospace";
      ctx.fillText(`${data.actualHome} - ${data.actualAway}`, CARD_WIDTH / 2, 255);

      // Points badge
      if (data.points !== null && data.points !== undefined) {
        const pointsText = `+${data.points} pts`;
        const badgeColor = data.points >= 10 ? "#00ff88" : data.points > 0 ? "#f59e0b" : "#666666";

        ctx.fillStyle = badgeColor + "20";
        const badgeWidth = ctx.measureText(pointsText).width + 24;
        ctx.beginPath();
        ctx.roundRect(CARD_WIDTH / 2 - badgeWidth / 2, 270, badgeWidth, 28, 6);
        ctx.fill();

        ctx.fillStyle = badgeColor;
        ctx.font = "bold 14px 'Space Grotesk', monospace";
        ctx.fillText(pointsText, CARD_WIDTH / 2, 289);

        // Result label
        const label = data.points >= 10 ? (t ? t("shareCard.exactScore") : "EXACT SCORE!") : data.points >= 5 ? (t ? t("shareCard.goalDifference") : "GOAL DIFFERENCE") : data.points >= 3 ? (t ? t("shareCard.correctResult") : "CORRECT RESULT") : "";
        if (label) {
          ctx.fillStyle = badgeColor;
          ctx.font = "bold 11px 'Inter', sans-serif";
          ctx.fillText(label, CARD_WIDTH / 2, 312);
        }
      }
    }

    // Footer
    ctx.fillStyle = "#333333";
    ctx.font = "10px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("yamanaddas.github.io/YancoCup", CARD_WIDTH / 2, CARD_HEIGHT - 12);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 9:16 Story card (WhatsApp Status / Instagram Stories — 1080x1920)
// ---------------------------------------------------------------------------

const STORY_W = 1080;
const STORY_H = 1920;

export async function generateStoryCard(
  data: ShareCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background — deep gradient
    const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
    bg.addColorStop(0, "#040810");
    bg.addColorStop(0.4, "#060b14");
    bg.addColorStop(1, "#0c1620");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, STORY_W, STORY_H);

    // Subtle green glow behind center
    const glow = ctx.createRadialGradient(STORY_W / 2, STORY_H * 0.42, 0, STORY_W / 2, STORY_H * 0.42, 400);
    glow.addColorStop(0, "rgba(0, 255, 136, 0.06)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, STORY_W, STORY_H);

    // Green accent line at top
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, 0, STORY_W, 4);

    // YancoCup branding — large, top center
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 36px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YANCOCUP", STORY_W / 2, 100);

    // Competition + matchday
    ctx.fillStyle = "#666666";
    ctx.font = "20px 'Inter', sans-serif";
    ctx.fillText(`${data.competition}${data.matchday ? ` · ${data.matchday}` : ""}`, STORY_W / 2, 140);

    // Divider line
    ctx.fillStyle = "#142035";
    ctx.fillRect(STORY_W / 2 - 100, 180, 200, 1);

    // "My Prediction" label
    ctx.fillStyle = "#888888";
    ctx.font = "22px 'Inter', sans-serif";
    ctx.fillText(t ? t("shareCard.myPrediction") : "MY PREDICTION", STORY_W / 2, 280);

    // Home team name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Space Grotesk', sans-serif";
    ctx.fillText(data.homeTeam, STORY_W / 2, 380);

    // "vs" or predicted score
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 96px 'Space Grotesk', monospace";
    ctx.fillText(`${data.homeScore} - ${data.awayScore}`, STORY_W / 2, 520);

    // Away team name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Space Grotesk', sans-serif";
    ctx.fillText(data.awayTeam, STORY_W / 2, 620);

    // Divider
    ctx.fillStyle = "#142035";
    ctx.fillRect(STORY_W / 2 - 150, 680, 300, 1);

    // Actual result (if available)
    if (data.actualHome !== null && data.actualHome !== undefined && data.actualAway !== null && data.actualAway !== undefined) {
      ctx.fillStyle = "#666666";
      ctx.font = "22px 'Inter', sans-serif";
      ctx.fillText(t ? t("shareCard.actualResult") : "ACTUAL RESULT", STORY_W / 2, 760);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px 'Space Grotesk', monospace";
      ctx.fillText(`${data.actualHome} - ${data.actualAway}`, STORY_W / 2, 840);

      // Points badge
      if (data.points !== null && data.points !== undefined) {
        const pointsText = `+${data.points} pts`;
        const badgeColor = data.points >= 10 ? "#00ff88" : data.points > 0 ? "#f59e0b" : "#666666";

        // Badge background
        ctx.fillStyle = badgeColor + "18";
        const badgeW = 200;
        ctx.beginPath();
        ctx.roundRect(STORY_W / 2 - badgeW / 2, 880, badgeW, 56, 12);
        ctx.fill();

        // Badge text
        ctx.fillStyle = badgeColor;
        ctx.font = "bold 28px 'Space Grotesk', monospace";
        ctx.fillText(pointsText, STORY_W / 2, 916);

        // Result label
        const label = data.points >= 10 ? (t ? t("shareCard.exactScore") : "EXACT SCORE!") : data.points >= 5 ? (t ? t("shareCard.goalDifference") : "GOAL DIFFERENCE") : data.points >= 3 ? (t ? t("shareCard.correctResult") : "CORRECT RESULT") : "";
        if (label) {
          ctx.fillStyle = badgeColor;
          ctx.font = "bold 20px 'Inter', sans-serif";
          ctx.fillText(label, STORY_W / 2, 970);
        }
      }
    }

    // Footer — URL
    ctx.fillStyle = "#333333";
    ctx.font = "18px 'Inter', sans-serif";
    ctx.fillText("yamanaddas.github.io/YancoCup", STORY_W / 2, STORY_H - 60);

    // Green accent line at bottom
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, STORY_H - 4, STORY_W, 4);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

/** Share a Story-format prediction card */
export async function shareStoryCard(
  data: ShareCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateStoryCard(data, t);
  if (!blob) return "failed";

  const file = new File([blob], "yancocup-story.png", { type: "image/png" });

  const shareText = t
    ? `${t("shareCard.myPredictionText")} ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} | YancoCup`
    : `My prediction: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} | YancoCup`;

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ text: shareText, files: [file] });
      return "shared";
    } catch { /* user cancelled */ }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "yancocup-story.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

// ---------------------------------------------------------------------------
// Profile share card
// ---------------------------------------------------------------------------

interface ProfileCardData {
  handle: string;
  displayName: string | null;
  rank: string;
  totalPoints: number;
  predictions: number;
  exactScores: number;
  accuracy: number;
}

export async function generateProfileCard(
  data: ProfileCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<Blob | null> {
  try {
    const W = 600;
    const H = 360;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#060b14");
    bg.addColorStop(1, "#0c1620");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "#142035";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Green accent line
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, 0, W, 3);

    // Branding
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("YANCOCUP", 24, 36);

    // Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.displayName ?? data.handle, W / 2, 80);

    // Handle
    ctx.fillStyle = "#666666";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText(`@${data.handle}`, W / 2, 105);

    // Rank badge
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 16px 'Space Grotesk', sans-serif";
    ctx.fillText(data.rank, W / 2, 140);

    // Stats row
    const stats = [
      { label: t ? t("shareCard.points") : "POINTS", value: String(data.totalPoints) },
      { label: t ? t("shareCard.predictions") : "PREDICTIONS", value: String(data.predictions) },
      { label: t ? t("shareCard.exact") : "EXACT", value: String(data.exactScores) },
      { label: t ? t("shareCard.accuracy") : "ACCURACY", value: `${data.accuracy}%` },
    ];

    const colW = W / stats.length;
    const baseY = 190;

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!;
      const x = colW * i + colW / 2;

      // Value
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 36px 'Space Grotesk', monospace";
      ctx.textAlign = "center";
      ctx.fillText(s.value, x, baseY);

      // Label
      ctx.fillStyle = "#666666";
      ctx.font = "11px 'Inter', sans-serif";
      ctx.fillText(s.label, x, baseY + 20);
    }

    // Divider
    ctx.fillStyle = "#142035";
    ctx.fillRect(24, baseY + 40, W - 48, 1);

    // Invite text
    ctx.fillStyle = "#a0a0a0";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t ? t("shareCard.joinMe") : "Join me on YancoCup — predict the World Cup!", W / 2, baseY + 70);

    // Footer
    ctx.fillStyle = "#333333";
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillText("yamanaddas.github.io/YancoCup", W / 2, H - 12);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

export async function shareProfileCard(
  data: ProfileCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateProfileCard(data, t);
  if (!blob) return "failed";

  const file = new File([blob], "yancocup-profile.png", { type: "image/png" });

  const shareText = t
    ? `${data.rank} ${t("shareCard.onYancoCup")} ${data.totalPoints} pts! | YancoCup`
    : `I'm ${data.rank} on YancoCup with ${data.totalPoints} points! | YancoCup`;

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        text: shareText,
        files: [file],
      });
      return "shared";
    } catch {
      // User cancelled
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "yancocup-profile.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

/** Share a prediction card image via Web Share API or download */
export async function sharePredictionCard(
  data: ShareCardData,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateShareCard(data, t);
  if (!blob) return "failed";

  const file = new File([blob], "yancocup-prediction.png", { type: "image/png" });

  const shareText = t
    ? `${t("shareCard.myPredictionText")} ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} | YancoCup`
    : `My prediction: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} | YancoCup`;

  // Try Web Share API with file (mobile)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        text: shareText,
        files: [file],
      });
      return "shared";
    } catch {
      // User cancelled — fall through
    }
  }

  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "yancocup-prediction.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
