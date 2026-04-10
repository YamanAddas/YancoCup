import { Component, lazy, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useI18n } from "../../lib/i18n";

const GlobeScene = lazy(() => import("./GlobeScene"));

class GlobeErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Globe] WebGL/Three.js crash:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function GlobeLoading() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-yc-text-secondary font-heading text-lg tracking-tight">
        {t("globe.loading")}
      </div>
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3">
      <div className="w-16 h-16 rounded-full bg-yc-bg-elevated border border-yc-border flex items-center justify-center text-3xl">
        🌍
      </div>
      <p className="text-yc-text-secondary text-sm">
        3D globe unavailable — your browser may not support WebGL
      </p>
    </div>
  );
}

export default function GlobeView() {
  return (
    <div className="w-full h-[min(45vh,400px)] sm:h-[min(60vh,600px)] min-h-[220px]">
      <GlobeErrorBoundary fallback={<GlobeFallback />}>
        <Suspense fallback={<GlobeLoading />}>
          <GlobeScene />
        </Suspense>
      </GlobeErrorBoundary>
    </div>
  );
}
