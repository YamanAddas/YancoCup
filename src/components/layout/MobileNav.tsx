import { NavLink, useParams } from "react-router-dom";
import {
  Globe as GlobeIcon,
  Calendar,
  Trophy,
  BarChart3,
  Tv,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";

export default function MobileNav() {
  const { t } = useI18n();
  const { competition } = useParams<{ competition: string }>();
  const comp = competition?.toUpperCase() ?? "WC";

  const links = [
    { to: "/", labelKey: "nav.home", icon: GlobeIcon },
    { to: `/${comp}/matches`, labelKey: "nav.matches", icon: Calendar },
    { to: `/${comp}/predictions`, labelKey: "nav.predictions", icon: Trophy },
    { to: `/${comp}/leaderboard`, labelKey: "nav.leaderboard", icon: BarChart3 },
    { to: "/watch", labelKey: "nav.watch", icon: Tv },
  ] as const;

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--yc-bg-glass)] backdrop-blur-xl border-t border-yc-border safe-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {links.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors min-w-[48px] ${
                isActive
                  ? "text-yc-green"
                  : "text-yc-text-tertiary"
              }`
            }
          >
            <Icon size={20} />
            {t(labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
