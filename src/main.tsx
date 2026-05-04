import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./lib/supabase";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./styles/globals.css";

// Initialize error monitoring (requires VITE_SENTRY_DSN in .env)
initSentry();

/**
 * HashRouter auth redirect fix:
 * Supabase OAuth appends tokens to the URL hash (#access_token=...).
 * HashRouter would interpret this as a route. We extract the tokens
 * and set the session before React mounts.
 */
async function handleAuthRedirect() {
  const hash = window.location.hash;
  if (hash.includes("access_token=")) {
    // Parse tokens from the hash fragment
    const params = new URLSearchParams(hash.replace("#", ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      // Clean the URL so HashRouter gets a clean hash
      window.location.hash = "/";
    }
  }
}

/** Register the service worker so push events can wake the browser even
 *  when no YancoCup tab is open. SW file is at public/sw.js. */
function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker
    .register(swUrl, { scope: import.meta.env.BASE_URL })
    .catch((err) => console.error("SW registration failed:", err));
}

handleAuthRedirect()
  .catch((err) => console.error("Auth redirect failed:", err))
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    registerServiceWorker();
  });
