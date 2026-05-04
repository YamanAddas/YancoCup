/* YancoCup service worker (Part 1: scaffold).
 *
 * Handles incoming push events and notification clicks. Push subscription
 * + Worker-side send (with VAPID) ships in Part 2 — until then this SW is
 * idle. We register it now so the browser is ready and showNotification
 * works for in-tab events triggered by the page.
 */

self.addEventListener("install", () => {
  // Activate immediately on first install — no need to wait for tab close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "YancoCup", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    data.body = event.data ? event.data.text() : "";
  }
  const title = data.title || "YancoCup";
  const options = {
    body: data.body || "",
    icon: data.icon || "/YancoCup/logo-192.png",
    badge: data.badge || "/YancoCup/logo-160.png",
    tag: data.tag,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.includes(target) && "focus" in c) return c.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
