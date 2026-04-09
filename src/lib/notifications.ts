/**
 * Browser notification system for YancoCup.
 * Requests permission and sends notifications for:
 * - Match deadline approaching (prediction reminder)
 * - Badge earned
 */

/** Request notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Check if notifications are enabled */
export function notificationsEnabled(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/** Send a notification */
export function sendNotification(
  title: string,
  body: string,
  tag?: string,
): void {
  if (!notificationsEnabled()) return;

  new Notification(title, {
    body,
    icon: `${window.location.origin}${import.meta.env.BASE_URL}logo-192.png`,
    badge: `${window.location.origin}${import.meta.env.BASE_URL}logo-160.png`,
    tag: tag ?? "yancocup",
    silent: false,
  });
}

/** Notify about an upcoming match deadline */
export function notifyMatchDeadline(
  homeTeam: string,
  awayTeam: string,
  minutesUntil: number,
): void {
  sendNotification(
    "Prediction Deadline",
    `${homeTeam} vs ${awayTeam} kicks off in ${minutesUntil} min — predict now!`,
    `deadline-${homeTeam}-${awayTeam}`,
  );
}

/** Notify about a badge earned */
export function notifyBadgeEarned(badgeName: string): void {
  sendNotification(
    "Badge Earned! 🏆",
    `You unlocked "${badgeName}"`,
    `badge-${badgeName}`,
  );
}

/** Notify about a match result (if user had a prediction) */
export function notifyMatchResult(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  points: number,
): void {
  const label = points >= 10 ? "Exact score!" : points >= 5 ? "Goal difference!" : points >= 3 ? "Correct result!" : "Wrong prediction";
  sendNotification(
    `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
    `${label} +${points} pts`,
    `result-${homeTeam}-${awayTeam}`,
  );
}

/**
 * Set up deadline check interval.
 * Checks every 5 minutes if any unpredicted match starts within 30 minutes.
 */
export function startDeadlineChecker(
  getUnpredictedMatches: () => Array<{
    homeTeam: string;
    awayTeam: string;
    kickoffTime: Date;
  }>,
): () => void {
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const DEADLINE_WINDOW = 30 * 60 * 1000; // 30 minutes before kickoff

  const interval = setInterval(() => {
    if (!notificationsEnabled()) return;

    const now = Date.now();
    const matches = getUnpredictedMatches();

    for (const m of matches) {
      const diff = m.kickoffTime.getTime() - now;
      if (diff > 0 && diff <= DEADLINE_WINDOW) {
        const mins = Math.round(diff / 60_000);
        notifyMatchDeadline(m.homeTeam, m.awayTeam, mins);
      }
    }
  }, CHECK_INTERVAL);

  return () => clearInterval(interval);
}
