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

handleAuthRedirect().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
