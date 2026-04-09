import { NavLink, useParams } from "react-router-dom";
import {
  Globe as GlobeIcon,
  Tv,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { COMPETITIONS } from "../../lib/competitions";
import LanguageSwitcher from "./LanguageSwitcher";

function useCurrentCompetition(): string | undefined {
  const { competition } = useParams<{ competition: string }>();
  return competition?.toUpperCase();
}

export default function NavBar() {
  const { user, profile, loading, signOut } = useAuth();
  const { t } = useI18n();
  const comp = useCurrentCompetition();
  const compConfig = comp ? COMPETITIONS[comp] : undefined;

  const links = [
    { to: "/", labelKey: "nav.home", icon: GlobeIcon, end: true },
    ...(compConfig
      ? [{ to: `/${comp}/overview`, label: compConfig.shortName, emblem: compConfig.emblem, end: false }]
      : []),
    { to: "/watch", labelKey: "nav.watch", icon: Tv, end: false },
  ] as Array<{ to: string; labelKey?: string; label?: string; icon?: React.ComponentType<{ size?: number }>; emblem?: string; end: boolean }>;

  return (
    <header className="sticky top-0 z-50 yc-glass border-b border-yc-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <NavLink to="/" className="flex items-center">
          <img
            src={`${import.meta.env.BASE_URL}logo-nav.png`}
            alt="YancoCup"
            className="h-10 sm:h-11 w-auto drop-shadow-[0_0_8px_rgba(0,255,136,0.15)]"
          />
        </NavLink>

        <nav className="hidden sm:flex items-center gap-0.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-yc-green bg-yc-green/10 shadow-[0_0_12px_rgba(0,255,136,0.1)]"
                    : "text-yc-text-secondary hover:text-yc-text-primary hover:bg-white/[0.03]"
                }`
              }
            >
              {link.emblem ? (
                <img src={link.emblem} alt="" className="w-4 h-4 object-contain yc-emblem" />
              ) : link.icon ? (
                <link.icon size={16} />
              ) : null}
              {link.label ?? (link.labelKey ? t(link.labelKey) : "")}
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
              <NavLink to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name ?? profile.handle}
                    className="w-8 h-8 rounded-full border border-[var(--yc-border-accent)]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-yc-green-dark flex items-center justify-center text-yc-green text-xs font-bold border border-[var(--yc-border-accent)]">
                    {(profile?.handle ?? user.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:block text-yc-text-secondary text-sm max-w-[100px] truncate">
                  {profile?.display_name ?? profile?.handle ?? "User"}
                </span>
              </NavLink>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-yc-green hover:bg-yc-green/10 transition-all"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">{t("nav.signIn")}</span>
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
