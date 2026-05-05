/**
 * Wall of Fame & Shame shareable card.
 *
 * Reuses the share-card primitives from shareCard.ts (palette, decor,
 * team-badge drawing) so visual identity stays consistent. Two side-by-side
 * panels: Fame (best pick of the week) on the left, Shame (most-confident
 * wrong pick) on the right.
 */

import {
  C,
  drawAccentBars,
  drawBackground,
  drawCornerDecor,
  drawDivider,
  drawStar8,
  drawTeamBadge,
  shareOrDownload,
} from "./shareCard";

type TFn = (key: string, params?: Record<string, string | number>) => string;

export interface WallOfFameEntry {
  handle: string;
  displayName: string | null;
  homeTeam: string;
  homeCode: string;
  homeIso?: string;
  homeCrest?: string | null;
  awayTeam: string;
  awayCode: string;
  awayIso?: string;
  awayCrest?: string | null;
  predictedHome: number | null;
  predictedAway: number | null;
  quickPick: "H" | "D" | "A" | null;
  actualHome: number | null;
  actualAway: number | null;
  points: number;
  confidence: 1 | 2 | 3 | null;
  isJoker: boolean;
}

export interface WallOfFameCardData {
  poolName: string;
  weekLabel: string;
  best: WallOfFameEntry | null;
  worst: WallOfFameEntry | null;
}

const W = 1200;
const H = 630;

function pickLabel(p: WallOfFameEntry): string {
  if (p.quickPick) return { H: "1", D: "X", A: "2" }[p.quickPick];
  if (p.predictedHome != null && p.predictedAway != null) {
    return `${p.predictedHome} : ${p.predictedAway}`;
  }
  return "—";
}

function actualLabel(p: WallOfFameEntry): string {
  if (p.actualHome != null && p.actualAway != null) {
    return `${p.actualHome} : ${p.actualAway}`;
  }
  return "—";
}

function confidenceLabel(level: 1 | 2 | 3 | null, t?: TFn): string | null {
  if (level == null) return null;
  if (level === 3) {
    return t ? t("shareCard.wallConfSure") : "🔥 Sure Thing";
  }
  if (level === 2) {
    return t ? t("shareCard.wallConfRisky") : "🤔 Risky Call";
  }
  return t ? t("shareCard.wallConfWild") : "🎲 Wild Guess";
}

async function drawPanel(
  ctx: CanvasRenderingContext2D,
  kind: "fame" | "shame",
  entry: WallOfFameEntry,
  x: number,
  y: number,
  w: number,
  h: number,
  t?: TFn,
): Promise<void> {
  const isFame = kind === "fame";
  const accentText = isFame ? C.green : C.danger;
  const accentBg = isFame ? "rgba(0,255,136,0.06)" : "rgba(255,68,85,0.06)";
  const accentBorder = isFame ? "rgba(0,255,136,0.25)" : "rgba(255,68,85,0.25)";
  const titleKey = isFame ? "pools.wallFame" : "pools.wallShame";
  const titleFallback = isFame ? "WALL OF FAME" : "WALL OF SHAME";

  // Panel background
  ctx.save();
  ctx.fillStyle = accentBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = accentBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Top icon — trophy for fame, frown for shame.
  // Canvas can't easily render Lucide icons; use Unicode symbols instead.
  ctx.save();
  ctx.fillStyle = accentText;
  ctx.font = "bold 28px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(isFame ? "🏆" : "💀", x + 24, y + 36);

  // Title
  ctx.fillStyle = accentText;
  ctx.font = "bold 14px 'Space Grotesk', sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(t ? t(titleKey) : titleFallback, x + 64, y + 42);

  // Points big right
  ctx.fillStyle = isFame ? C.green : C.textTertiary;
  ctx.font = "bold 38px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${entry.points >= 0 ? "+" : ""}${entry.points}`, x + w - 24, y + 50);

  ctx.fillStyle = C.textTertiary;
  ctx.font = "600 11px 'Inter', sans-serif";
  ctx.fillText(t ? t("recap.points").toUpperCase() : "PTS", x + w - 24, y + 68);
  ctx.restore();

  // Member name
  ctx.fillStyle = C.textPrimary;
  ctx.font = "bold 22px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    entry.displayName ?? entry.handle,
    x + 24,
    y + 110,
  );
  if (entry.displayName) {
    ctx.fillStyle = C.textTertiary;
    ctx.font = "400 13px 'Inter', sans-serif";
    ctx.fillText(`@${entry.handle}`, x + 24, y + 132);
  }

  // Divider under name
  drawDivider(ctx, y + 152, x + 24, x + w - 24);

  // Teams row
  const teamY = y + 196;
  const homeX = x + 60;
  const awayX = x + w - 60;
  await Promise.all([
    drawTeamBadge(ctx, entry.homeIso, entry.homeCrest, entry.homeCode, homeX, teamY, 28, 12),
    drawTeamBadge(ctx, entry.awayIso, entry.awayCrest, entry.awayCode, awayX, teamY, 28, 12),
  ]);

  ctx.fillStyle = C.textPrimary;
  ctx.font = "bold 14px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(entry.homeCode, homeX, teamY + 50);
  ctx.fillText(entry.awayCode, awayX, teamY + 50);

  ctx.fillStyle = C.textTertiary;
  ctx.font = "600 12px 'Inter', sans-serif";
  ctx.fillText("vs", x + w / 2, teamY + 6);

  // Predicted vs actual
  const predictY = y + 280;
  ctx.fillStyle = C.textTertiary;
  ctx.font = "600 11px 'Inter', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    (t ? t("recap.bestPick") : "Their pick").toUpperCase(),
    x + 24,
    predictY,
  );
  ctx.fillStyle = accentText;
  ctx.font = "bold 32px 'JetBrains Mono', monospace";
  ctx.fillText(pickLabel(entry), x + 24, predictY + 36);

  // Arrow
  ctx.fillStyle = C.textTertiary;
  ctx.font = "400 22px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("→", x + w / 2, predictY + 30);

  ctx.fillStyle = C.textTertiary;
  ctx.font = "600 11px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(
    (t ? t("shareCard.actualResult") : "ACTUAL").toUpperCase(),
    x + w - 24,
    predictY,
  );
  ctx.fillStyle = C.textPrimary;
  ctx.font = "bold 32px 'JetBrains Mono', monospace";
  ctx.fillText(actualLabel(entry), x + w - 24, predictY + 36);

  // Bottom row: confidence + joker
  const bottomY = y + h - 32;
  const confLabel = confidenceLabel(entry.confidence, t);
  if (confLabel) {
    ctx.fillStyle = C.textSecondary;
    ctx.font = "500 13px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(confLabel, x + 24, bottomY);
  }
  if (entry.isJoker) {
    ctx.fillStyle = "rgba(245,158,11,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w - 80, bottomY - 18, 56, 24, 6);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.font = "bold 12px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("2x", x + w - 52, bottomY - 6);
    ctx.textBaseline = "alphabetic";
  }
}

export async function generateWallOfFameCard(
  data: WallOfFameCardData,
  t?: TFn,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    drawBackground(ctx, W, H);
    drawAccentBars(ctx, W, H, 4);
    drawCornerDecor(ctx, W, H, 20, 50, 6);

    // Header
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.green;
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("YANCOCUP", 48, 48);

    ctx.fillStyle = C.textSecondary;
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textAlign = "right";
    const meta = `${data.poolName} · ${data.weekLabel}`;
    ctx.fillText(meta, W - 48, 48);

    drawDivider(ctx, 68, 48, W - 48);

    // Title row
    ctx.fillStyle = C.textPrimary;
    ctx.font = "bold 28px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      t ? t("shareCard.wallTitle") : "Wall of Fame & Shame",
      W / 2,
      114,
    );

    // Decorative star next to title
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,136,0.18)";
    ctx.lineWidth = 1.2;
    drawStar8(ctx, W / 2 - 200, 106, 12);
    drawStar8(ctx, W / 2 + 200, 106, 12);
    ctx.restore();

    // Two panels — fame (left), shame (right)
    const panelY = 150;
    const panelH = 380;
    const gap = 24;
    const panelW = (W - 48 * 2 - gap) / 2;
    const leftX = 48;
    const rightX = leftX + panelW + gap;

    if (data.best) {
      await drawPanel(ctx, "fame", data.best, leftX, panelY, panelW, panelH, t);
    } else {
      drawEmptyPanel(ctx, "fame", leftX, panelY, panelW, panelH, t);
    }
    if (data.worst) {
      await drawPanel(ctx, "shame", data.worst, rightX, panelY, panelW, panelH, t);
    } else {
      drawEmptyPanel(ctx, "shame", rightX, panelY, panelW, panelH, t);
    }

    // Footer
    drawDivider(ctx, H - 62, 48, W - 48, true);
    ctx.fillStyle = C.textTertiary;
    ctx.font = "500 13px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      t ? t("shareCard.tagline") : "Predict. Compete. Prove it.",
      48,
      H - 28,
    );
    ctx.textAlign = "right";
    ctx.font = "400 12px 'Inter', sans-serif";
    ctx.fillText("yamanaddas.github.io/YancoCup", W - 48, H - 28);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

function drawEmptyPanel(
  ctx: CanvasRenderingContext2D,
  kind: "fame" | "shame",
  x: number,
  y: number,
  w: number,
  h: number,
  t?: TFn,
) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = C.textTertiary;
  ctx.font = "500 14px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    kind === "fame"
      ? t ? t("shareCard.wallFameEmpty") : "No standout pick this week"
      : t ? t("shareCard.wallShameEmpty") : "Everyone played it safe",
    x + w / 2,
    y + h / 2,
  );
  ctx.restore();
}

export async function shareWallOfFameCard(
  data: WallOfFameCardData,
  t?: TFn,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateWallOfFameCard(data, t);
  if (!blob) return "failed";
  const text = t
    ? t("shareCard.wallShareText", { pool: data.poolName })
    : `${data.poolName} — Wall of Fame & Shame this week | YancoCup`;
  return shareOrDownload(blob, "yancocup-wall.png", text);
}
