import { lazy, Suspense } from "react";

const GlobeScene = lazy(() => import("./GlobeScene"));

function GlobeLoading() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-yc-text-secondary font-heading text-lg tracking-tight">
        Loading globe...
      </div>
    </div>
  );
}

export default function GlobeView() {
  return (
    <div className="w-full h-[min(60vh,600px)] min-h-[280px]">
      <Suspense fallback={<GlobeLoading />}>
        <GlobeScene />
      </Suspense>
    </div>
  );
}
