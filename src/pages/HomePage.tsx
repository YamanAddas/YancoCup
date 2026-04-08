import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import GlobeView from "../components/globe/GlobeView";
import Countdown from "../components/layout/Countdown";
import MatchCard from "../components/match/MatchCard";
import { useSchedule } from "../hooks/useSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useVenueMap } from "../hooks/useVenues";
import { Trophy, ArrowRight, Calendar } from "lucide-react";

function TodaysMatches() {
  const allMatches = useSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();

  const todaysMatches = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allMatches.filter((m) => m.date === today);
  }, [allMatches]);

  // If no matches today, show next upcoming matches
  const displayMatches = useMemo(() => {
    if (todaysMatches.length > 0) return { matches: todaysMatches, label: "Today's Matches" };

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = allMatches.filter((m) => m.date > today);
    const first = upcoming[0];
    if (first) {
      const nextDate = first.date;
      const nextMatches = upcoming.filter((m) => m.date === nextDate);
      const dateLabel = new Date(`${nextDate}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      return { matches: nextMatches, label: `Next Matches — ${dateLabel}` };
    }

    return { matches: [], label: "No Upcoming Matches" };
  }, [todaysMatches, allMatches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-yc-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-yc-green" />
          <h3 className="font-heading text-xl font-bold">{displayMatches.label}</h3>
        </div>
        <NavLink
          to="/matches"
          className="flex items-center gap-1 text-yc-green text-sm hover:underline"
        >
          All matches <ArrowRight size={14} />
        </NavLink>
      </div>

      {displayMatches.matches.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm">
          The tournament runs June 11 – July 19, 2026.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayMatches.matches.slice(0, 6).map((m) => (
            <MatchCard key={m.id} match={m} teamMap={teamMap} venueMap={venueMap} compact />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero: globe + countdown side by side on desktop */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-center">
        <GlobeView />

        <div className="flex flex-col items-center lg:items-start gap-6">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              World Cup <span className="text-yc-green">2026</span>
            </h2>
            <p className="text-yc-text-secondary text-sm">
              United States, Mexico &amp; Canada
            </p>
          </div>

          <div>
            <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
              Kickoff in
            </p>
            <Countdown />
          </div>

          <a
            href="#/predictions"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Trophy size={18} />
            Predict matches with friends
          </a>
        </div>
      </section>

      <TodaysMatches />
    </div>
  );
}
