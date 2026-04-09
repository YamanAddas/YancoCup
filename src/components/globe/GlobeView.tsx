import { lazy, Suspense } from "react";
import { useI18n } from "../../lib/i18n";

const GlobeScene = lazy(() => import("./GlobeScene"));

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

export default function GlobeView() {
  return (
    <div className="w-full h-[min(45vh,400px)] sm:h-[min(60vh,600px)] min-h-[220px]">
      <Suspense fallback={<GlobeLoading />}>
        <GlobeScene />
      </Suspense>
    </div>
  );
}
