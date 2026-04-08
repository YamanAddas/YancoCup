import { NavLink } from "react-router-dom";
import {
  Globe as GlobeIcon,
  Calendar,
  Trophy,
  BarChart3,
  Tv,
} from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: GlobeIcon },
  { to: "/matches", label: "Matches", icon: Calendar },
  { to: "/predictions", label: "Predictions", icon: Trophy },
  { to: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { to: "/watch", label: "Watch", icon: Tv },
] as const;

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 bg-[var(--yc-bg-glass)] backdrop-blur-xl border-b border-yc-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <NavLink to="/" className="flex items-center gap-1">
          <span className="font-heading text-xl font-bold tracking-tight text-yc-text-primary">
            Yanco<span className="text-yc-green">Cup</span>
          </span>
        </NavLink>

        <nav className="hidden sm:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile nav — bottom bar, built in Session 15 */}
      </div>
    </header>
  );
}
