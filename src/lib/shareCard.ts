/**
 * YancoCup — Premium Shareable Prediction Card Generator
 *
 * Generates beautiful Canvas-based images for sharing predictions
 * on WhatsApp, Telegram, X/Twitter, and direct download.
 *
 * Two formats:
 *   - Horizontal card (1200×630)  — social media, chat previews
 *   - Story card (1080×1920)      — WhatsApp Status, Instagram Stories
 */

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

// ── Data interfaces ─────────────────────────────────────────────

export interface ShareCardData {
  homeTeam: string;
  awayTeam: string;
  homeCode: string;
  awayCode: string;
  homeIso?: string;
  awayIso?: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeScore: number;
  awayScore: number;
  quickPick?: "H" | "D" | "A" | null;
  actualHome?: number | null;
  actualAway?: number | null;
  points?: number | null;
  tier?: "exact" | "goal_difference" | "correct_result" | "wrong" | null;
  competition: string;
  competitionName?: string;
  matchday?: string;
  round?: string;
  isJoker?: boolean;
  streak?: number;
}

export interface ProfileCardData {
  handle: string;
  displayName: string | null;
  rank: string;
  totalPoints: number;
  predictions: number;
  exactScores: number;
  accuracy: number;
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

// ── Color palette ───────────────────────────────────────────────

const C = {
  bgDeep: "#040810",
  bgMid: "#070d18",
  bgSurface: "#0c1620",
  bgElevated: "#121e30",
  green: "#00ff88",
  greenMuted: "#00cc6a",
  textPrimary: "#f0f4f8",
  textSecondary: "#8899aa",
  textTertiary: "#4a5568",
  border: "#1a2332",
  borderLight: "#243044",
  gold: "#f59e0b",
  danger: "#ff4455",
};

const TIER_STYLE: Record<string, { bg: string; text: string; glow: string }> = {
  exact:            { bg: "rgba(0,255,136,0.14)", text: "#00ff88", glow: "rgba(0,255,136,0.25)" },
  goal_difference:  { bg: "rgba(16,185,129,0.14)", text: "#10b981", glow: "rgba(16,185,129,0.2)" },
  correct_result:   { bg: "rgba(245,158,11,0.14)", text: "#f59e0b", glow: "rgba(245,158,11,0.18)" },
  wrong:            { bg: "rgba(107,114,128,0.08)", text: "#6b7280", glow: "rgba(0,0,0,0)" },
};

// ── Helpers ──────────────────────────────────────────────────────

function loadImage(url: string, timeout = 4000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => { img.onload = null; resolve(null); }, timeout);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

/** Draw a circular image (flag/crest) at center (cx, cy) with given radius. */
function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Draw a TLA (three-letter abbreviation) fallback circle. */
function drawTlaCircle(
  ctx: CanvasRenderingContext2D,
  tla: string,
  cx: number,
  cy: number,
  r: number,
  fontSize: number,
) {
  ctx.save();

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.bgElevated;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // TLA text
  ctx.fillStyle = C.textSecondary;
  ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tla.slice(0, 3), cx, cy + 1);

  ctx.restore();
}

/** Attempt to load and draw a flag/crest; fall back to TLA circle. */
async function drawTeamBadge(
  ctx: CanvasRenderingContext2D,
  isoCode: string | undefined,
  crest: string | null | undefined,
  tla: string,
  cx: number,
  cy: number,
  r: number,
  fontSize: number,
) {
  let img: HTMLImageElement | null = null;

  if (isoCode) {
    img = await loadImage(`${FLAG_BASE}/${isoCode.toLowerCase()}.svg`);
  } else if (crest) {
    img = await loadImage(crest);
  }

  if (img) {
    // Subtle ring behind flag
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,255,136,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    drawCircleImage(ctx, img, cx, cy, r);
  } else {
    drawTlaCircle(ctx, tla, cx, cy, r, fontSize);
  }
}

/** Draw an 8-pointed Islamic star outline (Rub el Hizb). */
function drawStar8(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.38;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

/** Draw decorative corner brackets with arabesque star accents. */
function drawCornerDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  margin: number,
  bracketLen: number,
  starR: number,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,136,0.10)";
  ctx.lineWidth = 1.5;

  // Corner bracket positions: [x, y, flipX, flipY]
  const corners: [number, number, number, number][] = [
    [margin, margin, 1, 1],
    [w - margin, margin, -1, 1],
    [margin, h - margin, 1, -1],
    [w - margin, h - margin, -1, -1],
  ];

  for (const [x, y, fx, fy] of corners) {
    // L-bracket
    ctx.beginPath();
    ctx.moveTo(x, y + bracketLen * fy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracketLen * fx, y);
    ctx.stroke();

    // Small star at corner
    drawStar8(ctx, x + 12 * fx, y + 12 * fy, starR);
  }

  ctx.restore();
}

/** Draw the multi-layer gradient background. */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  // Base gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, C.bgDeep);
  bg.addColorStop(0.35, C.bgMid);
  bg.addColorStop(1, C.bgSurface);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Central green glow
  const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.min(w, h) * 0.55);
  glow.addColorStop(0, "rgba(0,255,136,0.045)");
  glow.addColorStop(0.6, "rgba(0,255,136,0.015)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Subtle diagonal grain lines
  ctx.save();
  ctx.globalAlpha = 0.012;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let i = -h; i < w + h; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h * 0.3, h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw green accent bars at top and bottom. */
function drawAccentBars(ctx: CanvasRenderingContext2D, w: number, h: number, thickness: number) {
  // Top bar with glow
  const topGlow = ctx.createLinearGradient(0, 0, w, 0);
  topGlow.addColorStop(0, "rgba(0,255,136,0.3)");
  topGlow.addColorStop(0.3, C.green);
  topGlow.addColorStop(0.7, C.green);
  topGlow.addColorStop(1, "rgba(0,255,136,0.3)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, w, thickness);

  // Bottom bar
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, h - thickness, w, thickness);

  // Soft glow beneath top bar
  const softGlow = ctx.createLinearGradient(0, thickness, 0, thickness + 30);
  softGlow.addColorStop(0, "rgba(0,255,136,0.08)");
  softGlow.addColorStop(1, "transparent");
  ctx.fillStyle = softGlow;
  ctx.fillRect(0, thickness, w, 30);
}

/** Draw divider line with optional center diamond. */
function drawDivider(
  ctx: CanvasRenderingContext2D,
  y: number,
  xStart: number,
  xEnd: number,
  withDiamond = false,
) {
  const cx = (xStart + xEnd) / 2;

  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();

  if (withDiamond) {
    const gap = 12;
    ctx.moveTo(xStart, y);
    ctx.lineTo(cx - gap, y);
    ctx.moveTo(cx + gap, y);
    ctx.lineTo(xEnd, y);
    ctx.stroke();

    // Small diamond accent
    ctx.fillStyle = "rgba(0,255,136,0.25)";
    ctx.beginPath();
    ctx.moveTo(cx, y - 5);
    ctx.lineTo(cx + 5, y);
    ctx.lineTo(cx, y + 5);
    ctx.lineTo(cx - 5, y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.moveTo(xStart, y);
    ctx.lineTo(xEnd, y);
    ctx.stroke();
  }
}

/** Get tier label text. */
function tierLabel(tier: string | null | undefined, t?: TFn): string {
  if (!tier) return "";
  switch (tier) {
    case "exact": return t ? t("shareCard.exactScore") : "EXACT SCORE!";
    case "goal_difference": return t ? t("shareCard.goalDifference") : "GOAL DIFFERENCE";
    case "correct_result": return t ? t("shareCard.correctResult") : "CORRECT RESULT";
    default: return "";
  }
}

/** Determine tier from points when tier isn't provided. */
function inferTier(points: number | null | undefined): string {
  if (points == null || points <= 0) return "wrong";
  if (points >= 10) return "exact";
  if (points >= 5) return "goal_difference";
  return "correct_result";
}

// ═══════════════════════════════════════════════════════════════
// HORIZONTAL CARD — 1200 × 630
// ═══════════════════════════════════════════════════════════════

const CARD_W = 1200;
const CARD_H = 630;

export async function generateShareCard(
  data: ShareCardData,
  t?: TFn,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const hasResult = data.actualHome != null && data.actualAway != null;
    const tier = data.tier ?? (hasResult ? inferTier(data.points) : null);
    const tierStyle = tier ? TIER_STYLE[tier] ?? TIER_STYLE.wrong : null;

    // ── Background layers ──
    drawBackground(ctx, CARD_W, CARD_H);
    drawAccentBars(ctx, CARD_W, CARD_H, 4);
    drawCornerDecor(ctx, CARD_W, CARD_H, 20, 50, 6);

    // ── Header: branding + competition ──
    ctx.textBaseline = "alphabetic";

    // YANCOCUP branding
    ctx.fillStyle = C.green;
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("YANCOCUP", 48, 48);

    // Small soccer ball accent after brand name
    ctx.font = "18px sans-serif";
    ctx.fillText("\u26BD", 168, 48);

    // Competition + matchday/round on the right
    const compText = data.competitionName ?? data.competition;
    const metaText = data.matchday ? `${compText} \u00B7 ${data.matchday}` : compText;
    ctx.fillStyle = C.textSecondary;
    ctx.font = "500 15px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(metaText, CARD_W - 48, 48);

    // Header divider
    drawDivider(ctx, 68, 48, CARD_W - 48);

    // ── Team badges + names ──
    // Load both flags concurrently
    await Promise.all([
      drawTeamBadge(ctx, data.homeIso, data.homeCrest, data.homeCode, 180, 148, 48, 18),
      drawTeamBadge(ctx, data.awayIso, data.awayCrest, data.awayCode, CARD_W - 180, 148, 48, 18),
    ]);

    // Team codes (large)
    ctx.fillStyle = C.textPrimary;
    ctx.font = "bold 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.homeCode, 180, 218);
    ctx.fillText(data.awayCode, CARD_W - 180, 218);

    // Team names (smaller, below codes)
    ctx.fillStyle = C.textSecondary;
    ctx.font = "400 13px 'Inter', sans-serif";
    ctx.fillText(data.homeTeam, 180, 240);
    ctx.fillText(data.awayTeam, CARD_W - 180, 240);

    // "vs" in center between teams
    ctx.fillStyle = C.textTertiary;
    ctx.font = "600 14px 'Inter', sans-serif";
    ctx.fillText("vs", CARD_W / 2, 148);

    // ── Score area ──
    if (hasResult) {
      // --- Post-match: prediction vs actual ---

      // "YOUR PREDICTION" label
      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 12px 'Inter', sans-serif";
      ctx.letterSpacing = "2px";
      ctx.textAlign = "center";
      ctx.fillText(
        t ? t("shareCard.myPrediction").toUpperCase() : "YOUR PREDICTION",
        CARD_W / 2 - 140,
        300,
      );
      ctx.letterSpacing = "0px";

      // Predicted score
      if (data.quickPick) {
        const pickLabel = { H: "1", D: "X", A: "2" }[data.quickPick];
        ctx.fillStyle = C.green;
        ctx.font = "bold 56px 'JetBrains Mono', monospace";
        ctx.fillText(pickLabel, CARD_W / 2 - 140, 365);
      } else {
        ctx.fillStyle = C.green;
        ctx.font = "bold 56px 'JetBrains Mono', monospace";
        ctx.fillText(`${data.homeScore} : ${data.awayScore}`, CARD_W / 2 - 140, 365);
      }

      // Arrow between prediction and result
      ctx.fillStyle = C.textTertiary;
      ctx.font = "400 28px 'Inter', sans-serif";
      ctx.fillText("\u2192", CARD_W / 2, 355);

      // "RESULT" label
      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 12px 'Inter', sans-serif";
      ctx.letterSpacing = "2px";
      ctx.fillText(
        t ? t("shareCard.actualResult").toUpperCase() : "RESULT",
        CARD_W / 2 + 140,
        300,
      );
      ctx.letterSpacing = "0px";

      // Actual score
      ctx.fillStyle = C.textPrimary;
      ctx.font = "bold 56px 'JetBrains Mono', monospace";
      ctx.fillText(`${data.actualHome} : ${data.actualAway}`, CARD_W / 2 + 140, 365);

      // ── Result badge ──
      if (tierStyle && data.points != null) {
        const badgeY = 415;
        const label = tierLabel(tier, t);
        const ptsText = `+${data.points} PTS`;
        const parts: string[] = [];
        if (label) parts.push(label);
        parts.push(ptsText);
        if (data.isJoker) parts.push("2x JOKER");
        if (data.streak && data.streak >= 3) parts.push(`\uD83D\uDD25 ${data.streak}`);

        const badgeText = parts.join("  \u00B7  ");

        ctx.font = "bold 16px 'Space Grotesk', sans-serif";
        const badgeW = ctx.measureText(badgeText).width + 56;
        const badgeH = 44;
        const badgeX = CARD_W / 2 - badgeW / 2;

        // Badge glow
        if (tier !== "wrong") {
          ctx.save();
          const glow = ctx.createRadialGradient(
            CARD_W / 2, badgeY + badgeH / 2, 0,
            CARD_W / 2, badgeY + badgeH / 2, badgeW * 0.6,
          );
          glow.addColorStop(0, tierStyle.glow);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.fillRect(badgeX - 40, badgeY - 20, badgeW + 80, badgeH + 40);
          ctx.restore();
        }

        // Badge background
        ctx.fillStyle = tierStyle.bg;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
        ctx.fill();

        // Badge border
        ctx.strokeStyle = tierStyle.text + "30";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
        ctx.stroke();

        // Badge text
        ctx.fillStyle = tierStyle.text;
        ctx.font = "bold 16px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, CARD_W / 2, badgeY + badgeH / 2);
        ctx.textBaseline = "alphabetic";
      }
    } else {
      // --- Pre-match: prediction only ---

      // "MY PREDICTION" label
      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 13px 'Inter', sans-serif";
      ctx.letterSpacing = "2px";
      ctx.textAlign = "center";
      ctx.fillText(
        t ? t("shareCard.myPrediction").toUpperCase() : "MY PREDICTION",
        CARD_W / 2,
        280,
      );
      ctx.letterSpacing = "0px";

      // Decorative lines flanking the label
      const labelW = ctx.measureText(t ? t("shareCard.myPrediction") : "MY PREDICTION").width;
      drawDivider(ctx, 275, CARD_W / 2 - labelW / 2 - 60, CARD_W / 2 - labelW / 2 - 8);
      drawDivider(ctx, 275, CARD_W / 2 + labelW / 2 + 8, CARD_W / 2 + labelW / 2 + 60);

      // Predicted score (large, centered)
      if (data.quickPick) {
        const pickLabel = { H: "1", D: "X", A: "2" }[data.quickPick];
        ctx.fillStyle = C.green;
        ctx.font = "bold 80px 'JetBrains Mono', monospace";
        ctx.fillText(pickLabel, CARD_W / 2, 370);
      } else {
        ctx.fillStyle = C.green;
        ctx.font = "bold 80px 'JetBrains Mono', monospace";
        ctx.fillText(`${data.homeScore} : ${data.awayScore}`, CARD_W / 2, 370);
      }

      // Joker badge
      if (data.isJoker) {
        const jokerY = 400;
        ctx.fillStyle = "rgba(255,200,0,0.12)";
        ctx.beginPath();
        ctx.roundRect(CARD_W / 2 - 50, jokerY, 100, 30, 6);
        ctx.fill();
        ctx.fillStyle = C.gold;
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.fillText("2x JOKER", CARD_W / 2, jokerY + 19);
      }
    }

    // ── Footer ──
    drawDivider(ctx, CARD_H - 62, 48, CARD_W - 48, true);

    // Tagline
    ctx.fillStyle = C.textTertiary;
    ctx.font = "500 13px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      t ? t("shareCard.tagline") : "Predict. Compete. Prove it.",
      48,
      CARD_H - 28,
    );

    // URL
    ctx.fillStyle = C.textTertiary;
    ctx.font = "400 12px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("yamanaddas.github.io/YancoCup", CARD_W - 48, CARD_H - 28);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// STORY CARD — 1080 × 1920 (9:16)
// ═══════════════════════════════════════════════════════════════

const STORY_W = 1080;
const STORY_H = 1920;

export async function generateStoryCard(
  data: ShareCardData,
  t?: TFn,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const hasResult = data.actualHome != null && data.actualAway != null;
    const tier = data.tier ?? (hasResult ? inferTier(data.points) : null);
    const tierStyle = tier ? TIER_STYLE[tier] ?? TIER_STYLE.wrong : null;

    // ── Background ──
    drawBackground(ctx, STORY_W, STORY_H);
    drawAccentBars(ctx, STORY_W, STORY_H, 5);
    drawCornerDecor(ctx, STORY_W, STORY_H, 36, 70, 8);

    // ── Large decorative star pattern behind content ──
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,136,0.03)";
    ctx.lineWidth = 2;
    drawStar8(ctx, STORY_W / 2, STORY_H * 0.38, 280);
    drawStar8(ctx, STORY_W / 2, STORY_H * 0.38, 200);
    drawStar8(ctx, STORY_W / 2, STORY_H * 0.38, 120);
    ctx.restore();

    // ── Branding ──
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.green;
    ctx.font = "bold 36px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YANCOCUP", STORY_W / 2, 120);

    // Competition
    ctx.fillStyle = C.textSecondary;
    ctx.font = "500 20px 'Inter', sans-serif";
    const compText = data.competitionName ?? data.competition;
    const metaText = data.matchday ? `${compText} \u00B7 ${data.matchday}` : compText;
    ctx.fillText(metaText, STORY_W / 2, 165);

    // Divider
    drawDivider(ctx, 200, STORY_W / 2 - 120, STORY_W / 2 + 120, true);

    // ── Team badges (large) ──
    await Promise.all([
      drawTeamBadge(ctx, data.homeIso, data.homeCrest, data.homeCode, STORY_W / 2 - 170, 340, 65, 24),
      drawTeamBadge(ctx, data.awayIso, data.awayCrest, data.awayCode, STORY_W / 2 + 170, 340, 65, 24),
    ]);

    // Team codes
    ctx.fillStyle = C.textPrimary;
    ctx.font = "bold 30px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.homeCode, STORY_W / 2 - 170, 430);
    ctx.fillText(data.awayCode, STORY_W / 2 + 170, 430);

    // Team names
    ctx.fillStyle = C.textSecondary;
    ctx.font = "400 16px 'Inter', sans-serif";
    ctx.fillText(data.homeTeam, STORY_W / 2 - 170, 458);
    ctx.fillText(data.awayTeam, STORY_W / 2 + 170, 458);

    // "vs"
    ctx.fillStyle = C.textTertiary;
    ctx.font = "600 18px 'Inter', sans-serif";
    ctx.fillText("vs", STORY_W / 2, 340);

    // ── Score section ──
    if (hasResult) {
      // Prediction
      drawDivider(ctx, 520, STORY_W / 2 - 200, STORY_W / 2 + 200);

      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 16px 'Inter', sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText(
        t ? t("shareCard.myPrediction").toUpperCase() : "YOUR PREDICTION",
        STORY_W / 2,
        580,
      );
      ctx.letterSpacing = "0px";

      if (data.quickPick) {
        const pickLabel = { H: "1", D: "X", A: "2" }[data.quickPick];
        ctx.fillStyle = C.green;
        ctx.font = "bold 96px 'JetBrains Mono', monospace";
        ctx.fillText(pickLabel, STORY_W / 2, 680);
      } else {
        ctx.fillStyle = C.green;
        ctx.font = "bold 96px 'JetBrains Mono', monospace";
        ctx.fillText(`${data.homeScore} : ${data.awayScore}`, STORY_W / 2, 680);
      }

      // Arrow down
      ctx.fillStyle = C.textTertiary;
      ctx.font = "400 36px 'Inter', sans-serif";
      ctx.fillText("\u2193", STORY_W / 2, 740);

      // Actual result
      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 16px 'Inter', sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText(
        t ? t("shareCard.actualResult").toUpperCase() : "ACTUAL RESULT",
        STORY_W / 2,
        800,
      );
      ctx.letterSpacing = "0px";

      ctx.fillStyle = C.textPrimary;
      ctx.font = "bold 80px 'JetBrains Mono', monospace";
      ctx.fillText(`${data.actualHome} : ${data.actualAway}`, STORY_W / 2, 890);

      // ── Result badge ──
      if (tierStyle && data.points != null) {
        const badgeY = 950;
        const label = tierLabel(tier, t);
        const ptsText = `+${data.points} PTS`;
        const parts: string[] = [];
        if (label) parts.push(label);
        parts.push(ptsText);

        const badgeText = parts.join("  \u00B7  ");

        ctx.font = "bold 22px 'Space Grotesk', sans-serif";
        const badgeW = ctx.measureText(badgeText).width + 64;
        const badgeH = 56;
        const badgeX = STORY_W / 2 - badgeW / 2;

        // Glow
        if (tier !== "wrong") {
          ctx.save();
          const glow = ctx.createRadialGradient(
            STORY_W / 2, badgeY + badgeH / 2, 0,
            STORY_W / 2, badgeY + badgeH / 2, badgeW * 0.6,
          );
          glow.addColorStop(0, tierStyle.glow);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.fillRect(badgeX - 50, badgeY - 25, badgeW + 100, badgeH + 50);
          ctx.restore();
        }

        // Badge bg
        ctx.fillStyle = tierStyle.bg;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
        ctx.fill();

        // Badge border
        ctx.strokeStyle = tierStyle.text + "30";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
        ctx.stroke();

        // Badge text
        ctx.fillStyle = tierStyle.text;
        ctx.font = "bold 22px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, STORY_W / 2, badgeY + badgeH / 2);
        ctx.textBaseline = "alphabetic";

        // Extras row: streak + joker
        let extrasY = badgeY + badgeH + 40;

        if (data.isJoker) {
          ctx.fillStyle = "rgba(255,200,0,0.12)";
          ctx.beginPath();
          ctx.roundRect(STORY_W / 2 - 65, extrasY, 130, 40, 8);
          ctx.fill();
          ctx.fillStyle = C.gold;
          ctx.font = "bold 17px 'Space Grotesk', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\u2728 2x JOKER", STORY_W / 2, extrasY + 20);
          ctx.textBaseline = "alphabetic";
          extrasY += 52;
        }

        if (data.streak && data.streak >= 3) {
          ctx.fillStyle = "rgba(255,100,50,0.10)";
          ctx.beginPath();
          ctx.roundRect(STORY_W / 2 - 75, extrasY, 150, 40, 8);
          ctx.fill();
          ctx.fillStyle = "#ff8844";
          ctx.font = "bold 17px 'Space Grotesk', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`\uD83D\uDD25 ${data.streak} STREAK`, STORY_W / 2, extrasY + 20);
          ctx.textBaseline = "alphabetic";
        }
      }
    } else {
      // Pre-match: prediction only
      drawDivider(ctx, 520, STORY_W / 2 - 200, STORY_W / 2 + 200);

      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 18px 'Inter', sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText(
        t ? t("shareCard.myPrediction").toUpperCase() : "MY PREDICTION",
        STORY_W / 2,
        600,
      );
      ctx.letterSpacing = "0px";

      if (data.quickPick) {
        const pickLabel = { H: "1", D: "X", A: "2" }[data.quickPick];
        ctx.fillStyle = C.green;
        ctx.font = "bold 120px 'JetBrains Mono', monospace";
        ctx.fillText(pickLabel, STORY_W / 2, 740);
      } else {
        ctx.fillStyle = C.green;
        ctx.font = "bold 120px 'JetBrains Mono', monospace";
        ctx.fillText(`${data.homeScore} : ${data.awayScore}`, STORY_W / 2, 740);
      }

      if (data.isJoker) {
        ctx.fillStyle = "rgba(255,200,0,0.12)";
        ctx.beginPath();
        ctx.roundRect(STORY_W / 2 - 65, 780, 130, 42, 8);
        ctx.fill();
        ctx.fillStyle = C.gold;
        ctx.font = "bold 18px 'Space Grotesk', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("\u2728 2x JOKER", STORY_W / 2, 801);
        ctx.textBaseline = "alphabetic";
      }
    }

    // ── CTA text ──
    ctx.fillStyle = C.textSecondary;
    ctx.font = "500 20px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      t ? t("shareCard.joinMe") : "Join me on YancoCup \u2014 predict the World Cup!",
      STORY_W / 2,
      STORY_H - 160,
    );

    // ── Footer ──
    drawDivider(ctx, STORY_H - 110, STORY_W / 2 - 200, STORY_W / 2 + 200, true);

    ctx.fillStyle = C.textTertiary;
    ctx.font = "500 16px 'Inter', sans-serif";
    ctx.fillText(
      t ? t("shareCard.tagline") : "Predict. Compete. Prove it.",
      STORY_W / 2,
      STORY_H - 70,
    );

    ctx.font = "400 14px 'Inter', sans-serif";
    ctx.fillText("yamanaddas.github.io/YancoCup", STORY_W / 2, STORY_H - 40);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// PROFILE CARD — 600 × 360
// ═══════════════════════════════════════════════════════════════

export async function generateProfileCard(
  data: ProfileCardData,
  t?: TFn,
): Promise<Blob | null> {
  try {
    const W = 600;
    const H = 360;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    drawBackground(ctx, W, H);
    drawAccentBars(ctx, W, H, 3);
    drawCornerDecor(ctx, W, H, 14, 30, 4);

    ctx.textBaseline = "alphabetic";

    // Branding
    ctx.fillStyle = C.green;
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("YANCOCUP", 24, 36);

    // Name
    ctx.fillStyle = C.textPrimary;
    ctx.font = "bold 28px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.displayName ?? data.handle, W / 2, 80);

    // Handle
    ctx.fillStyle = C.textTertiary;
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText(`@${data.handle}`, W / 2, 105);

    // Rank badge
    ctx.fillStyle = C.green;
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
    const baseY = 195;

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!;
      const x = colW * i + colW / 2;

      ctx.fillStyle = C.green;
      ctx.font = "bold 36px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(s.value, x, baseY);

      ctx.fillStyle = C.textTertiary;
      ctx.font = "600 10px 'Inter', sans-serif";
      ctx.fillText(s.label, x, baseY + 22);
    }

    // Divider
    drawDivider(ctx, baseY + 44, 24, W - 24, true);

    // CTA
    ctx.fillStyle = C.textSecondary;
    ctx.font = "400 14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      t ? t("shareCard.joinMe") : "Join me on YancoCup \u2014 predict the World Cup!",
      W / 2,
      baseY + 74,
    );

    // Footer
    ctx.fillStyle = C.textTertiary;
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillText("yamanaddas.github.io/YancoCup", W / 2, H - 12);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARE / DOWNLOAD FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function buildShareText(data: ShareCardData, t?: TFn): string {
  const myPred = t ? t("shareCard.myPredictionText") : "My prediction:";
  const score = data.quickPick
    ? { H: "Home Win", D: "Draw", A: "Away Win" }[data.quickPick]
    : `${data.homeScore}-${data.awayScore}`;
  return `${myPred} ${data.homeTeam} ${score} ${data.awayTeam} | YancoCup`;
}

async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<"shared" | "downloaded" | "failed"> {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ text, files: [file] });
      return "shared";
    } catch {
      // User cancelled — fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export async function sharePredictionCard(
  data: ShareCardData,
  t?: TFn,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateShareCard(data, t);
  if (!blob) return "failed";
  return shareOrDownload(blob, "yancocup-prediction.png", buildShareText(data, t));
}

export async function shareStoryCard(
  data: ShareCardData,
  t?: TFn,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateStoryCard(data, t);
  if (!blob) return "failed";
  return shareOrDownload(blob, "yancocup-story.png", buildShareText(data, t));
}

export async function shareProfileCard(
  data: ProfileCardData,
  t?: TFn,
): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await generateProfileCard(data, t);
  if (!blob) return "failed";

  const text = t
    ? `${data.rank} ${t("shareCard.onYancoCup")} ${data.totalPoints} pts! | YancoCup`
    : `I'm ${data.rank} on YancoCup with ${data.totalPoints} points! | YancoCup`;

  return shareOrDownload(blob, "yancocup-profile.png", text);
}
