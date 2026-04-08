import { useState, useMemo } from "react";
import { useSchedule } from "../hooks/useSchedule";
import { useTeams, useTeamMap } from "../hooks/useTeams";
import { useVenueMap, useVenues } from "../hooks/useVenues";
import { useGroups } from "../hooks/useGroups";
import { useScores } from "../hooks/useScores";
import { useI18n } from "../lib/i18n";
import MatchCard from "../components/match/MatchCard";
import type { Match } from "../types";

const ROUND_KEYS: { value: Match["round"] | ""; labelKey: string }[] = [
  { value: "", labelKey: "matches.allRounds" },
  { value: "group", labelKey: "round.group" },
  { value: "round-of-32", labelKey: "round.roundOf32" },
  { value: "round-of-16", labelKey: "round.roundOf16" },
  { value: "quarterfinal", labelKey: "round.quarterfinal" },
  { value: "semifinal", labelKey: "round.semifinal" },
  { value: "third-place", labelKey: "round.thirdPlace" },
  { value: "final", labelKey: "round.final" },
];

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-yc-text-tertiary text-[10px] uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted transition-colors appearance-none cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

export default function MatchesPage() {
  const [round, setRound] = useState("");
  const [group, setGroup] = useState("");
  const [team, setTeam] = useState("");
  const [venueId, setVenueId] = useState("");
  const { t } = useI18n();

  const groups = useGroups();
  const teams = useTeams();
  const venues = useVenues();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap } = useScores();

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (round) f.round = round;
    if (group) f.group = group;
    if (team) f.team = team;
    if (venueId) f.venueId = venueId;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [round, group, team, venueId]);

  const matches = useSchedule(filters);

  // Group matches by date for display
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const existing = map.get(m.date);
      if (existing) existing.push(m);
      else map.set(m.date, [m]);
    }
    return map;
  }, [matches]);

  const clearFilters = () => {
    setRound("");
    setGroup("");
    setTeam("");
    setVenueId("");
  };

  const hasFilters = round || group || team || venueId;
  const countStr = matches.length !== 1
    ? t("matches.countPlural", { count: matches.length })
    : t("matches.count", { count: matches.length });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">{t("matches.title")}</h2>
          <p className="text-yc-text-tertiary text-sm mt-1">{countStr}</p>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-yc-green text-sm hover:underline"
          >
            {t("matches.clearFilters")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <SelectFilter label={t("matches.filterRound")} value={round} onChange={setRound}>
          {ROUND_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
          ))}
        </SelectFilter>

        <SelectFilter label={t("matches.filterGroup")} value={group} onChange={setGroup}>
          <option value="">{t("matches.allGroups")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{t("match.group", { id: g.id })}</option>
          ))}
        </SelectFilter>

        <SelectFilter label={t("matches.filterTeam")} value={team} onChange={setTeam}>
          <option value="">{t("matches.allTeams")}</option>
          {teams.map((t_) => (
            <option key={t_.id} value={t_.id}>{t_.name}</option>
          ))}
        </SelectFilter>

        <SelectFilter label={t("matches.filterVenue")} value={venueId} onChange={setVenueId}>
          <option value="">{t("matches.allVenues")}</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </SelectFilter>
      </div>

      {/* Match list grouped by date */}
      {matches.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm text-center py-12">
          {t("matches.noResults")}
        </p>
      ) : (
        <div className="space-y-8">
          {[...matchesByDate.entries()].map(([date, dateMatches]) => (
            <div key={date}>
              <h3 className="text-yc-text-secondary text-sm font-medium mb-3 sticky top-14 bg-yc-bg-deep py-2 z-10">
                {new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dateMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    teamMap={teamMap}
                    venueMap={venueMap}
                    liveScore={scoreMap.get(m.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
