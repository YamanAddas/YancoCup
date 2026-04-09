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

export async function generateShareCard(data: ShareCardData): Promise<Blob | null> {
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
    ctx.fillStyle = "#00e5c1";
    ctx.fillRect(0, 0, CARD_WIDTH, 3);

    // YancoCup branding
    ctx.fillStyle = "#00e5c1";
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
    ctx.fillText("MY PREDICTION", CARD_WIDTH / 2, 76);

    // Team names
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(data.homeTeam, CARD_WIDTH / 2 - 50, 120);
    ctx.textAlign = "left";
    ctx.fillText(data.awayTeam, CARD_WIDTH / 2 + 50, 120);

    // Predicted score (large)
    ctx.fillStyle = "#00e5c1";
    ctx.font = "bold 48px 'Space Grotesk', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${data.homeScore} - ${data.awayScore}`, CARD_WIDTH / 2, 185);

    // Actual result (if available)
    if (data.actualHome !== null && data.actualHome !== undefined && data.actualAway !== null && data.actualAway !== undefined) {
      ctx.fillStyle = "#666666";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText("ACTUAL RESULT", CARD_WIDTH / 2, 220);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px 'Space Grotesk', monospace";
      ctx.fillText(`${data.actualHome} - ${data.actualAway}`, CARD_WIDTH / 2, 255);

      // Points badge
      if (data.points !== null && data.points !== undefined) {
        const pointsText = `+${data.points} pts`;
        const badgeColor = data.points >= 10 ? "#00e5c1" : data.points > 0 ? "#f59e0b" : "#666666";

        ctx.fillStyle = badgeColor + "20";
        const badgeWidth = ctx.measureText(pointsText).width + 24;
        ctx.beginPath();
        ctx.roundRect(CARD_WIDTH / 2 - badgeWidth / 2, 270, badgeWidth, 28, 6);
        ctx.fill();

        ctx.fillStyle = badgeColor;
        ctx.font = "bold 14px 'Space Grotesk', monospace";
        ctx.fillText(pointsText, CARD_WIDTH / 2, 289);

        // Result label
        const label = data.points >= 10 ? "EXACT SCORE!" : data.points >= 5 ? "GOAL DIFFERENCE" : data.points >= 3 ? "CORRECT RESULT" : "";
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

/** Share a prediction card image via Web Share API or download */
export async function sharePredictionCard(data: ShareCardData): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateShareCard(data);
  if (!blob) return "failed";

  const file = new File([blob], "yancocup-prediction.png", { type: "image/png" });

  // Try Web Share API with file (mobile)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        text: `My prediction: ${data.homeTeam} ${data.homeScore}-${data.awayScore} ${data.awayTeam} | YancoCup`,
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
