import { useMemo, useRef, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Table,
  GitBranch,
  Trophy,
  BarChart3,
  UsersRound,
} from "lucide-react";

interface TabDef {
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function CompetitionHub() {
  const comp = useCompetition();
  const { t } = useI18n();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo<TabDef[]>(() => {
    const list: TabDef[] = [
      { path: "overview", labelKey: "hub.overview", icon: LayoutDashboard },
      { path: "matches", labelKey: "nav.matches", icon: Calendar },
    ];

    if (comp.type === "tournament") {
      if (comp.hasGroups) {
        list.push({ path: "groups", labelKey: "nav.groups", icon: Users });
      } else {
        list.push({ path: "standings", labelKey: "nav.standings", icon: Table });
      }
      list.push({ path: "bracket", labelKey: "nav.bracket", icon: GitBranch });
    } else {
      list.push({ path: "standings", labelKey: "nav.standings", icon: Table });
    }

    list.push(
      { path: "predictions", labelKey: "nav.predictions", icon: Trophy },
      { path: "leaderboard", labelKey: "nav.leaderboard", icon: BarChart3 },
      { path: "pools", labelKey: "pools.title", icon: UsersRound },
    );

    return list;
  }, [comp]);

  // Extract active tab from URL path
  const segments = location.pathname.split("/");
  const activeTab = segments[2]?.toLowerCase();

  // Scroll active tab into view when route changes
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>("[data-active]");
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTab]);

  return (
    <div>
      {/* Sticky hub header */}
      <div className="sticky top-14 z-40 yc-glass border-b border-yc-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Competition info row */}
          <div className="flex items-center gap-3 pt-3">
            <img
              src={comp.emblem}
              alt={comp.shortName}
              className="w-8 h-8 object-contain shrink-0"
              loading="lazy"
            />
            <h1 className="font-heading text-lg font-bold leading-tight truncate">
              {comp.shortName}
            </h1>
            <span className="text-yc-text-tertiary text-xs shrink-0 ml-auto">
              {comp.seasonLabel}
            </span>
          </div>

          {/* Tab bar */}
          <div
            ref={scrollRef}
            className="flex gap-0.5 overflow-x-auto scrollbar-none mt-2 -mb-px"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  data-active={isActive || undefined}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? "text-yc-green border-yc-green"
                      : "text-yc-text-tertiary hover:text-yc-text-secondary border-transparent"
                  }`}
                >
                  <Icon size={14} />
                  {t(tab.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <Outlet />
    </div>
  );
}
