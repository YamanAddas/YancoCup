import { NavLink, useParams } from "react-router-dom";
import {
  Globe as GlobeIcon,
  Trophy,
  Tv,
  User,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { COMPETITIONS } from "../../lib/competitions";

export default function MobileNav() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { competition } = useParams<{ competition: string }>();
  const comp = competition?.toUpperCase() ?? "WC";
  const compConfig = COMPETITIONS[comp];

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 yc-glass border-t border-yc-border safe-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {/* Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[48px] ${
              isActive
                ? "text-yc-green drop-shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                : "text-yc-text-tertiary"
            }`
          }
        >
          <GlobeIcon size={20} />
          {t("nav.home")}
        </NavLink>

        {/* Current competition */}
        <NavLink
          to={`/${comp}/overview`}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[48px] ${
              isActive
                ? "text-yc-green drop-shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                : "text-yc-text-tertiary"
            }`
          }
        >
          {compConfig?.emblem ? (
            <img src={compConfig.emblem} alt="" className="w-5 h-5 object-contain" />
          ) : (
            <Trophy size={20} />
          )}
          {compConfig?.shortName ?? comp}
        </NavLink>

        {/* Predict */}
        <NavLink
          to={`/${comp}/predictions`}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[48px] ${
              isActive
                ? "text-yc-green drop-shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                : "text-yc-text-tertiary"
            }`
          }
        >
          <Trophy size={20} />
          {t("nav.predictions")}
        </NavLink>

        {/* Watch */}
        <NavLink
          to="/watch"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[48px] ${
              isActive
                ? "text-yc-green drop-shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                : "text-yc-text-tertiary"
            }`
          }
        >
          <Tv size={20} />
          {t("nav.watch")}
        </NavLink>

        {/* Profile/Sign In */}
        <NavLink
          to={user ? "/profile" : "/sign-in"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[48px] ${
              isActive
                ? "text-yc-green drop-shadow-[0_0_6px_rgba(0,255,136,0.3)]"
                : "text-yc-text-tertiary"
            }`
          }
        >
          <User size={20} />
          {user ? "Profile" : t("nav.signIn")}
        </NavLink>
      </div>
    </nav>
  );
}
