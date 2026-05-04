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

/** Decode base64url to ArrayBuffer — required by pushManager.subscribe's
 *  applicationServerKey, which expects a raw byte buffer of the VAPID
 *  public key, not its base64url string form. */
function urlBase64ToBuffer(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/** Subscribe to web push notifications via the registered service worker.
 *  Posts the resulting subscription to the Worker so it can send pushes
 *  later. No-op when VITE_VAPID_PUBLIC_KEY isn't set. */
export async function subscribeToPush(
  workerUrl: string,
  authToken: string,
): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublic) {
    console.warn("VITE_VAPID_PUBLIC_KEY not set — push subscription skipped");
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidPublic),
      });
    }
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const res = await fetch(`${workerUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Push subscribe failed:", err);
    return false;
  }
}

/** Check if notifications are enabled */
export function notificationsEnabled(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/** Send a notification.
 *  Prefers ServiceWorkerRegistration.showNotification when an SW is active —
 *  this lets the notification persist past tab close once Part 2 (push send)
 *  is wired up. Falls back to the basic Notification API otherwise. */
export function sendNotification(
  title: string,
  body: string,
  tag?: string,
): void {
  if (!notificationsEnabled()) return;

  const icon = `${window.location.origin}${import.meta.env.BASE_URL}logo-192.png`;
  const badge = `${window.location.origin}${import.meta.env.BASE_URL}logo-160.png`;
  const options: NotificationOptions = {
    body,
    icon,
    badge,
    tag: tag ?? "yancocup",
    silent: false,
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => {
        // Fall back to plain Notification if SW unavailable
        try {
          new Notification(title, options);
        } catch {
          /* ignore */
        }
      });
    return;
  }

  new Notification(title, options);
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
