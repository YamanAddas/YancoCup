import { Outlet } from "react-router-dom";
import * as Sentry from "@sentry/react";
import NavBar from "./NavBar";
import MobileNav from "./MobileNav";
import ErrorFallback from "./ErrorFallback";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body relative overflow-x-hidden">
      {/* Ambient orb decorations — absolute (not fixed) so parent overflow-x-hidden clips them */}
      <div className="yc-orb yc-orb-accent w-[500px] h-[500px] -top-40 -right-40" />
      <div className="yc-orb yc-orb-blue w-[600px] h-[600px] top-1/3 -left-60" />
      <div className="yc-orb yc-orb-accent w-[400px] h-[400px] bottom-0 right-1/4" />

      <NavBar />
      <main className="relative z-10 pb-16 sm:pb-0">
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <Outlet />
        </Sentry.ErrorBoundary>
      </main>
      <MobileNav />
    </div>
  );
}
