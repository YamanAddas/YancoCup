import { NavLink } from "react-router-dom";
import { Home } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <span className="font-heading text-8xl font-bold text-yc-green mb-4">
        404
      </span>
      <h1 className="font-heading text-2xl font-bold mb-2">
        Page not found
      </h1>
      <p className="text-yc-text-secondary text-sm mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <NavLink
        to="/"
        className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
      >
        <Home size={18} />
        {t("nav.home")}
      </NavLink>
    </div>
  );
}
