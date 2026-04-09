import { NavLink } from "react-router-dom";
import {
  Globe as GlobeIcon,
  Calendar,
  Users,
  Trophy,
  BarChart3,
  Tv,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

const links = [
  { to: "/", labelKey: "nav.home", icon: GlobeIcon },
  { to: "/matches", labelKey: "nav.matches", icon: Calendar },
  { to: "/groups", labelKey: "nav.groups", icon: Users },
  { to: "/predictions", labelKey: "nav.predictions", icon: Trophy },
  { to: "/leaderboard", labelKey: "nav.leaderboard", icon: BarChart3 },
  { to: "/watch", labelKey: "nav.watch", icon: Tv },
] as const;

export default function NavBar() {
  const { user, profile, loading, signOut } = useAuth();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-50 bg-[var(--yc-bg-glass)] backdrop-blur-xl border-b border-yc-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <NavLink to="/" className="flex items-center">
          <img
            src={`${import.meta.env.BASE_URL}logo-nav.png`}
            alt="YancoCup"
            className="h-10 sm:h-11 w-auto"
          />
        </NavLink>

        <nav className="hidden sm:flex items-center gap-1">
          {links.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-yc-green bg-yc-green-dark/30"
                    : "text-yc-text-secondary hover:text-yc-text-primary"
                }`
              }
            >
              <Icon size={16} />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Language + Auth */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-yc-bg-elevated animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name ?? profile.handle}
                    className="w-8 h-8 rounded-full border border-yc-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-yc-green-dark flex items-center justify-center text-yc-green text-xs font-bold">
                    {(profile?.handle ?? user.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:block text-yc-text-secondary text-sm max-w-[100px] truncate">
                  {profile?.display_name ?? profile?.handle ?? "User"}
                </span>
              </div>
              <button
                onClick={signOut}
                className="text-yc-text-tertiary hover:text-yc-text-primary transition-colors p-1.5"
                title={t("nav.signOut")}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/sign-in"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-yc-green hover:bg-yc-green-dark/30 transition-colors"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">{t("nav.signIn")}</span>
            </NavLink>
          )}
        </div>

        {/* Mobile nav — bottom bar, built in Session 15 */}
      </div>
    </header>
  );
}
