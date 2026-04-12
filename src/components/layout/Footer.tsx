import { NavLink } from "react-router-dom";
import { useI18n } from "../../lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-yc-border bg-yc-bg-surface/50 backdrop-blur-sm mb-16 sm:mb-0">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Links row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-yc-text-secondary mb-4">
          <NavLink
            to="/help"
            className="hover:text-yc-text-primary transition-colors"
          >
            {t("nav.help")}
          </NavLink>
          <NavLink
            to="/terms"
            className="hover:text-yc-text-primary transition-colors"
          >
            {t("nav.terms")}
          </NavLink>
          <NavLink
            to="/privacy"
            className="hover:text-yc-text-primary transition-colors"
          >
            {t("nav.privacy")}
          </NavLink>
          <NavLink
            to="/contact"
            className="hover:text-yc-text-primary transition-colors"
          >
            {t("nav.contact")}
          </NavLink>
          <a
            href="https://github.com/yamanaddas/YancoCup"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-yc-text-primary transition-colors"
          >
            GitHub
          </a>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-yc-text-tertiary">
          &copy; {year} YancoCup &middot; {t("footer.tagline")}
        </p>
      </div>
    </footer>
  );
}
