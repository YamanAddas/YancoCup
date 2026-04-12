import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import * as Sentry from "@sentry/react";
import NavBar from "./NavBar";
import MobileNav from "./MobileNav";
import Footer from "./Footer";
import ErrorFallback from "./ErrorFallback";
import SpotlightCursor from "./SpotlightCursor";
import { WORKER_URL } from "../../lib/api";

type Atmosphere = "calm" | "upcoming" | "live";

function useAtmosphere(): Atmosphere {
  const [state, setState] = useState<Atmosphere>("calm");

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch(`${WORKER_URL}/api/live`);
        if (!res.ok || !mounted) return;
        const data = (await res.json()) as { matches: { status: string; utcDate: string }[] };
        if (!mounted) return;
        const live = data.matches?.some(
          (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
        );
        if (live) { setState("live"); return; }
        const soon = data.matches?.some((m) => {
          const diff = new Date(m.utcDate).getTime() - Date.now();
          return diff > 0 && diff < 2 * 60 * 60 * 1000;
        });
        setState(soon ? "upcoming" : "calm");
      } catch { /* */ }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return state;
}

export default function AppLayout() {
  const atmosphere = useAtmosphere();

  return (
    <div
      className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body relative overflow-x-hidden"
      data-atmosphere={atmosphere}
    >
      {/* Ambient orb decorations — shift behavior based on match state */}
      <div className={`yc-orb yc-orb-accent w-[500px] h-[500px] -top-40 -right-40 yc-atmo-orb`} />
      <div className={`yc-orb yc-orb-blue w-[600px] h-[600px] top-1/3 -left-60 yc-atmo-orb`} />
      <div className={`yc-orb yc-orb-accent w-[400px] h-[400px] bottom-0 right-1/4 yc-atmo-orb`} />

      <SpotlightCursor />
      <NavBar />
      <main className="relative z-10 pb-16 sm:pb-0">
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <Outlet />
        </Sentry.ErrorBoundary>
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
