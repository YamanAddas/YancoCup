import { Outlet } from "react-router-dom";
import * as Sentry from "@sentry/react";
import NavBar from "./NavBar";
import MobileNav from "./MobileNav";
import ErrorFallback from "./ErrorFallback";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body">
      <NavBar />
      <main className="pb-16 sm:pb-0">
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <Outlet />
        </Sentry.ErrorBoundary>
      </main>
      <MobileNav />
    </div>
  );
}
